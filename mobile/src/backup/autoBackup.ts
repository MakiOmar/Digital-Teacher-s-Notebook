import AsyncStorage from "@react-native-async-storage/async-storage";
import { writeBackupToLocation, type BackupFileMode } from "./backupLocation";

const SETTINGS_KEY = "tutor.autobackup.v1";
const ON_EDIT_DEBOUNCE_MS = 2500;

export type AutoBackupFrequency = "daily" | "weekly";

export type AutoBackupSettings = {
  enabled: boolean;
  frequency: AutoBackupFrequency;
  /** Overwrite one stable file vs create timestamped files. */
  fileMode: BackupFileMode;
  /** Also run a silent backup after data changes (debounced). */
  onEveryEdit: boolean;
  lastRunAt: string | null;
  lastPath: string | null;
  /** Android SAF directory URI for silent auto-backups; null = app storage. */
  directoryUri: string | null;
  directoryLabel: string | null;
};

const DEFAULTS: AutoBackupSettings = {
  enabled: false,
  frequency: "daily",
  fileMode: "new",
  onEveryEdit: false,
  lastRunAt: null,
  lastPath: null,
  directoryUri: null,
  directoryLabel: null,
};

export async function loadAutoBackupSettings(): Promise<AutoBackupSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AutoBackupSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      frequency: parsed.frequency === "weekly" ? "weekly" : "daily",
      fileMode: parsed.fileMode === "replace" ? "replace" : "new",
      onEveryEdit: Boolean(parsed.onEveryEdit),
      lastRunAt:
        typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null,
      lastPath: typeof parsed.lastPath === "string" ? parsed.lastPath : null,
      directoryUri:
        typeof parsed.directoryUri === "string" ? parsed.directoryUri : null,
      directoryLabel:
        typeof parsed.directoryLabel === "string"
          ? parsed.directoryLabel
          : null,
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
    fileMode:
      input.fileMode === "replace" || input.fileMode === "new"
        ? input.fileMode
        : current.fileMode,
    onEveryEdit:
      input.onEveryEdit !== undefined
        ? Boolean(input.onEveryEdit)
        : current.onEveryEdit,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function intervalMs(frequency: AutoBackupFrequency): number {
  return frequency === "weekly"
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
}

/** Schedule-based due check (daily/weekly). Ignores onEveryEdit. */
export function isAutoBackupDue(settings: AutoBackupSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.lastRunAt) return true;
  const ts = Date.parse(settings.lastRunAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= intervalMs(settings.frequency);
}

async function performAutoBackup(
  settings: AutoBackupSettings
): Promise<string> {
  const path = await writeBackupToLocation(
    settings.directoryUri,
    "auto-backup",
    settings.fileMode
  );
  await saveAutoBackupSettings({
    lastRunAt: new Date().toISOString(),
    lastPath: path,
  });
  return path;
}

/** Run silent backup when enabled and schedule-due. Returns path or null if skipped. */
export async function runAutoBackupIfDue(): Promise<string | null> {
  const settings = await loadAutoBackupSettings();
  if (!isAutoBackupDue(settings)) return null;
  return performAutoBackup(settings);
}

let onEditTimer: ReturnType<typeof setTimeout> | null = null;
let onEditRunning = false;
let onEditQueued = false;

async function runOnEditBackupNow(): Promise<void> {
  if (onEditRunning) {
    onEditQueued = true;
    return;
  }
  onEditRunning = true;
  try {
    const settings = await loadAutoBackupSettings();
    if (!settings.enabled || !settings.onEveryEdit) return;
    await performAutoBackup(settings);
  } catch {
    // Silent — never block UI on auto-backup failures
  } finally {
    onEditRunning = false;
    if (onEditQueued) {
      onEditQueued = false;
      void runOnEditBackupNow();
    }
  }
}

/**
 * Debounced silent backup after data mutations.
 * No-op unless auto-backup is enabled and onEveryEdit is on.
 */
export function scheduleAutoBackupOnEdit(): void {
  if (onEditTimer) clearTimeout(onEditTimer);
  onEditTimer = setTimeout(() => {
    onEditTimer = null;
    void runOnEditBackupNow();
  }, ON_EDIT_DEBOUNCE_MS);
}
