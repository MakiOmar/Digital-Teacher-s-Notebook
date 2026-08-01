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
import { monthBounds, yearMonthLabel, monthsOverlappingRange } from "../utils/date";
import { getSessionRoundDateRanges } from "../services/rounds";

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
  await db.runAsync("DELETE FROM academic_years WHERE id = ?", [id]);
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
  patterns: { weekday: Weekday; start_time: string; end_time: string }[];
}): Promise<number> {
  return withTransaction(async (db) => {
    const r = await db.runAsync(
      `INSERT INTO groups (name, subject, default_monthly_fee, classes_per_round, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [
        input.name,
        input.subject ?? null,
        input.default_monthly_fee,
        input.classes_per_round ?? 4,
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
    patterns: { weekday: Weekday; start_time: string; end_time: string }[];
  }
): Promise<void> {
  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE groups SET name = ?, subject = ?, default_monthly_fee = ?, classes_per_round = ? WHERE id = ?`,
      [
        input.name,
        input.subject ?? null,
        input.default_monthly_fee,
        input.classes_per_round ?? 4,
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

export async function softDeleteGroup(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE groups SET status = 'paused' WHERE id = ?", [id]);
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
  await withTransaction(async (db) => {
    const active = await db.getFirstAsync<Enrollment>(
      `SELECT * FROM enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`,
      [studentId]
    );
    if (active?.group_id === groupId) return;
    if (active) {
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
  guardian_phone?: string | null;
  notes?: string | null;
  status?: string;
  group_id: number;
  custom_monthly_fee?: number | null;
  start_date: string;
}): Promise<number> {
  return withTransaction(async (db) => {
    const r = await db.runAsync(
      `INSERT INTO students (name, guardian_phone, notes, status)
       VALUES (?, ?, ?, ?)`,
      [
        input.name,
        input.guardian_phone ?? null,
        input.notes ?? null,
        input.status ?? "active",
      ]
    );
    const studentId = Number(r.lastInsertRowId);
    await db.runAsync(
      `INSERT INTO enrollments
       (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
       VALUES (?, ?, ?, NULL, ?, 'active')`,
      [
        studentId,
        input.group_id,
        input.start_date,
        input.custom_monthly_fee ?? null,
      ]
    );
    return studentId;
  }).then(async (studentId) => {
    const { openRoundForNewEnrollment } = await import("../services/rounds");
    await openRoundForNewEnrollment(studentId, input.group_id);
    return studentId;
  });
}

export async function updateStudent(
  id: number,
  input: {
    name: string;
    guardian_phone?: string | null;
    notes?: string | null;
    status: string;
    group_id: number;
    custom_monthly_fee?: number | null;
  }
): Promise<void> {
  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE students SET name = ?, guardian_phone = ?, notes = ?, status = ? WHERE id = ?`,
      [
        input.name,
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
    if (active) {
      if (active.group_id !== input.group_id) {
        await db.runAsync(
          `UPDATE enrollments SET status = 'ended', end_date = date('now') WHERE id = ?`,
          [active.id]
        );
        await db.runAsync(
          `INSERT INTO enrollments
           (student_id, group_id, start_date, end_date, custom_monthly_fee, status)
           VALUES (?, ?, date('now'), NULL, ?, 'active')`,
          [id, input.group_id, input.custom_monthly_fee ?? null]
        );
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
        [id, input.group_id, input.custom_monthly_fee ?? null]
      );
    }
  });
}

export async function deleteStudent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM students WHERE id = ?", [id]);
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

/** Attendance coverage per session for a group (active enrolled students). */
export async function getSessionAttendanceCoverage(
  groupId: number
): Promise<Record<number, { marked: number; total: number }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    session_id: number;
    marked: number;
    total: number;
  }>(
    `SELECT
       gs.id as session_id,
       (
         SELECT COUNT(*)
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         WHERE e.group_id = gs.group_id
           AND e.status = 'active'
           AND s.status = 'active'
       ) as total,
       (
         SELECT COUNT(*)
         FROM attendances a
         JOIN students s ON s.id = a.student_id AND s.status = 'active'
         JOIN enrollments e
           ON e.student_id = a.student_id
          AND e.group_id = gs.group_id
          AND e.status = 'active'
         WHERE a.session_id = gs.id
       ) as marked
     FROM group_sessions gs
     WHERE gs.group_id = ?`,
    [groupId]
  );
  const map: Record<number, { marked: number; total: number }> = {};
  for (const r of rows) {
    map[r.session_id] = {
      marked: Number(r.marked ?? 0),
      total: Number(r.total ?? 0),
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
     WHERE gs.status = 'scheduled' AND gs.starts_at >= datetime('now', 'localtime')
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
     WHERE date(gs.starts_at) = date('now', 'localtime')
       AND gs.status != 'cancelled'
     ORDER BY gs.starts_at ASC`
  );
}

/** Sessions in the week containing today (Sat–Fri), for weekly grid. */
export async function listWeekSessions(): Promise<
  (GroupSession & { group_name: string; accent_color: string | null })[]
> {
  const db = await getDb();
  // SQLite: weekday 0=Sun … 6=Sat. Arabic week Sat→Fri.
  // Start = today - ((dow+1)%7) days to land on Saturday.
  return db.getAllAsync<
    GroupSession & { group_name: string; accent_color: string | null }
  >(
    `SELECT gs.*, g.name as group_name, g.accent_color as accent_color
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id
     WHERE gs.status != 'cancelled'
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

/** Month/round star for a group (one student per round_number). */
export async function listRoundStarsForGroup(
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

export async function getRoundStar(
  groupId: number,
  roundNumber: number
): Promise<{ student_id: number; student_name: string } | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<{ student_id: number; student_name: string }>(
      `SELECT rs.student_id, s.name as student_name
       FROM round_stars rs
       JOIN students s ON s.id = rs.student_id
       WHERE rs.group_id = ? AND rs.round_number = ?`,
      [groupId, roundNumber]
    )) ?? null
  );
}

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
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO attendances (session_id, student_id, status, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, student_id) DO UPDATE SET
       status = excluded.status,
       notes = excluded.notes`,
    [
      input.session_id,
      input.student_id,
      input.status,
      input.notes ?? null,
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
