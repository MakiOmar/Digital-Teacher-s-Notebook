import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "./schema";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Serialize write transactions so concurrent BEGIN/COMMIT never race. */
let writeGate: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeGate.then(fn, fn);
  writeGate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function tableColumns(
  db: SQLite.SQLiteDatabase,
  table: string
): Promise<Set<string>> {
  const cols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  return new Set(cols.map((c) => c.name));
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const semesterCols = await tableColumns(db, "semesters");
  if (!semesterCols.has("start_date")) {
    await db.execAsync(
      "ALTER TABLE semesters ADD COLUMN start_date TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!semesterCols.has("end_date")) {
    await db.execAsync(
      "ALTER TABLE semesters ADD COLUMN end_date TEXT NOT NULL DEFAULT ''"
    );
  }

  const groupCols = await tableColumns(db, "groups");
  if (!groupCols.has("classes_per_round")) {
    await db.execAsync(
      "ALTER TABLE groups ADD COLUMN classes_per_round INTEGER NOT NULL DEFAULT 4"
    );
  }
  if (!groupCols.has("accent_color")) {
    await db.execAsync("ALTER TABLE groups ADD COLUMN accent_color TEXT");
  }
  if (!groupCols.has("start_date")) {
    await db.execAsync("ALTER TABLE groups ADD COLUMN start_date TEXT");
  }
  if (!groupCols.has("end_date")) {
    await db.execAsync("ALTER TABLE groups ADD COLUMN end_date TEXT");
  }

  const sessionCols = await tableColumns(db, "group_sessions");
  if (!sessionCols.has("star_student_id")) {
    await db.execAsync(
      "ALTER TABLE group_sessions ADD COLUMN star_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL"
    );
  }
  if (!sessionCols.has("notes")) {
    await db.execAsync("ALTER TABLE group_sessions ADD COLUMN notes TEXT");
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS billing_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      target_classes INTEGER NOT NULL,
      counted_classes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      UNIQUE(group_id, student_id, round_number)
    );
  `);

  const paymentCols = await tableColumns(db, "payments");
  if (!paymentCols.has("billing_round_id")) {
    await db.execAsync(
      "ALTER TABLE payments ADD COLUMN billing_round_id INTEGER REFERENCES billing_rounds(id) ON DELETE SET NULL"
    );
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_payments_round ON payments(billing_round_id);
    CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id);
    CREATE INDEX IF NOT EXISTS idx_attendances_student ON attendances(student_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_patterns_group ON group_schedule_patterns(group_id);
    CREATE INDEX IF NOT EXISTS idx_rounds_student ON billing_rounds(student_id);
    CREATE INDEX IF NOT EXISTS idx_rounds_group ON billing_rounds(group_id);
    CREATE INDEX IF NOT EXISTS idx_rounds_open ON billing_rounds(status);
    CREATE INDEX IF NOT EXISTS idx_rounds_student_group_status
      ON billing_rounds(student_id, group_id, status);
    CREATE INDEX IF NOT EXISTS idx_rounds_group_status
      ON billing_rounds(group_id, status);
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS round_stars (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, round_number)
    );
  `);

  // Seed open round #1 for active enrollments missing a round
  await db.execAsync(`
    INSERT INTO billing_rounds (group_id, student_id, round_number, target_classes, counted_classes, status)
    SELECT e.group_id, e.student_id, 1, COALESCE(g.classes_per_round, 4), 0, 'open'
    FROM enrollments e
    JOIN groups g ON g.id = e.group_id
    JOIN students s ON s.id = e.student_id
    WHERE e.status = 'active' AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM billing_rounds br
        WHERE br.group_id = e.group_id AND br.student_id = e.student_id AND br.status = 'open'
      )
      AND NOT EXISTS (
        SELECT 1 FROM billing_rounds br2
        WHERE br2.group_id = e.group_id AND br2.student_id = e.student_id
      );
  `);
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("tutoring_manager.db");
      // Readers can proceed while a writer is mid-flight; wait instead of fail.
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 8000;
      `);
      await db.execAsync(SCHEMA_SQL);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Reset module-level DB handle after full replace (import backup). */
export async function reopenDb(): Promise<SQLite.SQLiteDatabase> {
  return enqueueWrite(async () => {
    if (dbPromise) {
      try {
        const existing = await dbPromise;
        await existing.closeAsync();
      } catch {
        // ignore
      }
    }
    dbPromise = null;
    return getDb();
  });
}

export async function withTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  return enqueueWrite(async () => {
    const db = await getDb();
    // IMMEDIATE grabs the write lock up front (avoids upgrade deadlocks).
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      const result = await fn(db);
      await db.execAsync("COMMIT");
      return result;
    } catch (e) {
      try {
        await db.execAsync("ROLLBACK");
      } catch {
        // ignore rollback failures after a hard lock/abort
      }
      throw e;
    }
  });
}
