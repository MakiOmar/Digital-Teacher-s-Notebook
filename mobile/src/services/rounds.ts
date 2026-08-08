import { getDb, withTransaction } from "../db/client";
import type {
  AttendanceStatus,
  BillingRound,
  PaymentStatus,
  StudentDueRow,
} from "../db/types";
import type { SQLiteDatabase } from "expo-sqlite";

export function isCountableAttendance(status: AttendanceStatus): boolean {
  return status === "present" || status === "absent_unexcused";
}

function statusFor(due: number, paid: number): PaymentStatus {
  if (due <= 0) return "paid";
  if (paid <= 0) return "unpaid";
  if (paid + 0.001 >= due) return "paid";
  return "partial";
}

async function ensureOpenRoundOn(
  db: SQLiteDatabase,
  studentId: number,
  groupId: number,
  classesPerRound: number
): Promise<BillingRound> {
  const existing = await db.getFirstAsync<BillingRound>(
    `SELECT * FROM billing_rounds
     WHERE student_id = ? AND group_id = ? AND status = 'open'
     ORDER BY round_number DESC LIMIT 1`,
    [studentId, groupId]
  );
  if (existing) return existing;

  const last = await db.getFirstAsync<{ round_number: number }>(
    `SELECT round_number FROM billing_rounds
     WHERE student_id = ? AND group_id = ?
     ORDER BY round_number DESC LIMIT 1`,
    [studentId, groupId]
  );
  const nextNum = (last?.round_number ?? 0) + 1;
  const r = await db.runAsync(
    `INSERT INTO billing_rounds
     (group_id, student_id, round_number, target_classes, counted_classes, status, started_at)
     VALUES (?, ?, ?, ?, 0, 'open', datetime('now'))`,
    [groupId, studentId, nextNum, classesPerRound]
  );
  const created = await db.getFirstAsync<BillingRound>(
    "SELECT * FROM billing_rounds WHERE id = ?",
    [Number(r.lastInsertRowId)]
  );
  if (!created) throw new Error("تعذر إنشاء الشهر");
  return created;
}

export async function ensureOpenRound(
  studentId: number,
  groupId: number
): Promise<BillingRound> {
  const db = await getDb();
  const group = await db.getFirstAsync<{ classes_per_round: number }>(
    "SELECT classes_per_round FROM groups WHERE id = ?",
    [groupId]
  );
  return ensureOpenRoundOn(
    db,
    studentId,
    groupId,
    group?.classes_per_round ?? 4
  );
}

/**
 * Apply closed/open round counters from a chronological countable list
 * (already sliced past closed rounds' targets).
 */
async function applyCountableToOpenRound(
  db: SQLiteDatabase,
  studentId: number,
  groupId: number,
  classesPerRound: number,
  remaining: number[],
  open: BillingRound
): Promise<BillingRound> {
  let current = open;
  const queue = [...remaining];

  while (queue.length >= current.target_classes) {
    await db.runAsync(
      `UPDATE billing_rounds
       SET counted_classes = ?, status = 'closed', closed_at = datetime('now')
       WHERE id = ?`,
      [current.target_classes, current.id]
    );
    queue.splice(0, current.target_classes);

    const r = await db.runAsync(
      `INSERT INTO billing_rounds
       (group_id, student_id, round_number, target_classes, counted_classes, status, started_at)
       VALUES (?, ?, ?, ?, 0, 'open', datetime('now'))`,
      [groupId, studentId, current.round_number + 1, classesPerRound]
    );
    const next = await db.getFirstAsync<BillingRound>(
      "SELECT * FROM billing_rounds WHERE id = ?",
      [Number(r.lastInsertRowId)]
    );
    if (!next) break;
    current = next;
  }

  const counted = queue.length;
  await db.runAsync(
    `UPDATE billing_rounds SET counted_classes = ? WHERE id = ?`,
    [counted, current.id]
  );
  const updated = await db.getFirstAsync<BillingRound>(
    "SELECT * FROM billing_rounds WHERE id = ?",
    [current.id]
  );
  return updated ?? current;
}

