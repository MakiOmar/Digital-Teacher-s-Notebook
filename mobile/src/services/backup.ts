import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getDb, reopenDb, withTransaction } from "../db/client";
import { SCHEMA_SQL } from "../db/schema";
import { t } from "../i18n/ar";

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

/** Yield to the JS event loop so React can paint progress. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type BackupPayload = {
  version: 1;
  exported_at: string;
  tables: Record<string, unknown[]>;
};

export type BackupProgressPhase =
  | "read"
  | "parse"
  | "clear"
  | "insert"
  | "export"
  | "write";

export type BackupProgress = {
  phase: BackupProgressPhase;
  done: number;
  total: number;
  /** 0–100 */
  percent: number;
};

export type BackupProgressCallback = (p: BackupProgress) => void;

function report(
  onProgress: BackupProgressCallback | undefined,
  phase: BackupProgressPhase,
  done: number,
  total: number,
  /** Map phase-local progress into overall 0–100 band */
  bandStart: number,
  bandEnd: number
) {
  if (!onProgress) return;
  const local = total <= 0 ? 1 : done / total;
  const percent = Math.max(
    0,
    Math.min(100, Math.round(bandStart + local * (bandEnd - bandStart)))
  );
  onProgress({ phase, done, total, percent });
}

export async function buildBackup(
  onProgress?: BackupProgressCallback
): Promise<BackupPayload> {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  const total = TABLES.length;
  for (let i = 0; i < TABLES.length; i++) {
    const table = TABLES[i];
    tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
    report(onProgress, "export", i + 1, total, 0, 70);
    if ((i + 1) % 2 === 0) await yieldToUi();
  }
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export async function exportBackupFile(
  onProgress?: BackupProgressCallback
): Promise<string> {
  const payload = await buildBackup(onProgress);
  report(onProgress, "write", 0, 1, 70, 85);
  await yieldToUi();
  // Compact JSON — much faster/smaller than pretty-print for large DBs
  const json = JSON.stringify(payload);
  report(onProgress, "write", 1, 2, 85, 95);
  await yieldToUi();
  const name = `tutoring-backup-${Date.now()}.json`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("لا يمكن الوصول لمجلد الملفات");
  const path = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  report(onProgress, "write", 2, 2, 95, 100);
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

/** Strip BOM / nulls and reject obvious non-JSON (e.g. Arabic text files). */
function normalizeBackupRaw(raw: string): string {
  return raw.replace(/^\uFEFF/, "").replace(/^\u0000+/, "").trim();
}

function parseBackupPayload(raw: string): BackupPayload {
  const text = normalizeBackupRaw(raw);
  if (!text.startsWith("{")) {
    throw new Error(t("backupInvalidJson"));
  }
  let payload: BackupPayload;
  try {
    payload = JSON.parse(text) as BackupPayload;
  } catch {
    throw new Error(t("backupInvalidJson"));
  }
  if (!payload?.tables || payload.version !== 1) {
    throw new Error(t("backupInvalidFormat"));
  }
  return payload;
}

/**
 * Read backup text from file:// or content:// URIs.
 * Some Android SAF providers return non-JSON via readAsStringAsync; fetch is a fallback.
 */
async function readBackupText(uri: string): Promise<string> {
  let fromFs = "";
  try {
    fromFs = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const trimmed = normalizeBackupRaw(fromFs);
    if (trimmed.startsWith("{")) return fromFs;
  } catch {
    // try fetch below
  }

  try {
    const res = await fetch(uri);
    const text = await res.text();
    if (text.length > 0) return text;
  } catch {
    // ignore
  }

  if (fromFs.length > 0) return fromFs;
  throw new Error(t("backupReadFailed"));
}

export async function importBackupFromUri(
  uri: string,
  onProgress?: BackupProgressCallback
): Promise<void> {
  if (!uri?.trim()) throw new Error(t("backupReadFailed"));

  report(onProgress, "read", 0, 1, 0, 5);
  await yieldToUi();
  const raw = await readBackupText(uri);
  report(onProgress, "read", 1, 1, 5, 10);
  await yieldToUi();

  report(onProgress, "parse", 0, 1, 10, 18);
  await yieldToUi();
  const payload = parseBackupPayload(raw);
  report(onProgress, "parse", 1, 1, 18, 20);
  await yieldToUi();

  await restoreBackup(payload, onProgress);
}

export async function importBackupFromPicker(
  onProgress?: BackupProgressCallback
): Promise<void> {
  // Broad types: SAF auto-backups are often stored as octet-stream, not application/json.
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/json",
      "text/json",
      "text/plain",
      "application/octet-stream",
      "*/*",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) {
    throw new Error("تم إلغاء الاختيار");
  }
  await importBackupFromUri(result.assets[0].uri, onProgress);
}

/** SQLite default max variables ~999; keep headroom for multi-column rows. */
const MAX_VARS = 900;
/** Yield every N rows so UI progress can paint. */
const YIELD_EVERY = 250;

async function restoreBackup(
  payload: BackupPayload,
  onProgress?: BackupProgressCallback
): Promise<void> {
  const totalRows = TABLES.reduce(
    (sum, table) => sum + (payload.tables[table]?.length ?? 0),
    0
  );
  let inserted = 0;

  // Clear existing data in one short write (no event-loop yields while locked).
  await withTransaction(async (db) => {
    const dropOrder = [...TABLES].reverse();
    report(onProgress, "clear", 0, dropOrder.length, 20, 28);
    for (let i = 0; i < dropOrder.length; i++) {
      await db.execAsync(`DELETE FROM ${dropOrder[i]}`);
      report(onProgress, "clear", i + 1, dropOrder.length, 20, 28);
    }
  });
  await yieldToUi();

  // Insert in small committed chunks so the UI can paint and other reads wait
  // via busy_timeout instead of contending on one long open transaction.
  for (const table of TABLES) {
    const rows = (payload.tables[table] ?? []) as Record<string, unknown>[];
    if (!rows.length) continue;

    const keys = Object.keys(rows[0] ?? {});
    if (!keys.length) continue;
    const cols = keys.join(", ");
    const oneRow = `(${keys.map(() => "?").join(", ")})`;
    const batchSize = Math.max(1, Math.floor(MAX_VARS / keys.length));

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const valuesSql = chunk.map(() => oneRow).join(", ");
      const params = chunk.flatMap((r) =>
        keys.map((k) => (r[k] as string | number | null) ?? null)
      );
      await withTransaction(async (db) => {
        await db.runAsync(
          `INSERT INTO ${table} (${cols}) VALUES ${valuesSql}`,
          params
        );
      });
      inserted += chunk.length;
      report(onProgress, "insert", inserted, Math.max(totalRows, 1), 28, 98);
      if (inserted % YIELD_EVERY < batchSize) {
        await yieldToUi();
      }
    }
  }

  report(onProgress, "insert", totalRows, Math.max(totalRows, 1), 98, 100);
  await yieldToUi();
  const db = await reopenDb();
  await db.execAsync(SCHEMA_SQL);
  report(onProgress, "insert", totalRows, Math.max(totalRows, 1), 100, 100);
}
