import { getDb, withTransaction } from "../db/client";
import type {
  AcademicYear,
  Semester,
  StudyMonth,
  StudyGroup,
  SchedulePattern,
  Student,
  Enrollment,
  GroupSession,
  Attendance,
  AttendanceStatus,
  Payment,
  PaymentMethod,
  Weekday,
} from "../db/types";
import { monthBounds, yearMonthLabel, monthsOverlappingRange, todayDateOnly } from "../utils/date";
import { getSessionRoundDateRanges } from "../services/rounds";

export type PagedResult<T> = {
  items: T[];
  total: number;
};

// ─── Academic years ───────────────────────────────────────────

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const db = await getDb();
  return db.getAllAsync<AcademicYear>(
    "SELECT * FROM academic_years ORDER BY start_date DESC"
  );
}

export async function getActiveYear(): Promise<AcademicYear | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<AcademicYear>(
      "SELECT * FROM academic_years WHERE is_active = 1 LIMIT 1"
    )) ?? null
  );
}

export async function setActiveYear(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE academic_years SET is_active = 0");
  await db.runAsync("UPDATE academic_years SET is_active = 1 WHERE id = ?", [id]);
}

/** Create academic year with 2 semesters defined by start/end dates.
 * Study months are generated automatically from each semester date range (any length).
 */
export async function createAcademicYearWithSemesters(input: {
  name: string;
  semester1: { start_date: string; end_date: string };
  semester2: { start_date: string; end_date: string };
}): Promise<number> {
  const months1 = monthsOverlappingRange(
    input.semester1.start_date,
    input.semester1.end_date
  );
  const months2 = monthsOverlappingRange(
    input.semester2.start_date,
    input.semester2.end_date
  );

  // Prevent overlapping year_month keys across semesters
  const ymSet = new Set<string>();
  for (const m of [...months1, ...months2]) {
    if (ymSet.has(m.yearMonth)) {
      throw new Error(
        `الشهر ${m.yearMonth} يتكرر في فصلين — اضبط التواريخ بدون تداخل`
      );
    }
    ymSet.add(m.yearMonth);
  }

  if (input.semester1.end_date >= input.semester2.start_date) {
    throw new Error(
      "تاريخ نهاية الفصل الأول يجب أن يكون قبل بداية الفصل الثاني"
    );
  }

  return withTransaction(async (db) => {
    await db.runAsync("UPDATE academic_years SET is_active = 0");
    const yearStart = input.semester1.start_date;
    const yearEnd = input.semester2.end_date;

    const yearResult = await db.runAsync(
      `INSERT INTO academic_years (name, start_date, end_date, is_active, status)
       VALUES (?, ?, ?, 1, 'open')`,
      [input.name, yearStart, yearEnd]
    );
    const yearId = Number(yearResult.lastInsertRowId);

    const sem1 = await db.runAsync(
      `INSERT INTO semesters
       (academic_year_id, name, sort_order, start_date, end_date, status)
       VALUES (?, 'الفصل الأول', 1, ?, ?, 'open')`,
      [yearId, input.semester1.start_date, input.semester1.end_date]
    );
    const sem2 = await db.runAsync(
      `INSERT INTO semesters
       (academic_year_id, name, sort_order, start_date, end_date, status)
       VALUES (?, 'الفصل الثاني', 2, ?, ?, 'open')`,
      [yearId, input.semester2.start_date, input.semester2.end_date]
    );
    const sem1Id = Number(sem1.lastInsertRowId);
    const sem2Id = Number(sem2.lastInsertRowId);

    for (const m of months1) {
      await db.runAsync(
        `INSERT INTO study_months
         (semester_id, academic_year_id, year_month, display_name, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [sem1Id, yearId, m.yearMonth, yearMonthLabel(m.yearMonth), m.start, m.end]
      );
    }
    for (const m of months2) {
      await db.runAsync(
        `INSERT INTO study_months
         (semester_id, academic_year_id, year_month, display_name, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [sem2Id, yearId, m.yearMonth, yearMonthLabel(m.yearMonth), m.start, m.end]
      );
    }

    return yearId;
  });
}

/** @deprecated use createAcademicYearWithSemesters */
export async function createAcademicYearWithDefaults(input: {
  name: string;
  firstSemesterMonths: string[];
  secondSemesterMonths: string[];
}): Promise<number> {
  const first = [...input.firstSemesterMonths].sort();
  const second = [...input.secondSemesterMonths].sort();
  return createAcademicYearWithSemesters({
    name: input.name,
    semester1: {
      start_date: monthBounds(first[0]).start,
      end_date: monthBounds(first[first.length - 1]).end,
    },
    semester2: {
      start_date: monthBounds(second[0]).start,
      end_date: monthBounds(second[second.length - 1]).end,
    },
  });
}

export async function updateAcademicYear(
  id: number,
  name: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE academic_years SET name = ? WHERE id = ?", [name, id]);
}

export async function deleteAcademicYear(id: number): Promise<void> {
  const db = await getDb();
  const sessions = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM group_sessions gs
     JOIN study_months sm ON sm.id = gs.study_month_id
     WHERE sm.academic_year_id = ?`,
    [id]
  );
  if (Number(sessions?.total ?? 0) > 0) {
    throw new Error(
      "لا يمكن حذف السنة لوجود حصص مرتبطة بها. احذف أو أفرغ الحصص أولاً."
    );
  }
  await db.runAsync("DELETE FROM academic_years WHERE id = ?", [id]);
}

/** Count sessions linked to an academic year (for delete guards). */
export async function countSessionsForAcademicYear(
  yearId: number
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM group_sessions gs
     JOIN study_months sm ON sm.id = gs.study_month_id
     WHERE sm.academic_year_id = ?`,
    [yearId]
  );
  return Number(row?.total ?? 0);
}

export async function listSemesters(yearId: number): Promise<Semester[]> {
  const db = await getDb();
  return db.getAllAsync<Semester>(
    "SELECT * FROM semesters WHERE academic_year_id = ? ORDER BY sort_order",
    [yearId]
  );
}

export async function listStudyMonths(yearId: number): Promise<StudyMonth[]> {
  const db = await getDb();
  return db.getAllAsync<StudyMonth>(
    "SELECT * FROM study_months WHERE academic_year_id = ? ORDER BY year_month",
    [yearId]
  );
}

export async function listAllStudyMonths(): Promise<StudyMonth[]> {
  const db = await getDb();
  return db.getAllAsync<StudyMonth>(
    "SELECT * FROM study_months ORDER BY year_month DESC"
  );
}