/**
 * Rebuild open-round progress from countable attendances in the group.
 * Closed rounds "consume" their target_classes from the chronological list.
 */
export async function syncRoundProgressForStudent(
  studentId: number,
  groupId: number
): Promise<BillingRound> {
  return withTransaction(async (db) => {
    const group = await db.getFirstAsync<{ classes_per_round: number }>(
      "SELECT classes_per_round FROM groups WHERE id = ?",
      [groupId]
    );
    const classesPerRound = group?.classes_per_round ?? 4;
    let open = await ensureOpenRoundOn(db, studentId, groupId, classesPerRound);

    const countable = await db.getAllAsync<{ id: number }>(
      `SELECT a.id FROM attendances a
       JOIN group_sessions gs ON gs.id = a.session_id
       WHERE a.student_id = ? AND gs.group_id = ?
         AND a.status IN ('present', 'absent_unexcused')
         AND gs.status != 'cancelled'
       ORDER BY gs.starts_at ASC, a.id ASC`,
      [studentId, groupId]
    );

    const closed = await db.getAllAsync<BillingRound>(
      `SELECT * FROM billing_rounds
       WHERE student_id = ? AND group_id = ? AND status = 'closed'
       ORDER BY round_number ASC`,
      [studentId, groupId]
    );

    let offset = 0;
    for (const c of closed) {
      offset += c.target_classes;
    }

    return applyCountableToOpenRound(
      db,
      studentId,
      groupId,
      classesPerRound,
      countable.slice(offset).map((r) => r.id),
      open
    );
  });
}

/**
 * Sync many students' round progress in one transaction.
 * Loads countable attendances for the cohort in a single query.
 */
export async function syncRoundProgressForStudents(
  studentIds: number[],
  groupId: number
): Promise<void> {
  const unique = [...new Set(studentIds.filter((id) => Number.isFinite(id)))];
  if (!unique.length) return;

  await withTransaction(async (db) => {
    const group = await db.getFirstAsync<{ classes_per_round: number }>(
      "SELECT classes_per_round FROM groups WHERE id = ?",
      [groupId]
    );
    const classesPerRound = group?.classes_per_round ?? 4;

    const placeholders = unique.map(() => "?").join(", ");
    const allCountable = await db.getAllAsync<{
      id: number;
      student_id: number;
    }>(
      `SELECT a.id, a.student_id FROM attendances a
       JOIN group_sessions gs ON gs.id = a.session_id
       WHERE a.student_id IN (${placeholders}) AND gs.group_id = ?
         AND a.status IN ('present', 'absent_unexcused')
         AND gs.status != 'cancelled'
       ORDER BY a.student_id ASC, gs.starts_at ASC, a.id ASC`,
      [...unique, groupId]
    );

    const countableByStudent = new Map<number, number[]>();
    for (const row of allCountable) {
      const list = countableByStudent.get(row.student_id) ?? [];
      list.push(row.id);
      countableByStudent.set(row.student_id, list);
    }

    const allClosed = await db.getAllAsync<BillingRound>(
      `SELECT * FROM billing_rounds
       WHERE group_id = ? AND status = 'closed'
         AND student_id IN (${placeholders})
       ORDER BY student_id ASC, round_number ASC`,
      [groupId, ...unique]
    );
    const closedByStudent = new Map<number, BillingRound[]>();
    for (const row of allClosed) {
      const list = closedByStudent.get(row.student_id) ?? [];
      list.push(row);
      closedByStudent.set(row.student_id, list);
    }

    for (const studentId of unique) {
      const open = await ensureOpenRoundOn(
        db,
        studentId,
        groupId,
        classesPerRound
      );
      const countable = countableByStudent.get(studentId) ?? [];
      const closed = closedByStudent.get(studentId) ?? [];
      let offset = 0;
      for (const c of closed) {
        offset += c.target_classes;
      }
      await applyCountableToOpenRound(
        db,
        studentId,
        groupId,
        classesPerRound,
        countable.slice(offset),
        open
      );
    }
  });
}

