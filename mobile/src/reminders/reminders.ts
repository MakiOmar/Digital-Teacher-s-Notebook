import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { t } from "../i18n/ar";
import { listUpcomingSessions } from "../repositories";
import { countOutstandingUnpaidPartials } from "../services/rounds";

const SETTINGS_KEY = "tutor.reminders.v1";
/** Legacy aggregate id — cancel on every reschedule. */
const TODAY_ID = "reminder-today-sessions";
const UNPAID_ID = "reminder-weekly-unpaid";
const CLASS_ID_PREFIX = "class-";
/**
 * Android channel ids — bump version when sound/importance must change
 * (channels are immutable once created). Separate silent channels so users
 * can mute without losing a custom ringtone on the sounding channel.
 */
const CLASS_CHANNEL_SOUND = "class-reminders-v3";
const CLASS_CHANNEL_SILENT = "class-reminders-v3-silent";
const UNPAID_CHANNEL_SOUND = "unpaid-reminders-v3";
const UNPAID_CHANNEL_SILENT = "unpaid-reminders-v3-silent";

/** How far ahead to schedule class alarms (device alarm budget). */
const LOOKAHEAD_LIMIT = 60;
/** Default lead time before each class. */
export const DEFAULT_CLASS_LEAD_MINUTES = 30;
/** Default re-alert interval when sound repeat is on. */
export const DEFAULT_SOUND_REPEAT_INTERVAL = 3;
export const DEFAULT_SOUND_REPEAT_UNIT: SoundRepeatUnit = "minutes";
/** Cap scheduled follow-ups (device alarm budget). */
const MAX_REPEAT_ALERTS = 40;
const REPEAT_SUFFIX = "-r";
/** iOS category so swipe-dismiss cancels pending repeats. */
const REMINDER_CATEGORY_ID = "tutor-reminder-v1";

export type SoundRepeatMode = "once" | "repeat";
export type SoundRepeatUnit = "seconds" | "minutes";

export type ReminderSettings = {
  /** Alert before each upcoming class (default on). */
  classEnabled: boolean;
  unpaidEnabled: boolean;
  /** Play notification sound (default on). */
  soundEnabled: boolean;
  /** Once per alert, or re-alert until tapped / removed (default once). */
  soundRepeatMode: SoundRepeatMode;
  /** How often to re-alert in repeat mode (default 3). */
  soundRepeatInterval: number;
  /** Interval unit: seconds or minutes (default minutes). */
  soundRepeatUnit: SoundRepeatUnit;
  /** Minutes before `starts_at` (fixed at 30 for now). */
  classLeadMinutes: number;
};

const DEFAULTS: ReminderSettings = {
  classEnabled: true,
  unpaidEnabled: false,
  soundEnabled: true,
  soundRepeatMode: "once",
  soundRepeatInterval: DEFAULT_SOUND_REPEAT_INTERVAL,
  soundRepeatUnit: DEFAULT_SOUND_REPEAT_UNIT,
  classLeadMinutes: DEFAULT_CLASS_LEAD_MINUTES,
};

function classChannelId(soundEnabled: boolean): string {
  return soundEnabled ? CLASS_CHANNEL_SOUND : CLASS_CHANNEL_SILENT;
}

function unpaidChannelId(soundEnabled: boolean): string {
  return soundEnabled ? UNPAID_CHANNEL_SOUND : UNPAID_CHANNEL_SILENT;
}

/** Channel opened in system settings so the user can pick a ringtone. */
export function reminderSoundSettingsChannelId(): string {
  return CLASS_CHANNEL_SOUND;
}

/**
 * Android Expo Go throws on any `expo-notifications` import (push token
 * auto-registration). Skip the native module entirely there; use a dev build
 * or release APK for real reminder scheduling.
 */
const notificationsBlocked =
  isRunningInExpoGo() && Platform.OS === "android";

type NotificationsModule = typeof import("expo-notifications");

function getNotifications(): NotificationsModule | null {
  if (notificationsBlocked) return null;
  // Lazy require so Expo Go Android never evaluates the package entry.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as NotificationsModule;
}

function initHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function initInteractionHandlers(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;

  void Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [], {
    customDismissAction: true,
  }).catch(() => undefined);

  Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.identifier;
    if (!isManagedReminderIdentifier(id)) return;
    void stopReminderSeries(Notifications, id).catch(() => undefined);
  });

  const last = Notifications.getLastNotificationResponse();
  if (last && isManagedReminderIdentifier(last.notification.request.identifier)) {
    void stopReminderSeries(
      Notifications,
      last.notification.request.identifier
    ).catch(() => undefined);
    Notifications.clearLastNotificationResponse();
  }
}

initHandler();
initInteractionHandlers();

export function remindersAvailableInThisRuntime(): boolean {
  return !notificationsBlocked;
}

/** Parse SQLite local datetime into a device-local Date. */
function parseSessionStart(value: string): Date | null {
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  );
}

function formatHm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function classNotificationId(sessionId: number): string {
  return `${CLASS_ID_PREFIX}${sessionId}`;
}

function classRepeatNotificationId(
  sessionId: number,
  repeatIndex: number
): string {
  if (repeatIndex <= 0) return classNotificationId(sessionId);
  return `${CLASS_ID_PREFIX}${sessionId}${REPEAT_SUFFIX}${repeatIndex}`;
}

function unpaidRepeatNotificationId(repeatIndex: number): string {
  if (repeatIndex <= 0) return UNPAID_ID;
  return `${UNPAID_ID}${REPEAT_SUFFIX}${repeatIndex}`;
}

function repeatAlertCount(
  mode: SoundRepeatMode,
  intervalMs: number,
  windowMs: number
): number {
  if (mode !== "repeat") return 1;
  if (intervalMs <= 0) return 1;
  const byWindow = Math.floor(windowMs / intervalMs) + 1;
  return Math.max(2, Math.min(MAX_REPEAT_ALERTS, byWindow));
}

/** Clamp interval to a sane range for the chosen unit. */
export function normalizeSoundRepeatInterval(
  value: unknown,
  unit: SoundRepeatUnit
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SOUND_REPEAT_INTERVAL;
  const max = unit === "seconds" ? 3600 : 120;
  return Math.min(max, Math.floor(n));
}

export function normalizeSoundRepeatUnit(value: unknown): SoundRepeatUnit {
  return value === "seconds" ? "seconds" : "minutes";
}

function soundRepeatIntervalMs(prefs: ReminderSettings): number {
  const interval = normalizeSoundRepeatInterval(
    prefs.soundRepeatInterval,
    prefs.soundRepeatUnit
  );
  return prefs.soundRepeatUnit === "seconds"
    ? interval * 1000
    : interval * 60 * 1000;
}

function parseClassSessionId(identifier: string): number | null {
  const m = identifier.match(/^class-(\d+)(?:-r\d+)?$/);
  return m ? Number(m[1]) : null;
}

function isManagedReminderIdentifier(identifier: string): boolean {
  return (
    identifier === TODAY_ID ||
    identifier === UNPAID_ID ||
    identifier.startsWith(CLASS_ID_PREFIX) ||
    identifier.startsWith(`${UNPAID_ID}${REPEAT_SUFFIX}`)
  );
}

/** Stop further repeats after the user taps or dismisses an alert. */
async function stopReminderSeries(
  Notifications: NotificationsModule,
  identifier: string
): Promise<void> {
  const sessionId = parseClassSessionId(identifier);
  if (sessionId != null) {
    await cancelClassReminderGroup(Notifications, sessionId);
    return;
  }
  if (
    identifier === UNPAID_ID ||
    identifier.startsWith(`${UNPAID_ID}${REPEAT_SUFFIX}`)
  ) {
    await cancelUnpaidReminderGroup(Notifications);
  }
}