export async function getStudyMonth(id: number): Promise<StudyMonth | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<StudyMonth>(
      "SELECT * FROM study_months WHERE id = ?",
      [id]
    )) ?? null
  );
}

/**
 * Ensure a study_month row exists for YYYY-MM on the active year.
 * Creates months even outside semester date ranges (group schedules are free).
 */
export async function ensureStudyMonthForYearMonth(
  academicYearId: number,
  yearMonth: string,
  clipStart?: string,
  clipEnd?: string
): Promise<StudyMonth> {
  const db = await getDb();
  const existing = await db.getFirstAsync<StudyMonth>(
    `SELECT * FROM study_months
     WHERE academic_year_id = ? AND year_month = ?`,
    [academicYearId, yearMonth]
  );
  if (existing) return existing;

  const semesters = await listSemesters(academicYearId);
  if (!semesters.length) {
    throw new Error("لا يوجد فصل دراسي في السنة النشطة");
  }

  // Prefer semester whose range overlaps this month; else first semester.
  const bounds = monthBounds(yearMonth);
  const monthStart = clipStart && clipStart > bounds.start ? clipStart : bounds.start;
  const monthEnd = clipEnd && clipEnd < bounds.end ? clipEnd : bounds.end;

  let semesterId = semesters[0].id;
  for (const s of semesters) {
    if (!s.start_date || !s.end_date) continue;
    if (s.start_date <= monthEnd && s.end_date >= monthStart) {
      semesterId = s.id;
      break;
    }
  }

  const r = await db.runAsync(
    `INSERT INTO study_months
     (semester_id, academic_year_id, year_month, display_name, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [
      semesterId,
      academicYearId,
      yearMonth,
      yearMonthLabel(yearMonth),
      monthStart,
      monthEnd,
    ]
  );
  const created = await db.getFirstAsync<StudyMonth>(
    "SELECT * FROM study_months WHERE id = ?",
    [Number(r.lastInsertRowId)]
  );
  if (!created) throw new Error("تعذر إنشاء الشهر الدراسي");
  return created;
}

/** Pick current study month: matching calendar month, else nearest open, else first. */
export async function resolveCurrentStudyMonth(
  yearId: number
): Promise<StudyMonth | null> {
  const months = await listStudyMonths(yearId);
  if (!months.length) return null;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return (
    months.find((m) => m.year_month === ym) ??
    months.find((m) => m.status === "open") ??
    months[0]
  );
}

// ─── Groups ───────────────────────────────────────────────────

export async function listGroups(): Promise<StudyGroup[]> {
  const db = await getDb();
  return db.getAllAsync<StudyGroup>(
    "SELECT * FROM groups WHERE status = 'active' ORDER BY name"
  );
}

export async function countActiveGroups(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) as total FROM groups WHERE status = 'active'"
  );
  return Number(row?.total ?? 0);
}

export async function getGroup(id: number): Promise<StudyGroup | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<StudyGroup>("SELECT * FROM groups WHERE id = ?", [
      id,
    ])) ?? null
  );
}

export async function createGroup(input: {
  name: string;
  subject?: string | null;
  default_monthly_fee: number;
  classes_per_round?: number;
  start_date?: string | null;
  end_date?: string | null;
  patterns: { weekday: Weekday; start_time: string; end_time: string }[];
}): Promise<number> {
  return withTransaction(async (db) => {
    const r = await db.runAsync(
      `INSERT INTO groups
       (name, subject, default_monthly_fee, classes_per_round, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [
        input.name,
        input.subject ?? null,
        input.default_monthly_fee,
        input.classes_per_round ?? 4,
        input.start_date ?? null,
        input.end_date ?? null,
      ]
    );
    const id = Number(r.lastInsertRowId);
    for (const p of input.patterns) {
      await db.runAsync(
        `INSERT INTO group_schedule_patterns (group_id, weekday, start_time, end_time)
         VALUES (?, ?, ?, ?)`,
        [id, p.weekday, p.start_time, p.end_time]
      );
    }
    return id;
  });
}