export async function onAttendanceChanged(
  studentId: number,
  groupId: number
): Promise<void> {
  await syncRoundProgressForStudent(studentId, groupId);
}

export async function onAttendanceChangedBatch(
  studentIds: number[],
  groupId: number
): Promise<void> {
  await syncRoundProgressForStudents(studentIds, groupId);
}

export async function openRoundForNewEnrollment(
  studentId: number,
  groupId: number
): Promise<void> {
  await ensureOpenRound(studentId, groupId);
}

export async function listPayableRoundsForStudent(
  studentId: number
): Promise<
  (BillingRound & {
    group_name: string;
    due: number;
    paid: number;
    remaining: number;
  })[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    BillingRound & {
      group_name: string;
      default_monthly_fee: number;
      custom_monthly_fee: number | null;
      paid: number | null;
    }
  >(
    `SELECT br.*, g.name as group_name, g.default_monthly_fee, e.custom_monthly_fee,
       COALESCE(payment_totals.paid, 0) as paid
     FROM billing_rounds br
     JOIN groups g ON g.id = br.group_id
     LEFT JOIN enrollments e
       ON e.student_id = br.student_id AND e.group_id = br.group_id AND e.status = 'active'
     LEFT JOIN (
       SELECT billing_round_id, SUM(amount) as paid
       FROM payments
       WHERE billing_round_id IS NOT NULL
       GROUP BY billing_round_id
     ) payment_totals ON payment_totals.billing_round_id = br.id
     WHERE br.student_id = ?
     ORDER BY br.round_number DESC`,
    [studentId]
  );

  const mapped = rows
    .map((r) => {
      const due =
        r.custom_monthly_fee != null && r.custom_monthly_fee >= 0
          ? r.custom_monthly_fee
          : r.default_monthly_fee;
      const paid = Number(r.paid ?? 0);
      const remaining = Math.max(0, due - paid);
      return {
        id: r.id,
        group_id: r.group_id,
        student_id: r.student_id,
        round_number: r.round_number,
        target_classes: r.target_classes,
        counted_classes: r.counted_classes,
        status: r.status,
        started_at: r.started_at,
        closed_at: r.closed_at,
        group_name: r.group_name,
        due,
        paid,
        remaining,
      };
    })
    .filter((r) => r.status === "open" || r.remaining > 0);

  const byGroup = new Map<number, typeof mapped>();
  for (const row of mapped) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push(row);
    byGroup.set(row.group_id, list);
  }
  const out: typeof mapped = [];
  for (const [gid, list] of byGroup) {
    const ranges = await getSessionRoundDateRanges(gid);
    for (const row of list) {
      const range = ranges.get(row.round_number);
      out.push(
        range
          ? {
              ...row,
              started_at: range.started_at,
              closed_at: range.closed_at,
            }
          : row
      );
    }
  }
  return out;
}

export type GroupRoundSummary = {
  round_number: number;
  started_at: string;
  closed_at: string | null;
  has_open: boolean;
};

type SessionRoundDateRange = {
  started_at: string;
  closed_at: string | null;
};

function sessionRangeCacheKey(groupId: number, classesPerRound: number): string {
  return `${groupId}:${classesPerRound}`;
}

function buildSessionRoundDateRanges(
  sessions: { starts_at: string }[],
  classesPerRound: number
): Map<number, SessionRoundDateRange> {
  const ranges = new Map<number, SessionRoundDateRange>();
  const per = Math.max(1, classesPerRound);
  for (let i = 0; i < sessions.length; i++) {
    const roundNumber = Math.floor(i / per) + 1;
    const existing = ranges.get(roundNumber);
    if (!existing) {
      ranges.set(roundNumber, {
        started_at: sessions[i].starts_at,
        closed_at: null,
      });
    } else if (i % per === per - 1) {
      existing.closed_at = sessions[i].starts_at;
    }
  }
  return ranges;
}

