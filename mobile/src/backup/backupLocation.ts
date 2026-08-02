import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { buildBackup } from "../services/backup";

const KEEP_COUNT = 5;

/** Human-readable label from a SAF or file URI. */
export function folderLabelFromUri(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const parts = decoded.split(/[/:]/).filter(Boolean);
    return parts[parts.length - 1] || uri;
  } catch {
    return uri;
  }
}

/** Whether the OS can pick a persistent writable folder (Android SAF). */
export function canPickBackupFolder(): boolean {
  return Platform.OS === "android";
}

/**
 * Ask the user to pick a folder for auto-backups (Android Storage Access Framework).
 * Returns null if cancelled or unavailable.
 */
export async function pickBackupFolder(): Promise<{
  uri: string;
  label: string;
} | null> {
  if (!canPickBackupFolder()) {
    throw new Error("folder_picker_unavailable");
  }
  const result =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted || !result.directoryUri) return null;
  return {
    uri: result.directoryUri,
    label: folderLabelFromUri(result.directoryUri),
  };
}

async function ensureAppBackupsDir(): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("لا يمكن الوصول لمجلد الملفات");
  const dir = `${root}backups/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function pruneAppDir(dir: string): Promise<void> {
  const listing = await FileSystem.readDirectoryAsync(dir);
  const files = listing
    .filter((f) => f.startsWith("auto-backup-") && f.endsWith(".json"))
    .sort()
    .reverse();
  for (const old of files.slice(KEEP_COUNT)) {
    await FileSystem.deleteAsync(`${dir}${old}`, { idempotent: true });
  }
}

async function pruneSafDir(directoryUri: string): Promise<void> {
  try {
    const listing =
      await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
    const files = listing
      .filter((u) => {
        const name = folderLabelFromUri(u).toLowerCase();
        return name.includes("auto-backup-") && name.endsWith(".json");
      })
      .sort()
      .reverse();
    for (const old of files.slice(KEEP_COUNT)) {
      await FileSystem.deleteAsync(old, { idempotent: true });
    }
  } catch {
    // Best-effort prune; ignore SAF listing errors
  }
}

/**
 * Write a silent backup JSON.
 * Uses the chosen SAF folder when set; otherwise app documents/backups.
 */
export async function writeBackupToLocation(
  directoryUri: string | null,
  prefix = "auto-backup"
): Promise<string> {
  const payload = await buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const fileName = `${prefix}-${Date.now()}.json`;

  if (directoryUri && Platform.OS === "android") {
    const fileUri =
      await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        fileName,
        "application/json"
      );
    await FileSystem.writeAsStringAsync(fileUri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await pruneSafDir(directoryUri);
    return fileUri;
  }

  const dir = await ensureAppBackupsDir();
  const path = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await pruneAppDir(dir);
  return path;
}