export async function updateGroup(
  id: number,
  input: {
    name: string;
    subject?: string | null;
    default_monthly_fee: number;
    classes_per_round?: number;
    start_date?: string | null;
    end_date?: string | null;
    patterns: { weekday: Weekday; start_time: string; end_time: string }[];
  }
): Promise<void> {
  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE groups SET
         name = ?, subject = ?, default_monthly_fee = ?, classes_per_round = ?,
         start_date = ?, end_date = ?
       WHERE id = ?`,
      [
        input.name,
        input.subject ?? null,
        input.default_monthly_fee,
        input.classes_per_round ?? 4,
        input.start_date ?? null,
        input.end_date ?? null,
        id,
      ]
    );
    await db.runAsync(
      "DELETE FROM group_schedule_patterns WHERE group_id = ?",
      [id]
    );
    for (const p of input.patterns) {
      await db.runAsync(
        `INSERT INTO group_schedule_patterns (group_id, weekday, start_time, end_time)
         VALUES (?, ?, ?, ?)`,
        [id, p.weekday, p.start_time, p.end_time]
      );
    }
  });
}

/** Pause a group and drop it from live dues (end enrollments + close open rounds). */
export async function softDeleteGroup(id: number): Promise<void> {
  const { forceCloseOpenRoundsOn } = await import("../services/rounds");
  await withTransaction(async (db) => {
    await db.runAsync("UPDATE groups SET status = 'paused' WHERE id = ?", [id]);
    // Students leave the group so they no longer appear as enrolled there.
    await db.runAsync(
      `UPDATE enrollments
       SET status = 'ended', end_date = date('now')
       WHERE group_id = ? AND status = 'active'`,
      [id]
    );
    // Freeze then close open rounds so sync offsets stay honest.
    await forceCloseOpenRoundsOn(db, { groupId: id });
  });
}

export async function listPatterns(groupId: number): Promise<SchedulePattern[]> {
  const db = await getDb();
  return db.getAllAsync<SchedulePattern>(
    "SELECT * FROM group_schedule_patterns WHERE group_id = ? ORDER BY weekday",
    [groupId]
  );
}

// ─── Students & enrollments ───────────────────────────────────

export async function listStudents(): Promise<Student[]> {
  const db = await getDb();
  return db.getAllAsync<Student>(
    "SELECT * FROM students ORDER BY name COLLATE NOCASE"
  );
}

export async function countActiveStudents(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) as total FROM students WHERE status = 'active'"
  );
  return Number(row?.total ?? 0);
}

/** Students with active enrollment group name in one query (no N+1). */
export async function listStudentsWithEnrollment(): Promise<
  (Student & { group_name: string | null; group_id: number | null })[]
> {
  const db = await getDb();
  return db.getAllAsync<
    Student & { group_name: string | null; group_id: number | null }
  >(
    `SELECT s.*, g.name as group_name, e.group_id as group_id
     FROM students s
     LEFT JOIN enrollments e
       ON e.student_id = s.id AND e.status = 'active'
     LEFT JOIN groups g ON g.id = e.group_id AND g.status = 'active'
     ORDER BY s.name COLLATE NOCASE`
  );
}

/** Active groups with all schedule patterns in two queries (no per-group N+1). */
export async function listGroupsWithPatterns(): Promise<
  (StudyGroup & { patterns: SchedulePattern[] })[]
> {
  const db = await getDb();
  const groups = await db.getAllAsync<StudyGroup>(
    "SELECT * FROM groups WHERE status = 'active' ORDER BY name COLLATE NOCASE"
  );
  if (!groups.length) return [];
  const patterns = await db.getAllAsync<SchedulePattern>(
    `SELECT * FROM group_schedule_patterns
     WHERE group_id IN (${groups.map(() => "?").join(",")})
     ORDER BY group_id, weekday, start_time`,
    groups.map((g) => g.id)
  );
  const byGroup = new Map<number, SchedulePattern[]>();
  for (const p of patterns) {
    const list = byGroup.get(p.group_id) ?? [];
    list.push(p);
    byGroup.set(p.group_id, list);
  }
  return groups.map((g) => ({
    ...g,
    patterns: byGroup.get(g.id) ?? [],
  }));
}

export type PagedGroupRow = StudyGroup & {
  patterns: SchedulePattern[];
  student_count: number;
  total_fees: number;
  /** Group class setting (`classes_per_round`) for the current round. */
  month_session_total: number;
  /** That setting minus completed classes in the current round. */
  month_session_remaining: number;
};

function sessionDateOnly(startsAt: string): string {
  return startsAt.replace(" ", "T").slice(0, 10);
}

/**
 * Current round is the chunk whose dates contain today.
 * Before the first class, use the first round.
 * After a round ends, use the latest started round that is not fully completed.
 */
function currentRoundClassCounts(
  sessions: { starts_at: string; status: string }[],
  classesPerRound: number,
  today: string
): { month_session_total: number; month_session_remaining: number } {
  const per = Math.max(1, classesPerRound);
  const ordered = [...sessions].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at)
  );
  const rounds: { starts_at: string; status: string }[][] = [];
  for (let i = 0; i < ordered.length; i += per) {
    rounds.push(ordered.slice(i, i + per));
  }

  const completedIn = (round: { status: string }[]) =>
    round.filter((s) => s.status === "completed").length;

  let current = rounds[0];
  const containing = rounds.find((round) => {
    const first = sessionDateOnly(round[0].starts_at);
    const last = sessionDateOnly(round[round.length - 1].starts_at);
    return today >= first && today <= last;
  });
  if (containing) {
    current = containing;
  } else if (rounds.length) {
    const firstDate = sessionDateOnly(rounds[0][0].starts_at);
    if (today < firstDate) {
      current = rounds[0];
    } else {
      const startedIncomplete = rounds.filter((round) => {
        const first = sessionDateOnly(round[0].starts_at);
        return first <= today && completedIn(round) < per;
      });
      const upcoming = rounds.filter(
        (round) => sessionDateOnly(round[0].starts_at) > today
      );
      current =
        startedIncomplete[startedIncomplete.length - 1] ??
        upcoming[0] ??
        rounds[rounds.length - 1];
    }
  }

  const used = current ? completedIn(current) : 0;
  return {
    month_session_total: per,
    month_session_remaining: Math.max(0, per - used),
  };
}

/** Active groups filtered and paged in SQL, with stats for the visible page. */
export async function listGroupsWithPatternsPage(input: {
  query?: string;
  weekday?: Weekday;
  limit: number;
  offset: number;
}): Promise<PagedResult<PagedGroupRow>> {
  const db = await getDb();
  const conditions = ["g.status = 'active'"];
  const params: (string | number)[] = [];
  const query = input.query?.trim();

  if (query) {
    conditions.push("(g.name LIKE ? OR COALESCE(g.subject, '') LIKE ?)");
    const search = `%${query}%`;
    params.push(search, search);
  }
  if (input.weekday != null) {
    conditions.push(
      "EXISTS (SELECT 1 FROM group_schedule_patterns fp WHERE fp.group_id = g.id AND fp.weekday = ?)"
    );
    params.push(input.weekday);
  }

  const where = conditions.join(" AND ");
  const count = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM groups g WHERE ${where}`,
    params
  );
  const groups = await db.getAllAsync<
    StudyGroup & { student_count: number; total_fees: number }
  >(
    `SELECT g.*,
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
     WHERE ${where}
     GROUP BY g.id
     ORDER BY COALESCE((
       SELECT MIN(CASE sp.weekday
         WHEN 6 THEN 0 WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3
         WHEN 3 THEN 4 WHEN 4 THEN 5 WHEN 5 THEN 6 ELSE 99 END)
       FROM group_schedule_patterns sp
       WHERE sp.group_id = g.id
     ), 99), g.name COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );

  const patterns = groups.length
    ? await db.getAllAsync<SchedulePattern>(
        `SELECT * FROM group_schedule_patterns
         WHERE group_id IN (${groups.map(() => "?").join(",")})
         ORDER BY group_id, weekday, start_time`,
        groups.map((group) => group.id)
      )
    : [];
  const patternsByGroup = new Map<number, SchedulePattern[]>();
  for (const pattern of patterns) {
    const list = patternsByGroup.get(pattern.group_id) ?? [];
    list.push(pattern);
    patternsByGroup.set(pattern.group_id, list);
  }

  // Prefer open billing-round remaining classes (avoids full session history).
  const sessionStats = new Map<
    number,
    { month_session_total: number; month_session_remaining: number }
  >();
  if (groups.length) {
    const roundRows = await db.getAllAsync<{
      group_id: number;
      target_classes: number;
      remaining_classes: number;
    }>(
      `SELECT group_id,
         MAX(target_classes) as target_classes,
         MAX(CASE
           WHEN target_classes > counted_classes
             THEN target_classes - counted_classes
           ELSE 0
         END) as remaining_classes
       FROM billing_rounds
       WHERE status = 'open'
         AND group_id IN (${groups.map(() => "?").join(",")})
       GROUP BY group_id`,
      groups.map((g) => g.id)
    );
    for (const row of roundRows) {
      sessionStats.set(row.group_id, {
        month_session_total: Math.max(1, Number(row.target_classes ?? 4)),
        month_session_remaining: Math.max(0, Number(row.remaining_classes ?? 0)),
      });
    }
    for (const group of groups) {
      if (!sessionStats.has(group.id)) {
        const per = Math.max(1, group.classes_per_round ?? 4);
        sessionStats.set(group.id, {
          month_session_total: per,
          month_session_remaining: per,
        });
      }
    }
  }

  return {
    items: groups.map((group) => {
      const stats = sessionStats.get(group.id);
      return {
        ...group,
        student_count: Number(group.student_count ?? 0),
        total_fees: Number(group.total_fees ?? 0),
        month_session_total: stats?.month_session_total ?? 0,
        month_session_remaining: stats?.month_session_remaining ?? 0,
        patterns: patternsByGroup.get(group.id) ?? [],
      };
    }),
    total: Number(count?.total ?? 0),
  };
}

export type StudentEnrollmentRow = Student & {
  group_name: string | null;
  group_id: number | null;
};

/** Students filtered and paged in SQL with their active enrollment. */
export async function listStudentsWithEnrollmentPage(input: {
  query?: string;
  groupId?: number;
  status?: string;
  limit: number;
  offset: number;
}): Promise<PagedResult<StudentEnrollmentRow>> {
  const db = await getDb();
  const conditions = ["1 = 1"];
  const params: (string | number)[] = [];
  const query = input.query?.trim();

  if (query) {
    conditions.push("s.name LIKE ?");
    params.push(`%${query}%`);
  }
  if (input.groupId != null) {
    conditions.push("e.group_id = ?");
    params.push(input.groupId);
  }
  if (input.status) {
    conditions.push("s.status = ?");
    params.push(input.status);
  }

  const from = `FROM students s
    LEFT JOIN enrollments e
      ON e.student_id = s.id AND e.status = 'active'
    LEFT JOIN groups g ON g.id = e.group_id
    WHERE ${conditions.join(" AND ")}`;
  const count = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(DISTINCT s.id) as total ${from}`,
    params
  );
  const items = await db.getAllAsync<StudentEnrollmentRow>(
    `SELECT s.*, g.name as group_name, e.group_id as group_id
     ${from}
     ORDER BY s.name COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );

  return { items, total: Number(count?.total ?? 0) };
}

/** Active/paused students who are not currently enrolled in this group. */
export async function listStudentsNotInGroup(
  groupId: number
): Promise<StudentEnrollmentRow[]> {
  const db = await getDb();
  return db.getAllAsync<StudentEnrollmentRow>(
    `SELECT s.*, g.name as group_name, e.group_id as group_id
     FROM students s
     LEFT JOIN enrollments e
       ON e.student_id = s.id AND e.status = 'active'
     LEFT JOIN groups g ON g.id = e.group_id
     WHERE s.status != 'withdrawn'
       AND s.id NOT IN (
         SELECT e2.student_id FROM enrollments e2
         WHERE e2.group_id = ? AND e2.status = 'active'
       )
     ORDER BY s.name COLLATE NOCASE`,
    [groupId]
  );
}

/** Enroll several existing students and open a billing round for each. */
export async function enrollStudentsInGroup(
  studentIds: number[],
  groupId: number,
  startDate: string
): Promise<number> {
  const { openRoundForNewEnrollment } = await import("../services/rounds");
  let added = 0;
  for (const studentId of studentIds) {
    await enrollStudentInGroup(studentId, groupId, startDate);
    await openRoundForNewEnrollment(studentId, groupId);
    added += 1;
  }
  return added;
}

/** Case-insensitive name search for autocomplete. */
export async function searchStudentsByName(
  query: string,
  limit = 8
): Promise<Student[]> {
  const q = query.trim();
  if (!q) return [];
  const db = await getDb();
  return db.getAllAsync<Student>(
    `SELECT * FROM students
     WHERE name LIKE ? AND status = 'active'
     ORDER BY name COLLATE NOCASE
     LIMIT ?`,
    [`%${q}%`, limit]
  );
}

/**
 * Enroll an existing student into a group (ends other active enrollment).
 * No-op if already actively enrolled in this group.
 */
export async function enrollStudentInGroup(
  studentId: number,
  groupId: number,
  startDate: string
): Promise<void> {
  const { forceCloseOpenRoundsOn } = await import("../services/rounds");
  await withTransaction(async (db) => {
    const active = await db.getFirstAsync<Enrollment>(
      `SELECT * FROM enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`,
      [studentId]
    );
    if (active?.group_id === groupId) return;
    if (active) {
      await forceCloseOpenRoundsOn(db, {
        studentId,
        groupId: active.group_id,
      });
      await db.runAsync(
        `UPDATE enrollments SET status = 'ended', end_date = ? WHERE id = ?`,
        [startDate, active.id]
      );
    }
    await db.runAsync(
      `INSERT INTO enrollments
       (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
       VALUES (?, ?, ?, NULL, NULL, 'active')`,
      [studentId, groupId, startDate]
    );
    await db.runAsync(
      `UPDATE students SET status = 'active' WHERE id = ?`,
      [studentId]
    );
  });
}

/**
 * Assign a seat: link existing student or create a new one, then enroll in group.
 * If no existing id is provided, an exact name match (trimmed) reuses that student.
 */
export async function assignSeatToGroup(input: {
  group_id: number;
  name: string;
  existing_student_id?: number | null;
  start_date: string;
}): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new Error("اسم الطالب مطلوب");

  let studentId = input.existing_student_id ?? null;

  if (!studentId) {
    const db = await getDb();
    const exact = await db.getFirstAsync<Student>(
      `SELECT * FROM students
       WHERE lower(trim(name)) = lower(?) AND status = 'active'
       LIMIT 1`,
      [name]
    );
    if (exact) studentId = exact.id;
  }

  if (studentId) {
    await enrollStudentInGroup(studentId, input.group_id, input.start_date);
    const { openRoundForNewEnrollment } = await import("../services/rounds");
    await openRoundForNewEnrollment(studentId, input.group_id);
    return studentId;
  }

  const newId = await createStudent({
    name,
    group_id: input.group_id,
    start_date: input.start_date,
  });
  const { openRoundForNewEnrollment } = await import("../services/rounds");
  await openRoundForNewEnrollment(newId, input.group_id);
  return newId;
}

export async function getStudent(id: number): Promise<Student | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Student>("SELECT * FROM students WHERE id = ?", [
      id,
    ])) ?? null
  );
}

export async function createStudent(input: {
  name: string;
  student_phone?: string | null;
  guardian_phone?: string | null;
  notes?: string | null;
  status?: string;
  /** Optional — student can be created without a group enrollment. */
  group_id?: number | null;
  custom_monthly_fee?: number | null;
  start_date?: string;
}): Promise<number> {
  const groupId =
    input.group_id != null && Number.isFinite(input.group_id)
      ? Number(input.group_id)
      : null;

  return withTransaction(async (db) => {
    const r = await db.runAsync(
      `INSERT INTO students (name, student_phone, guardian_phone, notes, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.name,
        input.student_phone ?? null,
        input.guardian_phone ?? null,
        input.notes ?? null,
        input.status ?? "active",
      ]
    );
    const studentId = Number(r.lastInsertRowId);
    if (groupId != null) {
      await db.runAsync(
        `INSERT INTO enrollments
         (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
         VALUES (?, ?, ?, NULL, ?, 'active')`,
        [
          studentId,
          groupId,
          input.start_date ?? new Date().toISOString().slice(0, 10),
          input.custom_monthly_fee ?? null,
        ]
      );
    }
    return studentId;
  }).then(async (studentId) => {
    if (groupId != null) {
      const { openRoundForNewEnrollment } = await import("../services/rounds");
      await openRoundForNewEnrollment(studentId, groupId);
    }
    return studentId;
  });
}