async function getSessionRoundDateRangesForGroups(
  classesPerRoundByGroup: Map<number, number>
): Promise<Map<string, Map<number, SessionRoundDateRange>>> {
  const cache = new Map<string, Map<number, SessionRoundDateRange>>();
  const groupIds = [...classesPerRoundByGroup.keys()];
  if (!groupIds.length) return cache;

  const db = await getDb();
  const placeholders = groupIds.map(() => "?").join(", ");
  const sessions = await db.getAllAsync<{
    group_id: number;
    starts_at: string;
  }>(
    `SELECT group_id, starts_at
     FROM group_sessions
     WHERE group_id IN (${placeholders}) AND status != 'cancelled'
     ORDER BY group_id ASC, starts_at ASC`,
    groupIds
  );

  const sessionsByGroup = new Map<number, { starts_at: string }[]>();
  for (const session of sessions) {
    const groupSessions = sessionsByGroup.get(session.group_id) ?? [];
    groupSessions.push({ starts_at: session.starts_at });
    sessionsByGroup.set(session.group_id, groupSessions);
  }

  for (const [groupId, classesPerRound] of classesPerRoundByGroup) {
    const per = Math.max(1, classesPerRound);
    cache.set(
      sessionRangeCacheKey(groupId, per),
      buildSessionRoundDateRanges(sessionsByGroup.get(groupId) ?? [], per)
    );
  }
  return cache;
}

/**
 * Round calendar dates from scheduled class sessions (not DB open/close timestamps).
 * Round N = sessions [(N-1)*classes_per_round, N*classes_per_round).
 */
export async function getSessionRoundDateRanges(
  groupId: number
): Promise<Map<number, { started_at: string; closed_at: string | null }>> {
  const db = await getDb();
  const group = await db.getFirstAsync<{ classes_per_round: number }>(
    "SELECT classes_per_round FROM groups WHERE id = ?",
    [groupId]
  );
  const classesPerRound = Math.max(1, group?.classes_per_round ?? 4);
  const cache = await getSessionRoundDateRangesForGroups(
    new Map([[groupId, classesPerRound]])
  );
  return (
    cache.get(sessionRangeCacheKey(groupId, classesPerRound)) ?? new Map()
  );
}

export async function getGroupRoundSummaries(
  groupId: number
): Promise<GroupRoundSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    round_number: number;
    open_count: number;
  }>(
    `SELECT
       round_number,
       SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count
     FROM billing_rounds
     WHERE group_id = ?
     GROUP BY round_number
     ORDER BY round_number DESC`,
    [groupId]
  );

  const ranges = await getSessionRoundDateRanges(groupId);

  // Only real billing rounds (with students) — not every future schedule chunk
  return rows.map((r) => {
    const range = ranges.get(r.round_number);
    return {
      round_number: r.round_number,
      // Calendar dates come from the classes in this round, not DB open/close time
      started_at: range?.started_at ?? "",
      // End only when this round's class set is full; ignore billing "open" for the label
      closed_at: range?.closed_at ?? null,
      has_open: Number(r.open_count) > 0,
    };
  });
}

/** @deprecated use getGroupRoundSummaries */
export async function getGroupRoundNumbers(groupId: number): Promise<number[]> {
  const rows = await getGroupRoundSummaries(groupId);
  return rows.map((r) => r.round_number);
}

async function attachSessionRoundDates(
  groupId: number,
  rows: StudentDueRow[]
): Promise<StudentDueRow[]> {
  const ranges = await getSessionRoundDateRanges(groupId);
  return rows.map((r) => {
    const range = r.round_number != null ? ranges.get(r.round_number) : undefined;
    if (!range) return r;
    return {
      ...r,
      started_at: range.started_at,
      closed_at: range.closed_at,
    };
  });
}

