import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { listTodaysSessions } from "../repositories";
import { getOpenRoundsPaymentSummary } from "../services/rounds";

const SETTINGS_KEY = "tutor.reminders.v1";
const TODAY_ID = "reminder-today-sessions";
const UNPAID_ID = "reminder-weekly-unpaid";

export type ReminderSettings = {
  todayEnabled: boolean;
  unpaidEnabled: boolean;
};

const DEFAULTS: ReminderSettings = {
  todayEnabled: false,
  unpaidEnabled: false,
};

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
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

initHandler();

export function remindersAvailableInThisRuntime(): boolean {
  return !notificationsBlocked;
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      todayEnabled: Boolean(parsed.todayEnabled),
      unpaidEnabled: Boolean(parsed.unpaidEnabled),
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

/** Cancel and recreate local notifications from current prefs + data. */
export async function rescheduleReminders(
  settings?: ReminderSettings
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const prefs = settings ?? (await loadReminderSettings());
  await Notifications.cancelScheduledNotificationAsync(TODAY_ID).catch(
    () => undefined
  );
  await Notifications.cancelScheduledNotificationAsync(UNPAID_ID).catch(
    () => undefined
  );

  if (!prefs.todayEnabled && !prefs.unpaidEnabled) return;
  const ok = await ensurePermission(Notifications);
  if (!ok) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "التذكيرات",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (prefs.todayEnabled) {
    const today = await listTodaysSessions();
    if (today.length > 0) {
      // Fire ~30 minutes from now if still morning-ish, else next calendar day 8:00
      const when = new Date();
      when.setMinutes(when.getMinutes() + 30);
      await Notifications.scheduleNotificationAsync({
        identifier: TODAY_ID,
        content: {
          title: "حصص اليوم",
          body: `لديك ${today.length} حصة اليوم. راجع جدول اليوم.`,
          ...(Platform.OS === "android" ? { channelId: "reminders" } : null),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
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
          title: "مستحقات معلّقة",
          body: `هناك ${unpaid} طالب بحاجة للمتابعة. راجع المدفوعات.`,
          ...(Platform.OS === "android" ? { channelId: "reminders" } : null),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
    }
  }
}
