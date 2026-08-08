import {
  listPatterns,
  listSessionsForGroup,
  insertSession,
  deleteSessionIfNoAttendance,
  findSessionByStart,
  getActiveYear,
  getGroup,
  ensureStudyMonthForYearMonth,
} from "../repositories";
import {
  combineDateAndTime,
  datesForWeekdayInRange,
  monthsOverlappingRange,
  resolveGroupScheduleEnd,
  todayDateOnly,
} from "../utils/date";
import { withTransaction } from "../db/client";

export type GenerateResult = {
  created: number;
  skippedExisting: number;
  protectedWithAttendance: number;
};

/**
 * Generate sessions for a group from its own start/end dates.
 * Start may be any calendar date (before/after semester or year bounds).
 */
export async function generateSessionsForGroup(
  groupId: number
): Promise<GenerateResult> {
  return withTransaction(() => generateSessionsForGroupInTransaction(groupId));
}

async function generateSessionsForGroupInTransaction(
  groupId: number
): Promise<GenerateResult> {
  const patterns = await listPatterns(groupId);
  if (!patterns.length) {
    throw new Error("لا يوجد موعد أسبوعي لهذه المجموعة");
  }

  const group = await getGroup(groupId);
  if (!group) throw new Error("المجموعة غير موجودة");

  const year = await getActiveYear();
  if (!year) throw new Error("لا توجد سنة دراسية نشطة");

  const rangeStart = group.start_date || todayDateOnly();
  const rangeEnd = resolveGroupScheduleEnd(
    rangeStart,
    group.end_date,
    year.end_date
  );

  const monthSlices = monthsOverlappingRange(rangeStart, rangeEnd);

  let created = 0;
  let skippedExisting = 0;
  let protectedWithAttendance = 0;

  const desiredStarts = new Set<string>();

  for (const slice of monthSlices) {
    const month = await ensureStudyMonthForYearMonth(
      year.id,
      slice.yearMonth,
      slice.start,
      slice.end
    );

    const desired: { starts_at: string; ends_at: string }[] = [];
    for (const p of patterns) {
      const dates = datesForWeekdayInRange(
        p.weekday,
        slice.start,
        slice.end
      );
      for (const date of dates) {
        desired.push({
          starts_at: combineDateAndTime(date, p.start_time),
          ends_at: combineDateAndTime(date, p.end_time),
        });
      }
    }
    desired.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    for (const d of desired) desiredStarts.add(d.starts_at);

    const existingInMonth = await listSessionsForGroup(groupId, month.id);
    for (const s of existingInMonth) {
      if (s.source !== "auto") continue;
      if (desiredStarts.has(s.starts_at)) continue;
      // Will also clean globally below; skip per-month if start still desired
    }

    let index = 1;
    for (const d of desired) {
      const found = await findSessionByStart(groupId, d.starts_at);
      if (found) {
        skippedExisting += 1;
        index += 1;
        continue;
      }
      await insertSession({
        group_id: groupId,
        study_month_id: month.id,
        starts_at: d.starts_at,
        ends_at: d.ends_at,
        session_index: index,
        source: "auto",
      });
      created += 1;
      index += 1;
    }
  }

  // Remove auto sessions outside the group's date range (no attendance only)
  const allSessions = await listSessionsForGroup(groupId);
  for (const s of allSessions) {
    if (s.source !== "auto") continue;
    if (desiredStarts.has(s.starts_at)) continue;
    const deleted = await deleteSessionIfNoAttendance(s.id);
    if (!deleted) protectedWithAttendance += 1;
  }

  return { created, skippedExisting, protectedWithAttendance };
}