export async function updateStudent(
  id: number,
  input: {
    name: string;
    student_phone?: string | null;
    guardian_phone?: string | null;
    notes?: string | null;
    status: string;
    /** Null/undefined clears the active group enrollment. */
    group_id?: number | null;
    custom_monthly_fee?: number | null;
  }
): Promise<void> {
  const groupId =
    input.group_id != null && Number.isFinite(input.group_id)
      ? Number(input.group_id)
      : null;

  const { forceCloseOpenRoundsOn } = await import("../services/rounds");
  let openRoundForGroup: number | null = null;

  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE students SET name = ?, student_phone = ?, guardian_phone = ?, notes = ?, status = ? WHERE id = ?`,
      [
        input.name,
        input.student_phone ?? null,
        input.guardian_phone ?? null,
        input.notes ?? null,
        input.status,
        id,
      ]
    );
    const active = await db.getFirstAsync<Enrollment>(
      `SELECT * FROM enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`,
      [id]
    );
    if (groupId == null) {
      if (active) {
        await forceCloseOpenRoundsOn(db, {
          studentId: id,
          groupId: active.group_id,
        });
        await db.runAsync(
          `UPDATE enrollments SET status = 'ended', end_date = date('now') WHERE id = ?`,
          [active.id]
        );
      }
      return;
    }
    if (active) {
      if (active.group_id !== groupId) {
        await forceCloseOpenRoundsOn(db, {
          studentId: id,
          groupId: active.group_id,
        });
        await db.runAsync(
          `UPDATE enrollments SET status = 'ended', end_date = date('now') WHERE id = ?`,
          [active.id]
        );
        await db.runAsync(
          `INSERT INTO enrollments
           (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
           VALUES (?, ?, date('now'), NULL, ?, 'active')`,
          [id, groupId, input.custom_monthly_fee ?? null]
        );
        openRoundForGroup = groupId;
      } else {
        await db.runAsync(
          `UPDATE enrollments SET custom_monthly_fee = ? WHERE id = ?`,
          [input.custom_monthly_fee ?? null, active.id]
        );
      }
    } else {
      await db.runAsync(
        `INSERT INTO enrollments
         (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
         VALUES (?, ?, date('now'), NULL, ?, 'active')`,
        [id, groupId, input.custom_monthly_fee ?? null]
      );
      openRoundForGroup = groupId;
    }
  });

  if (openRoundForGroup != null) {
    const { openRoundForNewEnrollment } = await import("../services/rounds");
    await openRoundForNewEnrollment(id, openRoundForGroup);
  }
}

export async function deleteStudent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM students WHERE id = ?", [id]);
}

/** Delete many students in one transaction (cascades enrollments / attendance). */
export async function deleteStudents(ids: number[]): Promise<number> {
  const unique = [
    ...new Set(ids.filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (!unique.length) return 0;
  await withTransaction(async (db) => {
    const chunkSize = 200;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const part = unique.slice(i, i + chunkSize);
      await db.runAsync(
        `DELETE FROM students WHERE id IN (${part.map(() => "?").join(",")})`,
        part
      );
    }
  });
  return unique.length;
}

export async function getActiveEnrollment(
  studentId: number
): Promise<(Enrollment & { group_name?: string }) | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Enrollment & { group_name: string }>(
      `SELECT e.*, g.name as group_name
       FROM enrollments e
       JOIN groups g ON g.id = e.group_id
       WHERE e.student_id = ? AND e.status = 'active'
       LIMIT 1`,
      [studentId]
    )) ?? null
  );
}

export async function listActiveStudentsInGroup(
  groupId: number
): Promise<Student[]> {
  const db = await getDb();
  return db.getAllAsync<Student>(
    `SELECT s.* FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.group_id = ? AND e.status = 'active' AND s.status = 'active'
     ORDER BY s.name COLLATE NOCASE`,
    [groupId]
  );
}

// ─── Sessions ─────────────────────────────────────────────────

export async function listSessionsForGroup(
  groupId: number,
  studyMonthId?: number
): Promise<GroupSession[]> {
  const db = await getDb();
  if (studyMonthId != null) {
    return db.getAllAsync<GroupSession>(
      `SELECT * FROM group_sessions
       WHERE group_id = ? AND study_month_id = ?
       ORDER BY starts_at`,
      [groupId, studyMonthId]
    );
  }
  return db.getAllAsync<GroupSession>(
    `SELECT * FROM group_sessions WHERE group_id = ? ORDER BY starts_at`,
    [groupId]
  );
}

/** Group sessions filtered and paged in SQL. */
export async function listSessionsForGroupPage(input: {
  groupId: number;
  status?: GroupSession["status"];
  limit: number;
  offset: number;
}): Promise<PagedResult<GroupSession>> {
  const db = await getDb();
  const conditions = ["group_id = ?"];
  const params: (string | number)[] = [input.groupId];
  if (input.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }
  const where = conditions.join(" AND ");
  const count = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM group_sessions WHERE ${where}`,
    params
  );
  const items = await db.getAllAsync<GroupSession>(
    `SELECT * FROM group_sessions
     WHERE ${where}
     ORDER BY starts_at
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );
  return { items, total: Number(count?.total ?? 0) };
}

export async function getSession(id: number): Promise<GroupSession | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<GroupSession>(
      "SELECT * FROM group_sessions WHERE id = ?",
      [id]
    )) ?? null
  );
}

export async function updateSessionStatus(
  id: number,
  status: GroupSession["status"]
): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE group_sessions SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
}

/** Move a session clock + study month; typically used with source=manual. */
export async function updateSessionSchedule(input: {
  id: number;
  starts_at: string;
  ends_at: string;
  study_month_id: number;
  status: GroupSession["status"];
  source: GroupSession["source"];
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE group_sessions
     SET starts_at = ?, ends_at = ?, study_month_id = ?, status = ?, source = ?
     WHERE id = ?`,
    [
      input.starts_at,
      input.ends_at,
      input.study_month_id,
      input.status,
      input.source,
      input.id,
    ]
  );
}

export async function updateSessionNotes(
  id: number,
  notes: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE group_sessions SET notes = ? WHERE id = ?", [
    notes,
    id,
  ]);
}

