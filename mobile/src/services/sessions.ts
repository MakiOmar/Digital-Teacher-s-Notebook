import {
  ensureStudyMonthForYearMonth,
  findSessionByStart,
  getActiveYear,
  getSession,
  listActiveStudentsInGroup,
  updateSessionSchedule,
  updateSessionStatus,
} from "../repositories";
import {
  combineDateAndTime,
  dateOnlyFromDateTime,
  todayDateOnly,
  toDateTimeLocal,
} from "../utils/date";
import { onAttendanceChangedBatch } from "./rounds";

function timeHmFromDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const m = /T(\d{2}):(\d{2})/.exec(value);
    if (m) return `${m[1]}:${m[2]}`;
    return "00:00";
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function durationMs(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 60 * 60 * 1000;
  }
  return end - start;
}

/** Soft-cancel a class; keep history and refresh round progress. */
export async function cancelGroupSession(sessionId: number): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("الحصة غير موجودة");
  if (session.status === "completed") {
    throw new Error("لا يمكن إلغاء حصة مكتملة — أعد فتحها أولاً");
  }
  if (session.status === "cancelled") return;

  await updateSessionStatus(sessionId, "cancelled");
  const students = await listActiveStudentsInGroup(session.group_id);
  if (students.length) {
    await onAttendanceChangedBatch(
      students.map((s) => s.id),
      session.group_id
    );
  }
}

/** Restore a soft-cancelled session to scheduled. */
export async function restoreGroupSession(sessionId: number): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("الحصة غير موجودة");
  if (session.status !== "cancelled") return;

  await updateSessionStatus(sessionId, "scheduled");
  const students = await listActiveStudentsInGroup(session.group_id);
  if (students.length) {
    await onAttendanceChangedBatch(
      students.map((s) => s.id),
      session.group_id
    );
  }
}

/**
 * Move a session to a new local date + start time.
 * Keeps the previous duration, rebinds study month, marks source manual
 * so schedule regen does not delete the moved slot.
 */
export async function rescheduleGroupSession(
  sessionId: number,
  dateOnly: string,
  startTimeHm: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("الحصة غير موجودة");
  if (session.status === "completed") {
    throw new Error("لا يمكن تغيير موعد حصة مكتملة — أعد فتحها أولاً");
  }

  const startsAt = combineDateAndTime(dateOnly, startTimeHm);
  const endsAt = toDateTimeLocal(
    new Date(new Date(startsAt).getTime() + durationMs(session.starts_at, session.ends_at))
  );

  const conflict = await findSessionByStart(session.group_id, startsAt);
  if (conflict && conflict.id !== sessionId) {
    throw new Error("يوجد حصة أخرى في نفس الموعد لهذه المجموعة");
  }

  const year = await getActiveYear();
  if (!year) throw new Error("لا توجد سنة دراسية نشطة");

  const day = dateOnlyFromDateTime(startsAt) ?? dateOnly;
  const yearMonth = day.slice(0, 7);
  const month = await ensureStudyMonthForYearMonth(year.id, yearMonth);

  await updateSessionSchedule({
    id: sessionId,
    starts_at: startsAt,
    ends_at: endsAt,
    study_month_id: month.id,
    status: "scheduled",
    source: "manual",
  });

  const students = await listActiveStudentsInGroup(session.group_id);
  if (students.length) {
    await onAttendanceChangedBatch(
      students.map((s) => s.id),
      session.group_id
    );
  }
}

export function sessionDateAndTime(session: {
  starts_at: string;
}): { date: string; time: string } {
  return {
    date: dateOnlyFromDateTime(session.starts_at) ?? todayDateOnly(),
    time: timeHmFromDateTime(session.starts_at),
  };
}
