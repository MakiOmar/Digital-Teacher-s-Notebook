import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { t } from "../i18n/ar";
import { listUpcomingSessions } from "../repositories";
import { getOpenRoundsPaymentSummary } from "../services/rounds";

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

export type ReminderSettings = {
  /** Alert before each upcoming class (default on). */
  classEnabled: boolean;
  unpaidEnabled: boolean;
  /** Play notification sound (default on). */
  soundEnabled: boolean;
  /** Minutes before `starts_at` (fixed at 30 for now). */
  classLeadMinutes: number;
};

const DEFAULTS: ReminderSettings = {
  classEnabled: true,
  unpaidEnabled: false,
  soundEnabled: true,
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

initHandler();

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
  const next = { ...current, ...input };
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
      .filter(
        (n) =>
          n.identifier === TODAY_ID ||
          n.identifier === UNPAID_ID ||
          n.identifier.startsWith(CLASS_ID_PREFIX)
      )
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

  if (prefs.classEnabled) {
    const leadMs = Math.max(1, prefs.classLeadMinutes) * 60 * 1000;
    const upcoming = await listUpcomingSessions(LOOKAHEAD_LIMIT);
    const now = Date.now();

    for (const session of upcoming) {
      const starts = parseSessionStart(session.starts_at);
      if (!starts) continue;
      const when = new Date(starts.getTime() - leadMs);
      if (when.getTime() <= now) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: classNotificationId(session.id),
        content: {
          title: t("reminderClassTitle"),
          body: t("reminderClassBody", {
            group: session.group_name,
            time: formatHm(starts),
            minutes: prefs.classLeadMinutes,
          }),
          sound: notifSound,
          ...(Platform.OS === "android"
            ? {
                channelId: classCh,
                priority: Notifications.AndroidNotificationPriority.HIGH,
              }
            : null),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: classCh,
        },
      });
    }
  }

  if (prefs.unpaidEnabled) {
    const summary = await getOpenRoundsPaymentSummary();
    const unpaid = summary.dues.filter(
      (d) => d.status === "unpaid" || d.status === "partial"
    ).length;
    if (unpaid > 0) {
      const when = new Date();
      when.setDate(when.getDate() + 7);
      when.setHours(10, 0, 0, 0);
      await Notifications.scheduleNotificationAsync({
        identifier: UNPAID_ID,
        content: {
          title: t("reminderUnpaidTitle"),
          body: t("reminderUnpaidBodyCount", { count: unpaid }),
          sound: notifSound,
          ...(Platform.OS === "android"
            ? { channelId: unpaidCh }
            : null),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: unpaidCh,
        },
      });
    }
  }
}