/** Recent attendance rows for a student (newest first). */
export async function listStudentAttendanceHistory(
  studentId: number,
  limit = 20
): Promise<
  {
    session_id: number;
    starts_at: string;
    group_name: string;
    status: string;
    homework_done: number;
  }[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT a.session_id, gs.starts_at, g.name as group_name, a.status,
            COALESCE(a.homework_done, 0) as homework_done
     FROM attendances a
     JOIN group_sessions gs ON gs.id = a.session_id
     JOIN groups g ON g.id = gs.group_id
     WHERE a.student_id = ?
     ORDER BY gs.starts_at DESC
     LIMIT ?`,
    [studentId, limit]
  );
}

/** Payment rows for a student (newest first). */
export async function listStudentPayments(
  studentId: number,
  limit = 30
): Promise<
  (Payment & {
    group_name: string | null;
    round_number: number | null;
  })[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT p.*, g.name as group_name, br.round_number as round_number
     FROM payments p
     LEFT JOIN groups g ON g.id = p.group_id
     LEFT JOIN billing_rounds br ON br.id = p.billing_round_id
     WHERE p.student_id = ?
     ORDER BY p.paid_at DESC, p.id DESC
     LIMIT ?`,
    [studentId, limit]
  );
}

/** Open-round unpaid remaining total for a student (scoped dues only). */
export async function getStudentOpenRemaining(
  studentId: number
): Promise<number> {
  const { getRoundDuesForStudent } = await import("../services/rounds");
  const dues = await getRoundDuesForStudent(studentId);
  return dues.reduce((sum, d) => sum + d.remaining, 0);
}

