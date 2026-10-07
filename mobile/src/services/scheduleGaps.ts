import {
  combineDateAndTime,
  datesForWeekdayInRange,
  monthsOverlappingRange,
} from "../utils/date";

export type WeeklyPattern = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type DesiredSlot = {
  starts_at: string;
  ends_at: string;
  /** 1-based position within its calendar month (session_index). */
  index: number;
};

export type MonthSlots = {
  yearMonth: string;
  start: string;
  end: string;
  slots: DesiredSlot[];
};

/** Weekly pattern slots between two dates, grouped by calendar month. */
export function desiredSlotsByMonth(
  patterns: WeeklyPattern[],
  rangeStart: string,
  rangeEnd: string
): MonthSlots[] {
  return monthsOverlappingRange(rangeStart, rangeEnd).map((slice) => {
    const slots: Omit<DesiredSlot, "index">[] = [];
    for (const p of patterns) {
      for (const date of datesForWeekdayInRange(p.weekday, slice.start, slice.end)) {
        slots.push({
          starts_at: combineDateAndTime(date, p.start_time),
          ends_at: combineDateAndTime(date, p.end_time),
        });
      }
    }
    slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return { ...slice, slots: slots.map((s, i) => ({ ...s, index: i + 1 })) };
  });
}

/**
 * Slots with no class on their day. A class kept at an older time (e.g. it has
 * attendance from before the schedule changed) covers that day's slot, so
 * filling never doubles a day. Cancelled classes count as covering too.
 */
export function uncoveredSlots<T extends { starts_at: string }>(
  slots: T[],
  existing: { starts_at: string }[]
): T[] {
  const existingByDay = new Map<string, Set<string>>();
  for (const s of existing) {
    const day = s.starts_at.slice(0, 10);
    if (!existingByDay.has(day)) existingByDay.set(day, new Set());
    existingByDay.get(day)!.add(s.starts_at);
  }

  const slotsByDay = new Map<string, T[]>();
  for (const slot of slots) {
    const day = slot.starts_at.slice(0, 10);
    if (!slotsByDay.has(day)) slotsByDay.set(day, []);
    slotsByDay.get(day)!.push(slot);
  }

  const result: T[] = [];
  for (const [day, daySlots] of slotsByDay) {
    const onDay = existingByDay.get(day) ?? new Set<string>();
    const wanted = new Set(daySlots.map((s) => s.starts_at));
    const notFound = daySlots.filter((s) => !onDay.has(s.starts_at));
    const offPatternCount = [...onDay].filter((st) => !wanted.has(st)).length;
    result.push(...notFound.slice(offPatternCount));
  }
  return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