/** All active students in the group for a given round number (paid/unpaid). */
export async function getGroupDuesForRoundNumber(
  groupId: number,
  roundNumber: number
): Promise<StudentDueRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    round_id: number;
    round_number: number;
    counted_classes: number;
    target_classes: number;
    started_at: string;
    closed_at: string | null;
    student_id: number;
    student_name: string;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
  }>(
    `SELECT
       br.id as round_id,
       br.round_number,
       br.counted_classes,
       br.target_classes,
       br.started_at,
       br.closed_at,
       s.id as student_id,
       s.name as student_name,
       s.guardian_phone,
       g.id as group_id,
       g.name as group_name,
       g.default_monthly_fee,
       e.custom_monthly_fee,
       COALESCE(payment_totals.paid, 0) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
     LEFT JOIN (
       SELECT billing_round_id, SUM(amount) as paid
       FROM payments
       WHERE billing_round_id IS NOT NULL
       GROUP BY billing_round_id
     ) payment_totals ON payment_totals.billing_round_id = br.id
     WHERE br.group_id = ?
       AND br.round_number = ?
       AND s.status = 'active'
     ORDER BY s.name COLLATE NOCASE`,
    [groupId, roundNumber]
  );

  const mapped = rows.map((r) => {
    const due =
      r.custom_monthly_fee != null && r.custom_monthly_fee >= 0
        ? r.custom_monthly_fee
        : r.default_monthly_fee;
    const paid = Number(r.paid ?? 0);
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      guardian_phone: r.guardian_phone,
      group_id: r.group_id,
      group_name: r.group_name,
      due,
      paid,
      remaining: Math.max(0, due - paid),
      status: statusFor(due, paid),
      round_id: r.round_id,
      round_number: r.round_number,
      counted_classes: r.counted_classes,
      target_classes: r.target_classes,
      remaining_classes: Math.max(0, r.target_classes - r.counted_classes),
      started_at: r.started_at,
      closed_at: r.closed_at,
    };
  });
  return attachSessionRoundDates(groupId, mapped);
}

export async function getRoundDues(groupId?: number): Promise<StudentDueRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    round_id: number;
    round_number: number;
    counted_classes: number;
    target_classes: number;
    started_at: string;
    closed_at: string | null;
    student_id: number;
    student_name: string;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    classes_per_round: number;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
  }>(
    `SELECT
       br.id as round_id,
       br.round_number,
       br.counted_classes,
       br.target_classes,
       br.started_at,
       br.closed_at,
       s.id as student_id,
       s.name as student_name,
       s.guardian_phone,
       g.id as group_id,
       g.name as group_name,
       g.classes_per_round,
       g.default_monthly_fee,
       e.custom_monthly_fee,
       COALESCE(payment_totals.paid, 0) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
     LEFT JOIN (
       SELECT billing_round_id, SUM(amount) as paid
       FROM payments
       WHERE billing_round_id IS NOT NULL
       GROUP BY billing_round_id
     ) payment_totals ON payment_totals.billing_round_id = br.id
     WHERE br.status = 'open'
       AND s.status = 'active'
       ${groupId != null ? "AND br.group_id = ?" : ""}
     ORDER BY g.name, s.name COLLATE NOCASE`,
    groupId != null ? [groupId] : []
  );

  const mapped = rows.map((r) => {
    const due =
      r.custom_monthly_fee != null && r.custom_monthly_fee >= 0
        ? r.custom_monthly_fee
        : r.default_monthly_fee;
    const paid = Number(r.paid ?? 0);
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      guardian_phone: r.guardian_phone,
      group_id: r.group_id,
      group_name: r.group_name,
      due,
      paid,
      remaining: Math.max(0, due - paid),
      status: statusFor(due, paid),
      round_id: r.round_id,
      round_number: r.round_number,
      counted_classes: r.counted_classes,
      target_classes: r.target_classes,
      remaining_classes: Math.max(0, r.target_classes - r.counted_classes),
      started_at: r.started_at,
      closed_at: r.closed_at,
    };
  });

  const classesPerRoundByGroup = new Map<number, number>();
  for (const row of rows) {
    classesPerRoundByGroup.set(
      row.group_id,
      Math.max(1, row.classes_per_round ?? 4)
    );
  }

  const rangeCache = await getSessionRoundDateRangesForGroups(
    classesPerRoundByGroup
  );
  return mapped.map((row) => {
    const classesPerRound = classesPerRoundByGroup.get(row.group_id) ?? 4;
    const ranges = rangeCache.get(
      sessionRangeCacheKey(row.group_id, classesPerRound)
    );
    const range =
      row.round_number != null ? ranges?.get(row.round_number) : undefined;
    return range
      ? {
          ...row,
          started_at: range.started_at,
          closed_at: range.closed_at,
        }
      : row;
  });
}