/** Attendance rate per active enrollment student (scoped to current group sessions). */
export async function getAttendanceRatesByStudent(): Promise<
  { student_id: number; student_name: string; present: number; total: number }[]
> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT s.id as student_id, s.name as student_name,
       SUM(CASE WHEN gs.id IS NOT NULL AND a.status = 'present' THEN 1 ELSE 0 END) as present,
       COUNT(gs.id) as total
     FROM students s
     JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
     LEFT JOIN attendances a ON a.student_id = s.id
     LEFT JOIN group_sessions gs
       ON gs.id = a.session_id AND gs.group_id = e.group_id
     WHERE s.status = 'active'
     GROUP BY s.id
     ORDER BY s.name COLLATE NOCASE`
  );
}

/** Attendance coverage per session for a group (active enrolled students). */
export async function getSessionAttendanceCoverage(
  groupId: number,
  sessionIds?: number[]
): Promise<Record<number, { marked: number; total: number }>> {
  if (sessionIds && !sessionIds.length) return {};
  const db = await getDb();
  const sessionFilter = sessionIds?.length
    ? `AND gs.id IN (${sessionIds.map(() => "?").join(",")})`
    : "";
  const roster = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.group_id = ?
       AND e.status = 'active'
       AND s.status = 'active'`,
    [groupId]
  );
  const total = Number(roster?.total ?? 0);
  const rows = await db.getAllAsync<{
    session_id: number;
    marked: number;
  }>(
    `SELECT
       gs.id as session_id,
       COUNT(CASE WHEN e.id IS NOT NULL AND s.id IS NOT NULL THEN a.id END) as marked
     FROM group_sessions gs
     LEFT JOIN attendances a ON a.session_id = gs.id
     LEFT JOIN students s ON s.id = a.student_id AND s.status = 'active'
     LEFT JOIN enrollments e
       ON e.student_id = a.student_id
      AND e.group_id = gs.group_id
      AND e.status = 'active'
     WHERE gs.group_id = ?
       ${sessionFilter}
     GROUP BY gs.id`,
    [groupId, ...(sessionIds ?? [])]
  );
  const map: Record<number, { marked: number; total: number }> = {};
  for (const r of rows) {
    map[r.session_id] = {
      marked: Number(r.marked ?? 0),
      total,
    };
  }
  return map;
}

export async function listUpcomingSessions(
  limit = 8
): Promise<
  (GroupSession & { group_name: string; accent_color: string | null })[]
> {
  const db = await getDb();
  return db.getAllAsync<
    GroupSession & { group_name: string; accent_color: string | null }
  >(
    `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE g.status = 'active'
       AND gs.status IN ('scheduled', 'rescheduled') AND gs.starts_at >= datetime('now', 'localtime')
     ORDER BY gs.starts_at
     LIMIT ?`,
    [limit]
  );
}

/** Sessions for local calendar today, nearest time first. */
export async function listTodaysSessions(): Promise<
  (GroupSession & { group_name: string; accent_color: string | null })[]
> {
  const db = await getDb();
  return db.getAllAsync<
    GroupSession & { group_name: string; accent_color: string | null }
  >(
    `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE g.status = 'active'
       AND date(gs.starts_at) = date('now', 'localtime')
       AND gs.status != 'cancelled'
     ORDER BY gs.starts_at ASC`
  );
}

export type TodaySessionRow = GroupSession & {
  group_name: string;
  accent_color: string | null;
};

