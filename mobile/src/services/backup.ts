import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getDb, reopenDb, withTransaction } from "../db/client";
import { SCHEMA_SQL } from "../db/schema";

const TABLES = [
  "academic_years",
  "semesters",
  "study_months",
  "groups",
  "group_schedule_patterns",
  "students",
  "enrollments",
  "group_sessions",
  "attendances",
  "billing_rounds",
  "round_stars",
  "payments",
] as const;

export type BackupPayload = {
  version: 1;
  exported_at: string;
  tables: Record<string, unknown[]>;
};

export async function buildBackup(): Promise<BackupPayload> {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export async function exportBackupFile(): Promise<string> {
  const payload = await buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const name = `tutoring-backup-${Date.now()}.json`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("لا يمكن الوصول لمجلد الملفات");
  const path = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      dialogTitle: "تصدير نسخة احتياطية",
    });
  }
  return path;
}

/**
 * Silent on-device backup (no share sheet) for auto-backup.
 * Writes under documentDirectory/backups/.
 * Prefer writeBackupToLocation in backupLocation.ts when a user folder may be set.
 */
export async function writeBackupToDocuments(
  prefix = "auto-backup"
): Promise<string> {
  const { writeBackupToLocation } = await import("../backup/backupLocation");
  return writeBackupToLocation(null, prefix);
}

export async function importBackupFromPicker(): Promise<void> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    throw new Error("تم إلغاء الاختيار");
  }
  const uri = result.assets[0].uri;
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const payload = JSON.parse(raw) as BackupPayload;
  if (!payload?.tables || payload.version !== 1) {
    throw new Error("ملف النسخة الاحتياطية غير صالح");
  }
  await restoreBackup(payload);
}

async function restoreBackup(payload: BackupPayload): Promise<void> {
  await withTransaction(async (db) => {
    const dropOrder = [...TABLES].reverse();
    for (const t of dropOrder) {
      await db.execAsync(`DELETE FROM ${t}`);
    }

    for (const t of TABLES) {
      const rows = payload.tables[t] ?? [];
      for (const row of rows) {
        const obj = row as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (!keys.length) continue;
        const placeholders = keys.map(() => "?").join(", ");
        const cols = keys.join(", ");
        await db.runAsync(
          `INSERT INTO ${t} (${cols}) VALUES (${placeholders})`,
          keys.map((k) => obj[k] as string | number | null)
        );
      }
    }
  });
  const db = await reopenDb();
  await db.execAsync(SCHEMA_SQL);
}
