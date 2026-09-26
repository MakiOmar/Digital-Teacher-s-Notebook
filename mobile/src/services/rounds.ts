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

/**
 * First membership: count from group.start_date so schedule attendance before
 * "enroll today" still advances the round. Rejoin after leave: use requested date
 * so prior closed rounds stay outside the sync window.
 */
export async function resolveEnrollmentStartDateOn(
  db: SQLiteDatabase,
  studentId: number,
  groupId: number,
  requestedStart: string
): Promise<string> {
  const requested = requestedStart.slice(0, 10);
  const prior = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM enrollments
     WHERE student_id = ? AND group_id = ? AND status = 'ended'
     LIMIT 1`,
    [studentId, groupId]
  );
  if (prior) return requested;
  const group = await db.getFirstAsync<{ start_date: string | null }>(
    "SELECT start_date FROM groups WHERE id = ?",
    [groupId]
  );
  const gStart = group?.start_date?.trim().slice(0, 10) || null;
  if (gStart && gStart < requested) return gStart;
  return requested;
}

async function enrollmentCountStartOn(
  db: SQLiteDatabase,
  studentId: number,
  groupId: number,
  enrollmentStart: string,
  groupStartDate: string | null | undefined
): Promise<string> {
  const requested = enrollmentStart.slice(0, 10);
  const prior = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM enrollments
     WHERE student_id = ? AND group_id = ? AND status = 'ended'
     LIMIT 1`,
    [studentId, groupId]
  );
  if (prior) return requested;
  const gStart = groupStartDate?.trim().slice(0, 10) || null;
  if (gStart && gStart < requested) return gStart;
  return requested;
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
  if (!created) throw new Error("ØªØ¹Ø°Ø± Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø´Ù‡Ø±");
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
 * Only attendance on/after the active enrollment start_date counts; older
 * closed rounds (prior membership) are excluded from the sync offset.
 */