/** Today's sessions filtered and paged in SQL. */
export async function listTodaysSessionsPage(input: {
  status?: GroupSession["status"];
  limit: number;
  offset: number;
}): Promise<PagedResult<TodaySessionRow>> {
  const db = await getDb();
  const conditions = [
    "g.status = 'active'",
    "date(gs.starts_at) = date('now', 'localtime')",
    "gs.status != 'cancelled'",
  ];
  const params: (string | number)[] = [];
  if (input.status) {
    conditions.push("gs.status = ?");
    params.push(input.status);
  }
  const where = conditions.join(" AND ");
  const count = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE ${where}`,
    params
  );
  const items = await db.getAllAsync<TodaySessionRow>(
    `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE ${where}
     ORDER BY gs.starts_at ASC
     LIMIT ? OFFSET ?`,
    [...params, input.limit, input.offset]
  );
  return { items, total: Number(count?.total ?? 0) };
}

/**
 * Sessions in a Sat–Fri week.
 * @param weekStartSat - local `YYYY-MM-DD` of that week's Saturday; omit = week containing today.
 */
export async function listWeekSessions(
  weekStartSat?: string
): Promise<
  (GroupSession & { group_name: string; accent_color: string | null })[]
> {
  const db = await getDb();
  if (weekStartSat && /^\d{4}-\d{2}-\d{2}$/.test(weekStartSat)) {
    return db.getAllAsync<
      GroupSession & { group_name: string; accent_color: string | null }
    >(
      `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
       FROM group_sessions gs
       JOIN groups g ON g.id = gs.group_id
       WHERE g.status = 'active'
         AND gs.status != 'cancelled'
         AND date(gs.starts_at) >= date(?)
         AND date(gs.starts_at) < date(?, '+7 days')
       ORDER BY gs.starts_at ASC`,
      [weekStartSat, weekStartSat]
    );
  }
  // SQL: weekday 0=Sun … 6=Sat. Arabic week Sat→Fri containing today.
  return db.getAllAsync<
    GroupSession & { group_name: string; accent_color: string | null }
  >(
    `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE g.status = 'active'
       AND gs.status != 'cancelled'
       AND date(gs.starts_at) >= date('now', 'localtime',
         printf('-%d days', (CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 1) % 7))
       AND date(gs.starts_at) < date('now', 'localtime',
         printf('-%d days', (CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 1) % 7),
         '+7 days')
     ORDER BY gs.starts_at ASC`
  );
}

export async function setSessionStarStudent(
  sessionId: number,
  studentId: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE group_sessions SET star_student_id = ? WHERE id = ?",
    [studentId, sessionId]
  );
}

/**
 * Month star is display-only: student with the most class-star awards
 * in that round's sessions. Falls back to stored round_stars (e.g. backup).
 */
async function computeRoundStarsFromSessions(
  groupId: number
): Promise<Record<number, { student_id: number; student_name: string }>> {
  const db = await getDb();
  const group = await db.getFirstAsync<{ classes_per_round: number }>(
    "SELECT classes_per_round FROM groups WHERE id = ?",
    [groupId]
  );
  const per = Math.max(1, group?.classes_per_round ?? 4);
  const sessions = await db.getAllAsync<{ star_student_id: number | null }>(
    `SELECT star_student_id FROM group_sessions
     WHERE group_id = ? AND status != 'cancelled'
     ORDER BY starts_at ASC`,
    [groupId]
  );

  const countsByRound = new Map<number, Map<number, number>>();
  sessions.forEach((s, i) => {
    if (s.star_student_id == null) return;
    const roundNumber = Math.floor(i / per) + 1;
    let counts = countsByRound.get(roundNumber);
    if (!counts) {
      counts = new Map();
      countsByRound.set(roundNumber, counts);
    }
    counts.set(
      s.star_student_id,
      (counts.get(s.star_student_id) ?? 0) + 1
    );
  });

  const winners: { round_number: number; student_id: number }[] = [];
  for (const [roundNumber, counts] of countsByRound) {
    let bestId: number | null = null;
    let bestCount = 0;
    for (const [studentId, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = studentId;
      }
    }
    if (bestId != null) {
      winners.push({ round_number: roundNumber, student_id: bestId });
    }
  }

  if (!winners.length) return {};

  const ids = [...new Set(winners.map((w) => w.student_id))];
  const placeholders = ids.map(() => "?").join(",");
  const names = await db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM students WHERE id IN (${placeholders})`,
    ids
  );
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  const map: Record<number, { student_id: number; student_name: string }> = {};
  for (const w of winners) {
    const student_name = nameById.get(w.student_id);
    if (!student_name) continue;
    map[w.round_number] = {
      student_id: w.student_id,
      student_name,
    };
  }
  return map;
}

async function listStoredRoundStars(
  groupId: number
): Promise<Record<number, { student_id: number; student_name: string }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    round_number: number;
    student_id: number;
    student_name: string;
  }>(
    `SELECT rs.round_number, rs.student_id, s.name as student_name
     FROM round_stars rs
     JOIN students s ON s.id = rs.student_id
     WHERE rs.group_id = ?`,
    [groupId]
  );
  const map: Record<number, { student_id: number; student_name: string }> = {};
  for (const r of rows) {
    map[r.round_number] = {
      student_id: r.student_id,
      student_name: r.student_name,
    };
  }
  return map;
}

/** Month/round stars for a group (computed for display). */
export async function listRoundStarsForGroup(
  groupId: number
): Promise<Record<number, { student_id: number; student_name: string }>> {
  const computed = await computeRoundStarsFromSessions(groupId);
  const stored = await listStoredRoundStars(groupId);
  return { ...stored, ...computed };
}

export async function getRoundStar(
  groupId: number,
  roundNumber: number
): Promise<{ student_id: number; student_name: string } | null> {
  const all = await listRoundStarsForGroup(groupId);
  return all[roundNumber] ?? null;
}

