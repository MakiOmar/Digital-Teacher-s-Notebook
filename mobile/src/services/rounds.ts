import { getDb } from "../db/client";
import type {
  AttendanceStatus,
  BillingRound,
  PaymentStatus,
  StudentDueRow,
} from "../db/types";

export function isCountableAttendance(status: AttendanceStatus): boolean {
  return status === "present" || status === "absent_unexcused";
}

function statusFor(due: number, paid: number): PaymentStatus {
  if (due <= 0) return "paid";
  if (paid <= 0) return "unpaid";
  if (paid + 0.001 >= due) return "paid";
  return "partial";
}

export async function ensureOpenRound(
  studentId: number,
  groupId: number
): Promise<BillingRound> {
  const db = await getDb();
  const existing = await db.getFirstAsync<BillingRound>(
    `SELECT * FROM billing_rounds
     WHERE student_id = ? AND group_id = ? AND status = 'open'
     ORDER BY round_number DESC LIMIT 1`,
    [studentId, groupId]
  );
  if (existing) return existing;

  const group = await db.getFirstAsync<{ classes_per_round: number }>(
    "SELECT classes_per_round FROM groups WHERE id = ?",
    [groupId]
  );
  const last = await db.getFirstAsync<{ round_number: number }>(
    `SELECT round_number FROM billing_rounds
     WHERE student_id = ? AND group_id = ?
     ORDER BY round_number DESC LIMIT 1`,
    [studentId, groupId]
  );
  const nextNum = (last?.round_number ?? 0) + 1;
  const target = group?.classes_per_round ?? 4;
  const r = await db.runAsync(
    `INSERT INTO billing_rounds
     (group_id, student_id, round_number, target_classes, counted_classes, status, started_at)
     VALUES (?, ?, ?, ?, 0, 'open', datetime('now'))`,
    [groupId, studentId, nextNum, target]
  );
  const created = await db.getFirstAsync<BillingRound>(
    "SELECT * FROM billing_rounds WHERE id = ?",
    [Number(r.lastInsertRowId)]
  );
  if (!created) throw new Error("تعذر إنشاء الشهر");
  return created;
}

/**
 * Rebuild open-round progress from countable attendances in the group.
 * Closed rounds "consume" their target_classes from the chronological list.
 */
export async function syncRoundProgressForStudent(
  studentId: number,
  groupId: number
): Promise<BillingRound> {
  const db = await getDb();
  let open = await ensureOpenRound(studentId, groupId);

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

  const remaining = countable.slice(offset);

  while (remaining.length >= open.target_classes) {
    await db.runAsync(
      `UPDATE billing_rounds
       SET counted_classes = ?, status = 'closed', closed_at = datetime('now')
       WHERE id = ?`,
      [open.target_classes, open.id]
    );
    remaining.splice(0, open.target_classes);

    const group = await db.getFirstAsync<{ classes_per_round: number }>(
      "SELECT classes_per_round FROM groups WHERE id = ?",
      [groupId]
    );
    const r = await db.runAsync(
      `INSERT INTO billing_rounds
       (group_id, student_id, round_number, target_classes, counted_classes, status, started_at)
       VALUES (?, ?, ?, ?, 0, 'open', datetime('now'))`,
      [
        groupId,
        studentId,
        open.round_number + 1,
        group?.classes_per_round ?? 4,
      ]
    );
    const next = await db.getFirstAsync<BillingRound>(
      "SELECT * FROM billing_rounds WHERE id = ?",
      [Number(r.lastInsertRowId)]
    );
    if (!next) break;
    open = next;
  }

  const counted = remaining.length;
  await db.runAsync(
    `UPDATE billing_rounds SET counted_classes = ? WHERE id = ?`,
    [counted, open.id]
  );
  const updated = await db.getFirstAsync<BillingRound>(
    "SELECT * FROM billing_rounds WHERE id = ?",
    [open.id]
  );
  return updated ?? open;
}

export async function onAttendanceChanged(
  studentId: number,
  groupId: number
): Promise<void> {
  await syncRoundProgressForStudent(studentId, groupId);
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
       (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.billing_round_id = br.id
       ) as paid
     FROM billing_rounds br
     JOIN groups g ON g.id = br.group_id
     LEFT JOIN enrollments e
       ON e.student_id = br.student_id AND e.group_id = br.group_id AND e.status = 'active'
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
  const per = Math.max(1, group?.classes_per_round ?? 4);
  const sessions = await db.getAllAsync<{ starts_at: string }>(
    `SELECT starts_at FROM group_sessions
     WHERE group_id = ? AND status != 'cancelled'
     ORDER BY starts_at ASC`,
    [groupId]
  );

  const map = new Map<number, { started_at: string; closed_at: string | null }>();
  for (let i = 0; i < sessions.length; i++) {
    const roundNumber = Math.floor(i / per) + 1;
    const existing = map.get(roundNumber);
    if (!existing) {
      map.set(roundNumber, {
        started_at: sessions[i].starts_at,
        closed_at: null,
      });
    } else {
      const indexInRound = i % per;
      // End date = last session in a full round; partial rounds stay open (مستمرة)
      if (indexInRound === per - 1) {
        existing.closed_at = sessions[i].starts_at;
      }
    }
  }
  return map;
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
       (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.billing_round_id = br.id
       ) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
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
       (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.billing_round_id = br.id
       ) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
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

  if (groupId != null) {
    return attachSessionRoundDates(groupId, mapped);
  }

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
       (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.billing_round_id = br.id
       ) as paid
     FROM billing_rounds br
     JOIN students s ON s.id = br.student_id
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e ON e.student_id = s.id AND e.group_id = g.id AND e.status = 'active'
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