async function cancelClassReminderGroup(
  Notifications: NotificationsModule,
  sessionId: number
): Promise<void> {
  for (let i = 0; i < MAX_REPEAT_ALERTS; i++) {
    const id = classRepeatNotificationId(sessionId, i);
    await Notifications.cancelScheduledNotificationAsync(id).catch(
      () => undefined
    );
    await Notifications.dismissNotificationAsync(id).catch(() => undefined);
  }
}

async function cancelUnpaidReminderGroup(
  Notifications: NotificationsModule
): Promise<void> {
  for (let i = 0; i < MAX_REPEAT_ALERTS; i++) {
    const id = unpaidRepeatNotificationId(i);
    await Notifications.cancelScheduledNotificationAsync(id).catch(
      () => undefined
    );
    await Notifications.dismissNotificationAsync(id).catch(() => undefined);
  }
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ReminderSettings> & {
      /** Legacy key from pre-per-class reminders. */
      todayEnabled?: boolean;
    };
    return {
      classEnabled: Boolean(
        parsed.classEnabled ?? parsed.todayEnabled ?? DEFAULTS.classEnabled
      ),
      unpaidEnabled: Boolean(parsed.unpaidEnabled ?? DEFAULTS.unpaidEnabled),
      soundEnabled: Boolean(
        parsed.soundEnabled ?? DEFAULTS.soundEnabled
      ),
      soundRepeatMode:
        parsed.soundRepeatMode === "repeat" ? "repeat" : "once",
      soundRepeatUnit: normalizeSoundRepeatUnit(parsed.soundRepeatUnit),
      soundRepeatInterval: normalizeSoundRepeatInterval(
        parsed.soundRepeatInterval,
        normalizeSoundRepeatUnit(parsed.soundRepeatUnit)
      ),
      classLeadMinutes:
        typeof parsed.classLeadMinutes === "number" &&
        parsed.classLeadMinutes > 0
          ? parsed.classLeadMinutes
          : DEFAULTS.classLeadMinutes,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveReminderSettings(
  input: Partial<ReminderSettings>
): Promise<ReminderSettings> {
  const current = await loadReminderSettings();
  const merged = { ...current, ...input };
  const soundRepeatUnit = normalizeSoundRepeatUnit(merged.soundRepeatUnit);
  const next: ReminderSettings = {
    ...merged,
    soundRepeatUnit,
    soundRepeatInterval: normalizeSoundRepeatInterval(
      merged.soundRepeatInterval,
      soundRepeatUnit
    ),
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  await rescheduleReminders(next);
  return next;
}

async function ensurePermission(
  Notifications: NotificationsModule
): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureChannels(
  Notifications: NotificationsModule
): Promise<void> {
  if (Platform.OS !== "android") return;
  // Always register both sound + silent so toggling never leaves a stale channel.
  await Notifications.setNotificationChannelAsync(CLASS_CHANNEL_SOUND, {
    name: t("reminderClassChannel"),
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 180, 250],
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CLASS_CHANNEL_SILENT, {
    name: t("reminderClassChannelSilent"),
    importance: Notifications.AndroidImportance.HIGH,
    sound: undefined,
    enableVibrate: true,
    vibrationPattern: [0, 250, 180, 250],
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(UNPAID_CHANNEL_SOUND, {
    name: t("reminderUnpaidChannel"),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(UNPAID_CHANNEL_SILENT, {
    name: t("reminderUnpaidChannelSilent"),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: undefined,
    enableVibrate: true,
  });
}

/**
 * Open Android channel settings so the user can pick a reminder ringtone.
 * iOS falls back to the app’s system settings page.
 */
export async function openReminderSoundPicker(): Promise<void> {
  const { Linking } = await import("react-native");
  if (Platform.OS === "android") {
    const Notifications = getNotifications();
    if (Notifications) {
      await ensureChannels(Notifications);
    }
    try {
      const Application = await import("expo-application");
      const pkg =
        Application.applicationId ??
        "com.itqandev.digitalteachernotebook";
      await Linking.sendIntent(
        "android.settings.CHANNEL_NOTIFICATION_SETTINGS",
        [
          {
            key: "android.provider.extra.APP_PACKAGE",
            value: pkg,
          },
          {
            key: "android.provider.extra.CHANNEL_ID",
            value: CLASS_CHANNEL_SOUND,
          },
        ]
      );
      return;
    } catch {
      // Fall through to app settings if the channel intent isn’t available.
    }
  }
  await Linking.openSettings();
}

/** Drop all app-owned scheduled locals before recreating. */
async function cancelManagedNotifications(
  Notifications: NotificationsModule
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(TODAY_ID).catch(
    () => undefined
  );
  await Notifications.cancelScheduledNotificationAsync(UNPAID_ID).catch(
    () => undefined
  );
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(
    () => []
  );
  await Promise.all(
    pending
      .filter((n) => isManagedReminderIdentifier(n.identifier))
      .map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier).catch(
          () => undefined
        )
      )
  );
}

/** Fire-and-forget refresh after schedule data changes. */
export function softRescheduleReminders(): void {
  void rescheduleReminders().catch(() => undefined);
}

/** Cancel and recreate local notifications from current prefs + session data. */
export async function rescheduleReminders(
  settings?: ReminderSettings
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const prefs = settings ?? (await loadReminderSettings());
  await cancelManagedNotifications(Notifications);

  if (!prefs.classEnabled && !prefs.unpaidEnabled) return;
  const ok = await ensurePermission(Notifications);
  if (!ok) return;

  await ensureChannels(Notifications);
  const classCh = classChannelId(prefs.soundEnabled);
  const unpaidCh = unpaidChannelId(prefs.soundEnabled);
  const notifSound = prefs.soundEnabled ? "default" : false;
  const repeatMs = soundRepeatIntervalMs(prefs);
  const repeatWindowMs =
    Math.max(1, prefs.classLeadMinutes) * 60 * 1000;
  const alertCount = repeatAlertCount(
    prefs.soundRepeatMode,
    repeatMs,
    repeatWindowMs
  );

  if (prefs.classEnabled) {
    const leadMs = Math.max(1, prefs.classLeadMinutes) * 60 * 1000;
    const upcoming = await listUpcomingSessions(LOOKAHEAD_LIMIT);
    const now = Date.now();

    for (const session of upcoming) {
      const starts = parseSessionStart(session.starts_at);
      if (!starts) continue;
      const when = new Date(starts.getTime() - leadMs);
      if (when.getTime() <= now) continue;

      const content = {
        title: t("reminderClassTitle"),
        body: t("reminderClassBody", {
          group: session.group_name,
          time: formatHm(starts),
          minutes: prefs.classLeadMinutes,
        }),
        sound: notifSound,
        categoryIdentifier: REMINDER_CATEGORY_ID,
        ...(Platform.OS === "android"
          ? {
              channelId: classCh,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            }
          : null),
      };

      for (let repeatIndex = 0; repeatIndex < alertCount; repeatIndex++) {
        const fireAt = new Date(when.getTime() + repeatIndex * repeatMs);
        if (fireAt.getTime() <= now) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: classRepeatNotificationId(session.id, repeatIndex),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: classCh,
          },
        });
      }
    }
  }

  if (prefs.unpaidEnabled) {
    const unpaid = await countOutstandingUnpaidPartials();
    if (unpaid > 0) {
      const when = new Date();
      when.setDate(when.getDate() + 7);
      when.setHours(10, 0, 0, 0);
      const content = {
        title: t("reminderUnpaidTitle"),
        body: t("reminderUnpaidBodyCount", { count: unpaid }),
        sound: notifSound,
        categoryIdentifier: REMINDER_CATEGORY_ID,
        ...(Platform.OS === "android"
          ? { channelId: unpaidCh }
          : null),
      };

      for (let repeatIndex = 0; repeatIndex < alertCount; repeatIndex++) {
        const fireAt = new Date(when.getTime() + repeatIndex * repeatMs);
        if (fireAt.getTime() <= Date.now()) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: unpaidRepeatNotificationId(repeatIndex),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: unpaidCh,
          },
        });
      }
    }
  }
}