/** Kept for backup restore compatibility — UI does not set month stars. */
export async function setRoundStar(
  groupId: number,
  roundNumber: number,
  studentId: number | null
): Promise<void> {
  const db = await getDb();
  if (studentId == null) {
    await db.runAsync(
      "DELETE FROM round_stars WHERE group_id = ? AND round_number = ?",
      [groupId, roundNumber]
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO round_stars (group_id, round_number, student_id)
     VALUES (?, ?, ?)
     ON CONFLICT(group_id, round_number) DO UPDATE SET student_id = excluded.student_id`,
    [groupId, roundNumber, studentId]
  );
}

export async function sessionHasAttendance(sessionId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM attendances WHERE session_id = ?",
    [sessionId]
  );
  return (row?.c ?? 0) > 0;
}

export async function insertSession(input: {
  group_id: number;
  study_month_id: number;
  starts_at: string;
  ends_at: string;
  session_index: number;
  source?: "auto" | "manual";
}): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO group_sessions
     (group_id, study_month_id, starts_at, ends_at, session_index, status, source)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      input.group_id,
      input.study_month_id,
      input.starts_at,
      input.ends_at,
      input.session_index,
      input.source ?? "auto",
    ]
  );
  return Number(r.lastInsertRowId);
}

/** Next session_index for a group (max existing + 1). */
export async function nextSessionIndexForGroup(
  groupId: number
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ m: number | null }>(
    "SELECT MAX(session_index) AS m FROM group_sessions WHERE group_id = ?",
    [groupId]
  );
  return Number(row?.m ?? 0) + 1;
}

export async function deleteSessionIfNoAttendance(
  sessionId: number
): Promise<boolean> {
  if (await sessionHasAttendance(sessionId)) return false;
  const db = await getDb();
  await db.runAsync("DELETE FROM group_sessions WHERE id = ?", [sessionId]);
  return true;
}

export async function findSessionByStart(
  groupId: number,
  startsAt: string
): Promise<GroupSession | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<GroupSession>(
      `SELECT * FROM group_sessions WHERE group_id = ? AND starts_at = ? LIMIT 1`,
      [groupId, startsAt]
    )) ?? null
  );
}

// ─── Attendance ───────────────────────────────────────────────

export async function listAttendanceForSession(
  sessionId: number
): Promise<Attendance[]> {
  const db = await getDb();
  return db.getAllAsync<Attendance>(
    "SELECT * FROM attendances WHERE session_id = ?",
    [sessionId]
  );
}

export async function upsertAttendance(input: {
  session_id: number;
  student_id: number;
  status: AttendanceStatus;
  notes?: string | null;
  homework_done?: boolean;
}): Promise<void> {
  const db = await getDb();
  const homework =
    input.homework_done == null ? null : input.homework_done ? 1 : 0;
  await db.runAsync(
    `INSERT INTO attendances (session_id, student_id, status, notes, homework_done)
     VALUES (?, ?, ?, ?, COALESCE(?, 0))
     ON CONFLICT(session_id, student_id) DO UPDATE SET
       status = excluded.status,
       notes = COALESCE(excluded.notes, attendances.notes),
       homework_done = COALESCE(?, attendances.homework_done)`,
    [
      input.session_id,
      input.student_id,
      input.status,
      input.notes ?? null,
      homework,
      homework,
    ]
  );
  const session = await db.getFirstAsync<{ group_id: number }>(
    "SELECT group_id FROM group_sessions WHERE id = ?",
    [input.session_id]
  );
  if (session) {
    const { onAttendanceChanged } = await import("../services/rounds");
    await onAttendanceChanged(input.student_id, session.group_id);
  }
}

/** Set or clear homework for one student in a session (keeps attendance status). */
export async function upsertHomeworkDone(input: {
  session_id: number;
  student_id: number;
  homework_done: boolean;
}): Promise<boolean> {
  const db = await getDb();
  const done = input.homework_done ? 1 : 0;
  const result = await db.runAsync(
    `UPDATE attendances
     SET homework_done = ?
     WHERE session_id = ? AND student_id = ?`,
    [done, input.session_id, input.student_id]
  );
  // No insert / no round sync — homework must not create countable attendance.
  return (result.changes ?? 0) > 0;
}

/** Mark many students in one transaction, then refresh round counters once per student. */
export async function upsertAttendanceBatch(
  sessionId: number,
  studentIds: number[],
  status: AttendanceStatus
): Promise<void> {
  if (!studentIds.length) return;
  const session = await (await getDb()).getFirstAsync<{ group_id: number }>(
    "SELECT group_id FROM group_sessions WHERE id = ?",
    [sessionId]
  );
  await withTransaction(async (db) => {
    for (const studentId of studentIds) {
      await db.runAsync(
        `INSERT INTO attendances (session_id, student_id, status, notes, homework_done)
         VALUES (?, ?, ?, NULL, 0)
         ON CONFLICT(session_id, student_id) DO UPDATE SET
           status = excluded.status`,
        [sessionId, studentId, status]
      );
    }
  });
  if (session) {
    const { onAttendanceChangedBatch } = await import("../services/rounds");
    await onAttendanceChangedBatch(studentIds, session.group_id);
  }
}

/** Bulk set homework done/not for every listed student in a session. */
export async function upsertHomeworkBatch(
  sessionId: number,
  studentIds: number[],
  homeworkDone: boolean
): Promise<number> {
  if (!studentIds.length) return 0;
  const done = homeworkDone ? 1 : 0;
  let updated = 0;
  await withTransaction(async (db) => {
    for (const studentId of studentIds) {
      const result = await db.runAsync(
        `UPDATE attendances
         SET homework_done = ?
         WHERE session_id = ? AND student_id = ?`,
        [done, sessionId, studentId]
      );
      updated += result.changes ?? 0;
    }
  });
  return updated;
}

// ─── Payments ─────────────────────────────────────────────────

export async function listPayments(): Promise<
  (Payment & {
    student_name: string;
    round_number?: number | null;
    round_started_at?: string | null;
    round_closed_at?: string | null;
  })[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    Payment & {
      student_name: string;
      round_number?: number | null;
      round_started_at?: string | null;
      round_closed_at?: string | null;
    }
  >(
    `SELECT p.*, s.name as student_name,
       br.round_number as round_number,
       br.started_at as round_started_at,
       br.closed_at as round_closed_at
     FROM payments p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN billing_rounds br ON br.id = p.billing_round_id
     ORDER BY p.paid_at DESC, p.id DESC`
  );

  const cache = new Map<
    number,
    Map<number, { started_at: string; closed_at: string | null }>
  >();

  const out = [];
  for (const row of rows) {
    if (row.group_id != null && row.round_number != null) {
      let ranges = cache.get(row.group_id);
      if (!ranges) {
        ranges = await getSessionRoundDateRanges(row.group_id);
        cache.set(row.group_id, ranges);
      }
      const range = ranges.get(row.round_number);
      if (range) {
        out.push({
          ...row,
          round_started_at: range.started_at,
          round_closed_at: range.closed_at,
        });
        continue;
      }
    }
    out.push(row);
  }
  return out;
}

export async function createPayment(input: {
  student_id: number;
  billing_round_id: number;
  study_month_id?: number | null;
  group_id?: number | null;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  note?: string | null;
}): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync(
    `INSERT INTO payments
     (student_id, study_month_id, billing_round_id, group_id, amount, paid_at, method, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.student_id,
      input.study_month_id ?? null,
      input.billing_round_id,
      input.group_id ?? null,
      input.amount,
      input.paid_at,
      input.method,
      input.note ?? null,
    ]
  );
  return Number(r.lastInsertRowId);
}

export async function updatePayment(
  id: number,
  input: {
    amount: number;
    paid_at: string;
    method: PaymentMethod;
    note?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE payments SET amount = ?, paid_at = ?, method = ?, note = ? WHERE id = ?`,
    [input.amount, input.paid_at, input.method, input.note ?? null, id]
  );
}

export async function deletePayment(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM payments WHERE id = ?", [id]);
}

export async function deletePaymentsForBillingRound(
  billingRoundId: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM payments WHERE billing_round_id = ?", [
    billingRoundId,
  ]);
}

export async function getPayment(id: number): Promise<Payment | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<Payment>("SELECT * FROM payments WHERE id = ?", [
      id,
    ])) ?? null
  );
}