/** Open-round dues for one student only (avoids full-app summary scan). */
export async function getRoundDuesForStudent(
  studentId: number
): Promise<StudentDueRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    round_id: number;
    round_number: number;
    counted_classes: number;
    target_classes: number;
    started_at: string;
    closed_at: string | null;
    student_id: number;
    student_name: string;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
  }>(
    `SELECT
       br.id as round_id,
       br.round_number,
       br.counted_classes,
       br.target_classes,
       br.started_at,
       br.closed_at,
       s.id as student_id,
       s.name as student_name,
       s.guardian_phone,
       g.id as group_id,
       g.name as group_name,
       g.default_monthly_fee,
       e.custom_monthly_fee,
       COALESCE(payment_totals.paid, 0) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
     LEFT JOIN (
       SELECT billing_round_id, SUM(amount) as paid
       FROM payments
       WHERE billing_round_id IS NOT NULL
       GROUP BY billing_round_id
     ) payment_totals ON payment_totals.billing_round_id = br.id
     WHERE br.status = 'open'
       AND s.status = 'active'
       AND br.student_id = ?
     ORDER BY g.name COLLATE NOCASE`,
    [studentId]
  );

  const mapped = rows.map((r) => {
    const due =
      r.custom_monthly_fee != null && r.custom_monthly_fee >= 0
        ? r.custom_monthly_fee
        : r.default_monthly_fee;
    const paid = Number(r.paid ?? 0);
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      guardian_phone: r.guardian_phone,
      group_id: r.group_id,
      group_name: r.group_name,
      due,
      paid,
      remaining: Math.max(0, due - paid),
      status: statusFor(due, paid),
      round_id: r.round_id,
      round_number: r.round_number,
      counted_classes: r.counted_classes,
      target_classes: r.target_classes,
      remaining_classes: Math.max(0, r.target_classes - r.counted_classes),
      started_at: r.started_at,
      closed_at: r.closed_at,
    };
  });

  const byGroup = new Map<number, StudentDueRow[]>();
  for (const row of mapped) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push(row);
    byGroup.set(row.group_id, list);
  }
  const out: StudentDueRow[] = [];
  for (const [gid, list] of byGroup) {
    out.push(...(await attachSessionRoundDates(gid, list)));
  }
  return out;
}

export async function getOpenRoundsPaymentSummary(groupId?: number): Promise<{
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  dues: StudentDueRow[];
}> {
  const dues = await getRoundDues(groupId);
  return {
    totalCollected: dues.reduce((s, d) => s + d.paid, 0),
    totalDue: dues.reduce((s, d) => s + d.due, 0),
    totalRemaining: dues.reduce((s, d) => s + d.remaining, 0),
    unpaidCount: dues.filter((d) => d.status === "unpaid").length,
    partialCount: dues.filter((d) => d.status === "partial").length,
    paidCount: dues.filter((d) => d.status === "paid").length,
    dues,
  };
}

type OpenRoundDueSqlRow = {
  round_id: number;
  round_number: number;
  counted_classes: number;
  target_classes: number;
  started_at: string;
  closed_at: string | null;
  student_id: number;
  student_name: string;
  guardian_phone: string | null;
  group_id: number;
  group_name: string;
  due: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
};

