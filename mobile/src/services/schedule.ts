import {
  listPatterns,
  listSessionsForGroup,
  listGroups,
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
import { softRescheduleReminders } from "../reminders/reminders";
import { findOverlappingSession } from "./schedulingConflicts";

export type GenerateResult = {
  created: number;
  skippedExisting: number;
  skippedConflicts: number;
  protectedWithAttendance: number;
};

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
  let skippedConflicts = 0;
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

    let index = 1;
    for (const d of desired) {
      const found = await findSessionByStart(groupId, d.starts_at);
      if (found) {
        skippedExisting += 1;
        index += 1;
        continue;
      }

      // Skip slots that overlap any other tutor session (other groups / prior creates).
      const conflict = await findOverlappingSession({
        startsAt: d.starts_at,
        endsAt: d.ends_at,
      });
      if (conflict) {
        skippedConflicts += 1;
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

  return {
    created,
    skippedExisting,
    skippedConflicts,
    protectedWithAttendance,
  };
}

/**
 * Insert missing weekly sessions from the group's start date through its end.
 * Does not delete existing rows (import repair). Attendance and manual classes stay.
 */
export async function fillMissingSessionsForGroup(
  groupId: number
): Promise<number> {
  const patterns = await listPatterns(groupId);
  if (!patterns.length) return 0;

  const group = await getGroup(groupId);
  if (!group?.start_date) return 0;

  const year = await getActiveYear();
  if (!year) return 0;

  const rangeStart = group.start_date;
  const rangeEnd = resolveGroupScheduleEnd(
    rangeStart,
    group.end_date,
    year.end_date
  );
  const monthSlices = monthsOverlappingRange(rangeStart, rangeEnd);
  let created = 0;

  for (const slice of monthSlices) {
    const month = await ensureStudyMonthForYearMonth(
      year.id,
      slice.yearMonth,
      slice.start,
      slice.end
    );
    const desired: { starts_at: string; ends_at: string }[] = [];
    for (const p of patterns) {
      const dates = datesForWeekdayInRange(p.weekday, slice.start, slice.end);
      for (const date of dates) {
        desired.push({
          starts_at: combineDateAndTime(date, p.start_time),
          ends_at: combineDateAndTime(date, p.end_time),
        });
      }
    }
    desired.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    let index = 1;
    for (const d of desired) {
      const found = await findSessionByStart(groupId, d.starts_at);
      if (found) {
        index += 1;
        continue;
      }

      const conflict = await findOverlappingSession({
        startsAt: d.starts_at,
        endsAt: d.ends_at,
      });
      if (conflict) {
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

  return created;
}

/** Fill gaps for active groups whose first class is after the saved start date. */
export async function repairIncompleteGroupSchedules(): Promise<number> {
  const groups = await listGroups();
  let created = 0;
  for (const group of groups) {
    if (!group.start_date) continue;
    const sessions = await listSessionsForGroup(group.id);
    const active = sessions.filter((s) => s.status !== "cancelled");
    const firstMonth = active[0]?.starts_at?.slice(0, 7) ?? "";
    const startMonth = group.start_date.slice(0, 7);
    // Already has classes in the start month (or earlier). Don't rescan every launch.
    if (firstMonth && firstMonth <= startMonth) continue;
    created += await fillMissingSessionsForGroup(group.id);
  }
  if (created > 0) softRescheduleReminders();
  return created;
}

/** Public entry: generate then refresh class reminder alarms. */
export async function generateSessionsForGroup(
  groupId: number
): Promise<GenerateResult> {
  // Generate sessions for a group from its own start/end dates.
  // Start may be any calendar date (before/after semester or year bounds).
  // Cross-group time overlaps are skipped (generation continues).
  const result = await withTransaction(() =>
    generateSessionsForGroupInTransaction(groupId)
  );
  softRescheduleReminders();
  return result;
}
