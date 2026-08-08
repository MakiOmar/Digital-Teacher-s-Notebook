import { Platform } from "react-native";
import * as LegacyFS from "expo-file-system/legacy";
import { Directory } from "expo-file-system";
import { buildBackup } from "../services/backup";

const KEEP_COUNT = 5;
const LATEST_NAME = "auto-backup-latest.json";

export type BackupFileMode = "replace" | "new";

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

/** Folder picker is available on Android (persistent) and iOS (session-scoped). */
export function canPickBackupFolder(): boolean {
  return Platform.OS === "android" || Platform.OS === "ios";
}

/**
 * Ask the user to pick a folder for auto-backups.
 * Android: SAF with lasting permission.
 * iOS: Files picker; access lasts for the current app session (Apple limitation).
 */
export async function pickBackupFolder(): Promise<{
  uri: string;
  label: string;
} | null> {
  if (!canPickBackupFolder()) {
    throw new Error("folder_picker_unavailable");
  }

  if (Platform.OS === "android") {
    const result =
      await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted || !result.directoryUri) return null;
    return {
      uri: result.directoryUri,
      label: folderLabelFromUri(result.directoryUri),
    };
  }

  // iOS (and any other platform with the new Directory picker)
  try {
    const directory = await Directory.pickDirectoryAsync();
    if (!directory?.uri) return null;
    return {
      uri: directory.uri,
      label: directory.name || folderLabelFromUri(directory.uri),
    };
  } catch {
    return null;
  }
}

async function ensureAppBackupsDir(): Promise<string> {
  const root = LegacyFS.documentDirectory;
  if (!root) throw new Error("لا يمكن الوصول لمجلد الملفات");
  const dir = `${root}backups/`;
  const info = await LegacyFS.getInfoAsync(dir);
  if (!info.exists) {
    await LegacyFS.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function pruneAppDir(dir: string): Promise<void> {
  const listing = await LegacyFS.readDirectoryAsync(dir);
  const files = listing
    .filter((f) => f.startsWith("auto-backup-") && f.endsWith(".json"))
    .filter((f) => f !== LATEST_NAME)
    .sort()
    .reverse();
  for (const old of files.slice(KEEP_COUNT)) {
    await LegacyFS.deleteAsync(`${dir}${old}`, { idempotent: true });
  }
}

async function pruneSafDir(directoryUri: string): Promise<void> {
  try {
    const listing =
      await LegacyFS.StorageAccessFramework.readDirectoryAsync(directoryUri);
    const files = listing
      .filter((u) => {
        const name = folderLabelFromUri(u).toLowerCase();
        return (
          name.includes("auto-backup-") &&
          name.endsWith(".json") &&
          name !== LATEST_NAME
        );
      })
      .sort()
      .reverse();
    for (const old of files.slice(KEEP_COUNT)) {
      await LegacyFS.deleteAsync(old, { idempotent: true });
    }
  } catch {
    // Best-effort prune
  }
}

async function prunePickedDirectory(directoryUri: string): Promise<void> {
  try {
    const dir = new Directory(directoryUri);
    const entries = dir.list();
    const files = entries
      .filter((e) => {
        const name = ("name" in e ? e.name : "").toLowerCase();
        return (
          name.includes("auto-backup-") &&
          name.endsWith(".json") &&
          name !== LATEST_NAME
        );
      })
      .sort((a, b) => {
        const an = "name" in a ? a.name : "";
        const bn = "name" in b ? b.name : "";
        return bn.localeCompare(an);
      });
    for (const old of files.slice(KEEP_COUNT)) {
      try {
        if ("delete" in old && typeof old.delete === "function") {
          old.delete();
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // Best-effort prune
  }
}

async function findSafFileByName(
  directoryUri: string,
  fileName: string
): Promise<string | null> {
  try {
    const listing =
      await LegacyFS.StorageAccessFramework.readDirectoryAsync(directoryUri);
    const target = fileName.toLowerCase();
    for (const uri of listing) {
      if (folderLabelFromUri(uri).toLowerCase() === target) return uri;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Write into a user-picked Directory (iOS Files / modern FS API). */
function writeToPickedDirectory(
  directoryUri: string,
  fileName: string,
  json: string,
  replace: boolean
): string {
  const dir = new Directory(directoryUri);
  if (replace) {
    try {
      const entries = dir.list();
      for (const e of entries) {
        const name = "name" in e ? e.name : "";
        if (name === fileName && "delete" in e && typeof e.delete === "function") {
          e.delete();
        }
      }
    } catch {
      // ignore
    }
  }
  const file = dir.createFile(fileName, "application/json");
  file.write(json);
  return file.uri;
}

/**
 * Write a silent backup JSON.
 * Uses the chosen folder when set; otherwise app documents/backups.
 */
export async function writeBackupToLocation(
  directoryUri: string | null,
  prefix = "auto-backup",
  fileMode: BackupFileMode = "new"
): Promise<string> {
  const payload = await buildBackup();
  // Compact JSON keeps auto-backup fast on large datasets
  const json = JSON.stringify(payload);
  const replace = fileMode === "replace";
  const fileName = replace ? LATEST_NAME : `${prefix}-${Date.now()}.json`;

  if (directoryUri) {
    try {
      if (Platform.OS === "android") {
        let fileUri: string | null = null;
        if (replace) {
          fileUri = await findSafFileByName(directoryUri, fileName);
        }
        if (!fileUri) {
          fileUri = await LegacyFS.StorageAccessFramework.createFileAsync(
            directoryUri,
            fileName,
            "application/json"
          );
        }
        await LegacyFS.writeAsStringAsync(fileUri, json, {
          encoding: LegacyFS.EncodingType.UTF8,
        });
        if (!replace) await pruneSafDir(directoryUri);
        return fileUri;
      }

      // iOS picked folder (session-scoped security access)
      const uri = writeToPickedDirectory(
        directoryUri,
        fileName,
        json,
        replace
      );
      if (!replace) await prunePickedDirectory(directoryUri);
      return uri;
    } catch {
      // Access expired (common on iOS after restart) → fall back to app storage
    }
  }

  const dir = await ensureAppBackupsDir();
  const path = `${dir}${fileName}`;
  await LegacyFS.writeAsStringAsync(path, json, {
    encoding: LegacyFS.EncodingType.UTF8,
  });
  if (!replace) await pruneAppDir(dir);
  return path;
}
