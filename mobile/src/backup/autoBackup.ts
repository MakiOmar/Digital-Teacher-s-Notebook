import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { writeBackupToDocuments } from "../services/backup";

const SETTINGS_KEY = "tutor.autobackup.v1";
const KEEP_COUNT = 5;

export type AutoBackupFrequency = "daily" | "weekly";

export type AutoBackupSettings = {
  enabled: boolean;
  frequency: AutoBackupFrequency;
  lastRunAt: string | null;
  lastPath: string | null;
};

const DEFAULTS: AutoBackupSettings = {
  enabled: false,
  frequency: "daily",
  lastRunAt: null,
  lastPath: null,
};

export async function loadAutoBackupSettings(): Promise<AutoBackupSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AutoBackupSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      frequency: parsed.frequency === "weekly" ? "weekly" : "daily",
      lastRunAt:
        typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null,
      lastPath: typeof parsed.lastPath === "string" ? parsed.lastPath : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAutoBackupSettings(
  input: Partial<AutoBackupSettings>
): Promise<AutoBackupSettings> {
  const current = await loadAutoBackupSettings();
  const next: AutoBackupSettings = {
    ...current,
    ...input,
    frequency:
      input.frequency === "weekly" || input.frequency === "daily"
        ? input.frequency
        : current.frequency,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function intervalMs(frequency: AutoBackupFrequency): number {
  return frequency === "weekly"
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
}

export function isAutoBackupDue(settings: AutoBackupSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.lastRunAt) return true;
  const ts = Date.parse(settings.lastRunAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= intervalMs(settings.frequency);
}

async function pruneOldBackups(dir: string): Promise<void> {
  const listing = await FileSystem.readDirectoryAsync(dir);
  const files = listing
    .filter((f) => f.startsWith("auto-backup-") && f.endsWith(".json"))
    .sort()
    .reverse();
  for (const old of files.slice(KEEP_COUNT)) {
    await FileSystem.deleteAsync(`${dir}${old}`, { idempotent: true });
  }
}

/** Run silent backup when enabled and due. Returns path or null if skipped. */
export async function runAutoBackupIfDue(): Promise<string | null> {
  const settings = await loadAutoBackupSettings();
  if (!isAutoBackupDue(settings)) return null;

  const path = await writeBackupToDocuments("auto-backup");
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  await pruneOldBackups(dir);

  await saveAutoBackupSettings({
    lastRunAt: new Date().toISOString(),
    lastPath: path,
  });
  return path;
}
