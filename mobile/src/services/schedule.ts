import {
  listPatterns,
  listStudyMonths,
  listSessionsForGroup,
  insertSession,
  deleteSessionIfNoAttendance,
  findSessionByStart,
  getActiveYear,
} from "../repositories";
import {
  combineDateAndTime,
  datesForWeekdayInRange,
} from "../utils/date";

export type GenerateResult = {
  created: number;
  skippedExisting: number;
  protectedWithAttendance: number;
};

/**
 * Generate sessions for a group across study months of the active year
 * (or provided month ids). Does not delete sessions that already have attendance.
 */
export async function generateSessionsForGroup(
  groupId: number,
  studyMonthIds?: number[]
): Promise<GenerateResult> {
  const patterns = await listPatterns(groupId);
  if (!patterns.length) {
    throw new Error("لا يوجد موعد أسبوعي لهذه المجموعة");
  }

  let monthIds = studyMonthIds;
  if (!monthIds?.length) {
    const year = await getActiveYear();
    if (!year) throw new Error("لا توجد سنة دراسية نشطة");
    const months = await listStudyMonths(year.id);
    monthIds = months.map((m) => m.id);
  }

  const year = await getActiveYear();
  const allMonths = year ? await listStudyMonths(year.id) : [];
  const monthMap = new Map(allMonths.map((m) => [m.id, m]));

  let created = 0;
  let skippedExisting = 0;
  let protectedWithAttendance = 0;

  for (const monthId of monthIds) {
    const month = monthMap.get(monthId);
    if (!month) continue;

    // Desired starts for this month
    const desired: { starts_at: string; ends_at: string }[] = [];
    for (const p of patterns) {
      const dates = datesForWeekdayInRange(
        p.weekday,
        month.start_date,
        month.end_date
      );
      for (const date of dates) {
        desired.push({
          starts_at: combineDateAndTime(date, p.start_time),
          ends_at: combineDateAndTime(date, p.end_time),
        });
      }
    }
    desired.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    const existing = await listSessionsForGroup(groupId, monthId);
    const desiredStarts = new Set(desired.map((d) => d.starts_at));

    // Remove auto sessions that are no longer desired and have no attendance
    for (const s of existing) {
      if (s.source !== "auto") continue;
      if (desiredStarts.has(s.starts_at)) continue;
      const deleted = await deleteSessionIfNoAttendance(s.id);
      if (!deleted) protectedWithAttendance += 1;
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
        study_month_id: monthId,
        starts_at: d.starts_at,
        ends_at: d.ends_at,
        session_index: index,
        source: "auto",
      });
      created += 1;
      index += 1;
    }
  }

  return { created, skippedExisting, protectedWithAttendance };
}