const OPEN_ROUND_DUES_CTE = `
  WITH due_rows AS (
    SELECT
      br.id as round_id,
      br.round_number,
      br.counted_classes,
      br.target_classes,
      br.started_at,
      br.closed_at,
      s.id as student_id,
      s.name as student_name,
      s.guardian_phone,
      g.id as group_id,
      g.name as group_name,
      CASE
        WHEN e.custom_monthly_fee IS NOT NULL AND e.custom_monthly_fee >= 0
          THEN e.custom_monthly_fee
        ELSE g.default_monthly_fee
      END as due,
      COALESCE(SUM(p.amount), 0) as paid
    FROM billing_rounds br
    JOIN students s ON s.id = br.student_id
    JOIN groups g ON g.id = br.group_id
    JOIN enrollments e
      ON e.student_id = s.id
      AND e.group_id = g.id
      AND e.status = 'active'
    LEFT JOIN payments p ON p.billing_round_id = br.id
    WHERE br.status = 'open' AND s.status = 'active'
    GROUP BY br.id
  ),
  classified AS (
    SELECT *,
      MAX(0, due - paid) as remaining,
      CASE
        WHEN due <= 0 THEN 'paid'
        WHEN paid <= 0 THEN 'unpaid'
        WHEN paid + 0.001 >= due THEN 'paid'
        ELSE 'partial'
      END as status
    FROM due_rows
  )`;

export type OpenRoundPaymentPage = {
  items: StudentDueRow[];
  total: number;
  totalCollected: number;
  totalRemaining: number;
  groups: { id: number; name: string }[];
};

/** Open-round payment rows with status/group filtering and paging in SQL. */
export async function getOpenRoundsPaymentPage(input: {
  status?: PaymentStatus;
  groupId?: number;
  limit: number;
  offset: number;
}): Promise<OpenRoundPaymentPage> {
  const db = await getDb();
  const conditions = ["1 = 1"];
  const params: (string | number)[] = [];
  if (input.groupId != null) {
    conditions.push("group_id = ?");
    params.push(input.groupId);
  }
  if (input.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }
  const where = conditions.join(" AND ");

  const summary = await db.getFirstAsync<{
    total_collected: number;
    total_remaining: number;
  }>(
    `${OPEN_ROUND_DUES_CTE}
     SELECT
       COALESCE(SUM(paid), 0) as total_collected,
       COALESCE(SUM(remaining), 0) as total_remaining
     FROM classified`
  );
  const groups = await db.getAllAsync<{ id: number; name: string }>(
    `${OPEN_ROUND_DUES_CTE}
     SELECT DISTINCT group_id as id, group_name as name
     FROM classified
     ORDER BY group_name COLLATE NOCASE`
  );
  const count = await db.getFirstAsync<{ total: number }>(
    `${OPEN_ROUND_DUES_CTE}
     SELECT COUNT(*) as total FROM classified WHERE ${where}`,
    params
  );
  const rows = await db.getAllAsync<OpenRoundDueSqlRow>(
    `${OPEN_ROUND_DUES_CTE}
     SELECT * FROM classified
     WHERE ${where}
     ORDER BY group_name COLLATE NOCASE, student_name COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );

  const mapped: StudentDueRow[] = rows.map((row) => ({
    ...row,
    due: Number(row.due),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    remaining_classes: Math.max(
      0,
      row.target_classes - row.counted_classes
    ),
  }));
  const byGroup = new Map<number, StudentDueRow[]>();
  for (const row of mapped) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push(row);
    byGroup.set(row.group_id, list);
  }
  const items: StudentDueRow[] = [];
  for (const [groupId, groupRows] of byGroup) {
    items.push(...(await attachSessionRoundDates(groupId, groupRows)));
  }

  return {
    items,
    total: Number(count?.total ?? 0),
    totalCollected: Number(summary?.total_collected ?? 0),
    totalRemaining: Number(summary?.total_remaining ?? 0),
    groups,
  };
}

export async function getGroupListStats(): Promise<
  { group_id: number; student_count: number; total_fees: number }[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT
       g.id as group_id,
       COUNT(CASE WHEN s.id IS NOT NULL THEN e.id END) as student_count,
       COALESCE(SUM(
         CASE
           WHEN s.id IS NULL THEN 0
           WHEN e.custom_monthly_fee IS NOT NULL THEN e.custom_monthly_fee
           ELSE g.default_monthly_fee
         END
       ), 0) as total_fees
     FROM groups g
     LEFT JOIN enrollments e ON e.group_id = g.id AND e.status = 'active'
     LEFT JOIN students s ON s.id = e.student_id AND s.status = 'active'
     WHERE g.status = 'active'
     GROUP BY g.id`
  );
}
