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
import { resolveGroupScheduleEnd, todayDateOnly } from "../utils/date";
import { withTransaction } from "../db/client";
import { softRescheduleReminders } from "../reminders/reminders";
import { findOverlappingSession } from "./schedulingConflicts";
import {
  desiredSlotsByMonth,
  uncoveredSlots,
  type DesiredSlot,
  type MonthSlots,
} from "./scheduleGaps";

export type GenerateResult = {
  created: number;
  skippedExisting: number;
  skippedConflicts: number;
  protectedWithAttendance: number;
  /** Names of the groups whose classes blocked skipped slots. */
  conflictGroups: string[];
};

export type FillResult = {
  created: number;
  skippedConflicts: number;
  conflictGroups: string[];
};

export type ScheduleGaps = {
  /** Weekly slots with no class on that day. */
  missing: number;
  /** Missing slots that overlap another active group's class. */
  blocked: number;
  conflictGroups: string[];
};

/** Group's weekly slots across its date range, or null if it can't be scheduled. */
async function loadGroupSlots(
  groupId: number,
  options: { requireStartDate: boolean }
): Promise<{ yearId: number; months: MonthSlots[] } | null> {
  const patterns = await listPatterns(groupId);
  if (!patterns.length) return null;
  const group = await getGroup(groupId);
  if (!group) return null;
  if (options.requireStartDate && !group.start_date) return null;
  const year = await getActiveYear();
  if (!year) return null;

  const rangeStart = group.start_date || todayDateOnly();
  const rangeEnd = resolveGroupScheduleEnd(
    rangeStart,
    group.end_date,
    year.end_date
  );
  return {
    yearId: year.id,
    months: desiredSlotsByMonth(patterns, rangeStart, rangeEnd),
  };
}

/** Insert one slot unless another active group's class overlaps it. */
async function insertSlotUnlessConflict(
  groupId: number,
  studyMonthId: number,
  slot: DesiredSlot
): Promise<string | null> {
  const conflict = await findOverlappingSession({
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  });
  if (conflict) return conflict.group_name;
  await insertSession({
    group_id: groupId,
    study_month_id: studyMonthId,
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    session_index: slot.index,
    source: "auto",
  });
  return null;
}

async function generateSessionsForGroupInTransaction(
  groupId: number
): Promise<GenerateResult> {
  if (!(await listPatterns(groupId)).length) {
    throw new Error("لا يوجد موعد أسبوعي لهذه المجموعة");
  }
  if (!(await getGroup(groupId))) throw new Error("المجموعة غير موجودة");
  const loaded = await loadGroupSlots(groupId, { requireStartDate: false });
  if (!loaded) throw new Error("لا توجد سنة دراسية نشطة");

  const result: GenerateResult = {
    created: 0,
    skippedExisting: 0,
    skippedConflicts: 0,
    protectedWithAttendance: 0,
    conflictGroups: [],
  };
  const conflictNames = new Set<string>();
  const desiredStarts = new Set<string>();

  for (const month of loaded.months) {
    const studyMonth = await ensureStudyMonthForYearMonth(
      loaded.yearId,
      month.yearMonth,
      month.start,
      month.end
    );
    for (const slot of month.slots) {
      desiredStarts.add(slot.starts_at);
      if (await findSessionByStart(groupId, slot.starts_at)) {
        result.skippedExisting += 1;
        continue;
      }
      const blockedBy = await insertSlotUnlessConflict(
        groupId,
        studyMonth.id,
        slot
      );
      if (blockedBy) {
        result.skippedConflicts += 1;
        conflictNames.add(blockedBy);
      } else {
        result.created += 1;
      }
    }
  }

  // Remove auto sessions outside the group's date range (no attendance only)
  for (const s of await listSessionsForGroup(groupId)) {
    if (s.source !== "auto") continue;
    if (desiredStarts.has(s.starts_at)) continue;
    const deleted = await deleteSessionIfNoAttendance(s.id);
    if (!deleted) result.protectedWithAttendance += 1;
  }

  result.conflictGroups = [...conflictNames];
  return result;
}

/**
 * Insert missing weekly sessions from the group's start date through its end.
 * Never deletes; days that already have a class (any time/status) are left alone.
 */
export async function fillMissingSessionsForGroup(
  groupId: number
): Promise<FillResult> {
  const result: FillResult = {
    created: 0,
    skippedConflicts: 0,
    conflictGroups: [],
  };
  const loaded = await loadGroupSlots(groupId, { requireStartDate: true });
  if (!loaded) return result;

  const existing = await listSessionsForGroup(groupId);
  const conflictNames = new Set<string>();
  for (const month of loaded.months) {
    const missing = uncoveredSlots(month.slots, existing);
    if (!missing.length) continue;
    const studyMonth = await ensureStudyMonthForYearMonth(
      loaded.yearId,
      month.yearMonth,
      month.start,
      month.end
    );
    for (const slot of missing) {
      const blockedBy = await insertSlotUnlessConflict(
        groupId,
        studyMonth.id,
        slot
      );
      if (blockedBy) {
        result.skippedConflicts += 1;
        conflictNames.add(blockedBy);
      } else {
        result.created += 1;
      }
    }
  }
  result.conflictGroups = [...conflictNames];
  return result;
}

/** Count weekly slots that have no class, and which of them clash. Read-only. */
export async function findScheduleGaps(groupId: number): Promise<ScheduleGaps> {
  const gaps: ScheduleGaps = { missing: 0, blocked: 0, conflictGroups: [] };
  const loaded = await loadGroupSlots(groupId, { requireStartDate: true });
  if (!loaded) return gaps;

  const existing = await listSessionsForGroup(groupId);
  const conflictNames = new Set<string>();
  for (const month of loaded.months) {
    for (const slot of uncoveredSlots(month.slots, existing)) {
      gaps.missing += 1;
      const conflict = await findOverlappingSession({
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
      });
      if (conflict) {
        gaps.blocked += 1;
        conflictNames.add(conflict.group_name);
      }
    }
  }
  gaps.conflictGroups = [...conflictNames];
  return gaps;
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
    created += (await fillMissingSessionsForGroup(group.id)).created;
  }
  if (created > 0) softRescheduleReminders();
  return created;
}

/** Public entry: fill missing slots in a transaction, then refresh alarms. */
export async function fillScheduleGaps(groupId: number): Promise<FillResult> {
  const result = await withTransaction(() =>
    fillMissingSessionsForGroup(groupId)
  );
  if (result.created > 0) softRescheduleReminders();
  return result;
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