export async function syncRoundProgressForStudent(
  studentId: number,
  groupId: number
): Promise<BillingRound> {
  return withTransaction(async (db) => {
    const group = await db.getFirstAsync<{
      classes_per_round: number;
      start_date: string | null;
    }>("SELECT classes_per_round, start_date FROM groups WHERE id = ?", [
      groupId,
    ]);
    const classesPerRound = group?.classes_per_round ?? 4;
    let open = await ensureOpenRoundOn(db, studentId, groupId, classesPerRound);

    const enrollment = await db.getFirstAsync<{ start_date: string }>(
      `SELECT start_date FROM enrollments
       WHERE student_id = ? AND group_id = ? AND status = 'active'
       LIMIT 1`,
      [studentId, groupId]
    );
    const startDate = await enrollmentCountStartOn(
      db,
      studentId,
      groupId,
      enrollment?.start_date ?? "0000-01-01",
      group?.start_date
    );

    const countable = await db.getAllAsync<{ id: number }>(
      `SELECT a.id FROM attendances a
       JOIN group_sessions gs ON gs.id = a.session_id
       WHERE a.student_id = ? AND gs.group_id = ?
         AND a.status IN ('present', 'absent_unexcused')
         AND gs.status != 'cancelled'
         AND date(gs.starts_at) >= date(?)
       ORDER BY gs.starts_at ASC, a.id ASC`,
      [studentId, groupId, startDate]
    );

    const closed = await db.getAllAsync<BillingRound>(
      `SELECT * FROM billing_rounds
       WHERE student_id = ? AND group_id = ? AND status = 'closed'
         AND date(started_at) >= date(?)
       ORDER BY round_number ASC`,
      [studentId, groupId, startDate]
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
    const group = await db.getFirstAsync<{
      classes_per_round: number;
      start_date: string | null;
    }>("SELECT classes_per_round, start_date FROM groups WHERE id = ?", [
      groupId,
    ]);
    const classesPerRound = group?.classes_per_round ?? 4;
    const groupStart = group?.start_date ?? null;

    const placeholders = unique.map(() => "?").join(", ");
    const enrollments = await db.getAllAsync<{
      student_id: number;
      start_date: string;
    }>(
      `SELECT student_id, start_date FROM enrollments
       WHERE group_id = ? AND status = 'active'
         AND student_id IN (${placeholders})`,
      [groupId, ...unique]
    );
    const rejoined = await db.getAllAsync<{ student_id: number }>(
      `SELECT DISTINCT student_id FROM enrollments
       WHERE group_id = ? AND status = 'ended'
         AND student_id IN (${placeholders})`,
      [groupId, ...unique]
    );
    const rejoinedSet = new Set(rejoined.map((r) => r.student_id));
    const startByStudent = new Map<number, string>();
    for (const row of enrollments) {
      const requested = row.start_date.slice(0, 10);
      if (rejoinedSet.has(row.student_id)) {
        startByStudent.set(row.student_id, requested);
        continue;
      }
      const gStart = groupStart?.trim().slice(0, 10) || null;
      startByStudent.set(
        row.student_id,
        gStart && gStart < requested ? gStart : requested
      );
    }

    const allCountable = await db.getAllAsync<{
      id: number;
      student_id: number;
      starts_at: string;
    }>(
      `SELECT a.id, a.student_id, gs.starts_at FROM attendances a
       JOIN group_sessions gs ON gs.id = a.session_id
       WHERE a.student_id IN (${placeholders}) AND gs.group_id = ?
         AND a.status IN ('present', 'absent_unexcused')
         AND gs.status != 'cancelled'
       ORDER BY a.student_id ASC, gs.starts_at ASC, a.id ASC`,
      [...unique, groupId]
    );

    const countableByStudent = new Map<number, number[]>();
    for (const row of allCountable) {
      const startDate = startByStudent.get(row.student_id) ?? "0000-01-01";
      if (row.starts_at.slice(0, 10) < startDate) continue;
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
      const startDate = startByStudent.get(row.student_id) ?? "0000-01-01";
      if (row.started_at.slice(0, 10) < startDate) continue;
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

/**
 * Force-close open billing rounds (leave group / pause group).
 * Freezes target_classes to counted_classes so sync offsets stay honest.
 */
export async function forceCloseOpenRoundsOn(
  db: SQLiteDatabase,
  input: { studentId?: number; groupId?: number }
): Promise<void> {
  const conditions = ["status = 'open'"];
  const params: number[] = [];
  if (input.studentId != null) {
    conditions.push("student_id = ?");
    params.push(input.studentId);
  }
  if (input.groupId != null) {
    conditions.push("group_id = ?");
    params.push(input.groupId);
  }
  if (params.length === 0) {
    throw new Error("forceCloseOpenRoundsOn requires studentId and/or groupId");
  }
  await db.runAsync(
    `UPDATE billing_rounds
     SET target_classes = counted_classes,
         status = 'closed',
         closed_at = datetime('now')
     WHERE ${conditions.join(" AND ")}`,
    params
  );
}

export async function forceCloseOpenRounds(input: {
  studentId?: number;
  groupId?: number;
}): Promise<void> {
  await withTransaction(async (db) => {
    await forceCloseOpenRoundsOn(db, input);
  });
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
    .filter((r) => r.remaining > 0);

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

  // Only real billing rounds (with students) â€” not every future schedule chunk
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

/** Overlay session calendar dates on due rows spanning one or many groups. */
async function attachSessionRoundDatesMulti(
  rows: StudentDueRow[]
): Promise<StudentDueRow[]> {
  if (!rows.length) return rows;
  const classesPerRoundByGroup = new Map<number, number>();
  for (const row of rows) {
    if (!classesPerRoundByGroup.has(row.group_id)) {
      classesPerRoundByGroup.set(row.group_id, 4);
    }
  }
  const db = await getDb();
  const groupIds = [...classesPerRoundByGroup.keys()];
  const placeholders = groupIds.map(() => "?").join(", ");
  const groups = await db.getAllAsync<{
    id: number;
    classes_per_round: number;
  }>(
    `SELECT id, classes_per_round FROM groups WHERE id IN (${placeholders})`,
    groupIds
  );
  for (const g of groups) {
    classesPerRoundByGroup.set(g.id, Math.max(1, g.classes_per_round ?? 4));
  }
  const rangeCache = await getSessionRoundDateRangesForGroups(
    classesPerRoundByGroup
  );
  return rows.map((row) => {
    const per = classesPerRoundByGroup.get(row.group_id) ?? 4;
    const ranges = rangeCache.get(sessionRangeCacheKey(row.group_id, per));
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
    student_phone: string | null;
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
       s.student_phone,
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
       AND g.status = 'active'
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
      student_phone: r.student_phone,
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
  // Recompute counted_classes so late enroll dates still pick up group-start attendance.
  if (groupId != null) {
    const enrolled = await db.getAllAsync<{ student_id: number }>(
      `SELECT student_id FROM enrollments
       WHERE group_id = ? AND status = 'active'`,
      [groupId]
    );
    await syncRoundProgressForStudents(
      enrolled.map((r) => r.student_id),
      groupId
    );
  }
  const rows = await db.getAllAsync<{
    round_id: number;
    round_number: number;
    counted_classes: number;
    target_classes: number;
    started_at: string;
    closed_at: string | null;
    student_id: number;
    student_name: string;
    student_phone: string | null;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    classes_per_round: number;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
    round_status: string;
  }>(
    `SELECT
       br.id as round_id,
       br.round_number,
       br.counted_classes,
       br.target_classes,
       br.started_at,
       br.closed_at,
       br.status as round_status,
       s.id as student_id,
       s.name as student_name,
       s.student_phone,
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
     WHERE s.status = 'active'
       AND g.status = 'active'
       ${groupId != null ? "AND br.group_id = ?" : ""}
     ORDER BY g.name, s.name COLLATE NOCASE`,
    groupId != null ? [groupId] : []
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
        student_id: r.student_id,
        student_name: r.student_name,
        student_phone: r.student_phone,
        guardian_phone: r.guardian_phone,
        group_id: r.group_id,
        group_name: r.group_name,
        due,
        paid,
        remaining,
        status: statusFor(due, paid),
        round_id: r.round_id,
        round_number: r.round_number,
        counted_classes: r.counted_classes,
        target_classes: r.target_classes,
        remaining_classes: Math.max(0, r.target_classes - r.counted_classes),
        started_at: r.started_at,
        closed_at: r.closed_at,
        round_status: r.round_status,
        classes_per_round: r.classes_per_round,
      };
    })
    .filter((r) => r.round_status === "open" || r.remaining > 0);

  const classesPerRoundByGroup = new Map<number, number>();
  for (const row of mapped) {
    classesPerRoundByGroup.set(
      row.group_id,
      Math.max(1, row.classes_per_round ?? 4)
    );
  }

  const rangeCache = await getSessionRoundDateRangesForGroups(
    classesPerRoundByGroup
  );
  return mapped.map((row) => {
    const { round_status: _rs, classes_per_round: _cpr, ...rest } = row;
    const classesPerRound = classesPerRoundByGroup.get(rest.group_id) ?? 4;
    const ranges = rangeCache.get(
      sessionRangeCacheKey(rest.group_id, classesPerRound)
    );
    const range =
      rest.round_number != null ? ranges?.get(rest.round_number) : undefined;
    return range
      ? {
          ...rest,
          started_at: range.started_at,
          closed_at: range.closed_at,
        }
      : rest;
  });
}

/** Outstanding dues for one student (open rounds or closed with remaining). */
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
    student_phone: string | null;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
    round_status: string;
  }>(
    `SELECT
       br.id as round_id,
       br.round_number,
       br.counted_classes,
       br.target_classes,
       br.started_at,
       br.closed_at,
       br.status as round_status,
       s.id as student_id,
       s.name as student_name,
       s.student_phone,
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
     WHERE s.status = 'active'
       AND g.status = 'active'
       AND br.student_id = ?
     ORDER BY g.name COLLATE NOCASE`,
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
        student_id: r.student_id,
        student_name: r.student_name,
        student_phone: r.student_phone,
        guardian_phone: r.guardian_phone,
        group_id: r.group_id,
        group_name: r.group_name,
        due,
        paid,
        remaining,
        status: statusFor(due, paid),
        round_id: r.round_id,
        round_number: r.round_number,
        counted_classes: r.counted_classes,
        target_classes: r.target_classes,
        remaining_classes: Math.max(0, r.target_classes - r.counted_classes),
        started_at: r.started_at,
        closed_at: r.closed_at,
        round_status: r.round_status,
      };
    })
    .filter((r) => r.round_status === "open" || r.remaining > 0)
    .map(({ round_status: _rs, ...row }) => row);

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

/** Outstanding = open rounds OR closed rounds still owing money. */
const OUTSTANDING_DUES_CTE = `
  WITH due_rows AS (
    SELECT
      br.id as round_id,
      br.round_number,
      br.counted_classes,
      br.target_classes,
      br.started_at,
      br.closed_at,
      br.status as round_status,
      s.id as student_id,
      s.name as student_name,
      s.student_phone,
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
    WHERE s.status = 'active'
      AND g.status = 'active'
    GROUP BY br.id
  ),
  classified AS (
    SELECT
      round_id, round_number, counted_classes, target_classes,
      started_at, closed_at, round_status,
      student_id, student_name, student_phone,
      guardian_phone, group_id, group_name, due, paid,
      MAX(0, due - paid) as remaining,
      CASE
        WHEN due <= 0 THEN 'paid'
        WHEN paid <= 0 THEN 'unpaid'
        WHEN paid + 0.001 >= due THEN 'paid'
        ELSE 'partial'
      END as status
    FROM due_rows
    WHERE round_status = 'open' OR (due - paid) > 0.001
  )`;

/** Cheap unpaid+partial outstanding count for reminders (no session date attach). */
export async function countOutstandingUnpaidPartials(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `${OUTSTANDING_DUES_CTE}
     SELECT COUNT(*) as total
     FROM classified
     WHERE status IN ('unpaid', 'partial')`
  );
  return Number(row?.total ?? 0);
}

/** All-time collections by active group (real payment sums, not open-round paid). */
export async function getCollectionsByGroup(): Promise<
  { group_id: number; group_name: string; collected: number }[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT g.id as group_id, g.name as group_name,
       COALESCE(SUM(p.amount), 0) as collected
     FROM groups g
     LEFT JOIN payments p ON p.group_id = g.id
     WHERE g.status = 'active'
     GROUP BY g.id
     ORDER BY g.name COLLATE NOCASE`
  );
}

/** Outstanding remaining rolled up by active group. */
export async function getOutstandingRemainingByGroup(): Promise<
  { group_id: number; group_name: string; remaining: number }[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `${OUTSTANDING_DUES_CTE}
     SELECT group_id, group_name, COALESCE(SUM(remaining), 0) as remaining
     FROM classified
     GROUP BY group_id
     ORDER BY group_name COLLATE NOCASE`
  );
}

/** All active-enrollment billing rounds with due/paid/status (includes closed paid). */
const PAYMENT_PAGE_DUES_CTE = `
  WITH due_rows AS (
    SELECT
      br.id as round_id,
      br.round_number,
      br.counted_classes,
      br.target_classes,
      br.started_at,
      br.closed_at,
      br.status as round_status,
      s.id as student_id,
      s.name as student_name,
      s.student_phone,
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
    WHERE s.status = 'active'
      AND g.status = 'active'
    GROUP BY br.id
  ),
  classified AS (
    SELECT
      round_id, round_number, counted_classes, target_classes,
      started_at, closed_at, round_status,
      student_id, student_name, student_phone,
      guardian_phone, group_id, group_name, due, paid,
      MAX(0, due - paid) as remaining,
      CASE
        WHEN due <= 0 THEN 'paid'
        WHEN paid <= 0 THEN 'unpaid'
        WHEN paid + 0.001 >= due THEN 'paid'
        ELSE 'partial'
      END as status
    FROM due_rows
  )`;

type OutstandingDueSqlRow = {
  round_id: number;
  round_number: number;
  counted_classes: number;
  target_classes: number;
  started_at: string;
  closed_at: string | null;
  student_id: number;
  student_name: string;
  student_phone: string | null;
  guardian_phone: string | null;
  group_id: number;
  group_name: string;
  due: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
};

export type PaymentRoundFilter = "current" | "all" | number;

export type OpenRoundPaymentPage = {
  items: StudentDueRow[];
  total: number;
  totalCollected: number;
  totalRemaining: number;
  groups: { id: number; name: string }[];
  /** Distinct billing round numbers for the filter dropdown. */
  roundNumbers: number[];
};

/**
 * Payments tab page: list + remaining from dues; earnings from real payment rows.
 * Closed fully-paid rounds stay visible under status=paid and still count in earnings.
 */
export async function getOpenRoundsPaymentPage(input: {
  status?: PaymentStatus;
  groupId?: number;
  /** current = open rounds only (default); all = any; number = that round_number. */
  round?: PaymentRoundFilter;
  limit: number;
  offset: number;
}): Promise<OpenRoundPaymentPage> {
  const db = await getDb();
  const roundFilter: PaymentRoundFilter = input.round ?? "current";

  const listConditions = ["1 = 1"];
  const listParams: (string | number)[] = [];
  const remainConditions = ["remaining > 0.001"];
  const remainParams: (string | number)[] = [];
  const earnConditions = ["1 = 1"];
  const earnParams: (string | number)[] = [];

  if (input.groupId != null) {
    listConditions.push("group_id = ?");
    listParams.push(input.groupId);
    remainConditions.push("group_id = ?");
    remainParams.push(input.groupId);
    earnConditions.push("COALESCE(p.group_id, br.group_id) = ?");
    earnParams.push(input.groupId);
  }

  if (roundFilter === "current") {
    listConditions.push("round_status = 'open'");
    remainConditions.push("round_status = 'open'");
    earnConditions.push("br.status = 'open'");
  } else if (roundFilter !== "all") {
    listConditions.push("round_number = ?");
    listParams.push(roundFilter);
    remainConditions.push("round_number = ?");
    remainParams.push(roundFilter);
    earnConditions.push("br.round_number = ?");
    earnParams.push(roundFilter);
  }

  if (input.status) {
    listConditions.push("status = ?");
    listParams.push(input.status);
    remainConditions.push("status = ?");
    remainParams.push(input.status);
  }

  const listWhere = listConditions.join(" AND ");
  const remainWhere = remainConditions.join(" AND ");
  const earnWhere = earnConditions.join(" AND ");

  const aggregates = await db.getFirstAsync<{
    total_rows: number;
    total_remaining: number;
  }>(
    `${PAYMENT_PAGE_DUES_CTE}
     SELECT
       (SELECT COUNT(*) FROM classified WHERE ${listWhere}) as total_rows,
       (SELECT COALESCE(SUM(remaining), 0) FROM classified WHERE ${remainWhere}) as total_remaining`,
    [...listParams, ...remainParams]
  );

  // Real cash received — never drop closed/paid rounds from the earnings total.
  const collected = await db.getFirstAsync<{ total_collected: number }>(
    `SELECT COALESCE(SUM(p.amount), 0) as total_collected
     FROM payments p
     LEFT JOIN billing_rounds br ON br.id = p.billing_round_id
     JOIN groups g
       ON g.id = COALESCE(p.group_id, br.group_id)
      AND g.status = 'active'
     WHERE ${earnWhere}`,
    earnParams
  );

  const page = await db.getAllAsync<OutstandingDueSqlRow>(
    `${PAYMENT_PAGE_DUES_CTE}
     SELECT * FROM classified
     WHERE ${listWhere}
     ORDER BY group_name COLLATE NOCASE, student_name COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    [...listParams, input.limit, input.offset]
  );

  const groups = await db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM groups WHERE status = 'active' ORDER BY name COLLATE NOCASE`
  );

  const roundNumberRows =
    input.groupId != null
      ? await db.getAllAsync<{ round_number: number }>(
          `SELECT DISTINCT round_number FROM billing_rounds
           WHERE group_id = ?
           ORDER BY round_number ASC`,
          [input.groupId]
        )
      : await db.getAllAsync<{ round_number: number }>(
          `SELECT DISTINCT br.round_number FROM billing_rounds br
           JOIN groups g ON g.id = br.group_id AND g.status = 'active'
           ORDER BY br.round_number ASC`
        );

  const mapped: StudentDueRow[] = page.map((row) => ({
    student_id: row.student_id,
    student_name: row.student_name,
    student_phone: row.student_phone,
    guardian_phone: row.guardian_phone,
    group_id: row.group_id,
    group_name: row.group_name,
    due: Number(row.due),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    status: row.status,
    round_id: row.round_id,
    round_number: row.round_number,
    counted_classes: row.counted_classes,
    target_classes: row.target_classes,
    remaining_classes: Math.max(0, row.target_classes - row.counted_classes),
    started_at: row.started_at,
    closed_at: row.closed_at,
  }));

  // billing_rounds.started_at is enrollment/create time — show session calendar instead.
  const items = await attachSessionRoundDatesMulti(mapped);

  return {
    items,
    total: Number(aggregates?.total_rows ?? 0),
    totalCollected: Number(collected?.total_collected ?? 0),
    totalRemaining: Number(aggregates?.total_remaining ?? 0),
    groups,
    roundNumbers: roundNumberRows.map((r) => Number(r.round_number)),
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
           WHEN e.custom_monthly_fee IS NOT NULL AND e.custom_monthly_fee >= 0
             THEN e.custom_monthly_fee
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

