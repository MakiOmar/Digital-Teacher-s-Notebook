/** Calendar / weekday helpers (local device timezone). */

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "الأحد",
  1: "الإثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};

/** Sat → Fri sort order for Arabic week listings. */
export const WEEKDAY_SORT: Record<number, number> = {
  6: 0,
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
};

export function primaryWeekday(weekdays: number[]): number {
  if (!weekdays.length) return 99;
  return Math.min(...weekdays.map((d) => WEEKDAY_SORT[d] ?? 99));
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toDateTimeLocal(d: Date): string {
  return `${toDateOnly(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function yearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${ARABIC_MONTHS[m - 1]} ${y}`;
}

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start: toDateOnly(start), end: toDateOnly(end) };
}

/**
 * Calendar months that overlap [startDate, endDate] (inclusive).
 * Each month is clipped to the semester range.
 */
export function monthsOverlappingRange(
  startDate: string,
  endDate: string
): { yearMonth: string; start: string; end: string }[] {
  const rangeStart = parseDateOnly(startDate);
  const rangeEnd = parseDateOnly(endDate);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new Error("تاريخ غير صالح");
  }
  if (rangeEnd < rangeStart) {
    throw new Error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
  }

  const result: { yearMonth: string; start: string; end: string }[] = [];
  let y = rangeStart.getFullYear();
  let m = rangeStart.getMonth(); // 0-based

  for (;;) {
    const yearMonth = `${y}-${pad2(m + 1)}`;
    const bounds = monthBounds(yearMonth);
    const monthStart = parseDateOnly(bounds.start);
    const monthEnd = parseDateOnly(bounds.end);
    const clipStart = monthStart < rangeStart ? rangeStart : monthStart;
    const clipEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
    if (clipStart <= clipEnd) {
      result.push({
        yearMonth,
        start: toDateOnly(clipStart),
        end: toDateOnly(clipEnd),
      });
    }
    if (y === rangeEnd.getFullYear() && m === rangeEnd.getMonth()) break;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return result;
}

export function formatDateAr(dateOnly: string): string {
  const d = parseDateOnly(dateOnly);
  if (Number.isNaN(d.getTime())) return dateOnly;
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Extract YYYY-MM-DD from SQLite datetime / ISO. */
export function dateOnlyFromDateTime(value?: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

/** e.g. "الشهر 3 · 26 يوليو 2026 — مستمرة" */
export function formatRoundTitle(
  roundNumber: number,
  startedAt?: string | null,
  closedAt?: string | null,
  ongoingLabel = "مستمرة",
  unitLabel = "الشهر"
): string {
  const start = dateOnlyFromDateTime(startedAt);
  const end = dateOnlyFromDateTime(closedAt);
  const head = `${unitLabel} ${roundNumber}`;
  if (start && end) {
    return `${head} · ${formatDateAr(start)} — ${formatDateAr(end)}`;
  }
  if (start) {
    return `${head} · ${formatDateAr(start)} — ${ongoingLabel}`;
  }
  return head;
}

export function formatRoundRange(
  startedAt?: string | null,
  closedAt?: string | null,
  ongoingLabel = "مستمرة"
): string {
  const start = dateOnlyFromDateTime(startedAt);
  const end = dateOnlyFromDateTime(closedAt);
  if (start && end) {
    return `${formatDateAr(start)} — ${formatDateAr(end)}`;
  }
  if (start) {
    return `${formatDateAr(start)} — ${ongoingLabel}`;
  }
  return "—";
}

export function formatTimeHm(hm: string): string {
  return hm;
}

export function timeHmToDate(hm: string): Date {
  const [hh, mm] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

export function dateToTimeHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** All dates (YYYY-MM-DD) of `weekday` within inclusive [startDate, endDate]. */
export function datesForWeekdayInRange(
  weekday: number,
  startDate: string,
  endDate: string
): string[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const dates: string[] = [];
  const cursor = new Date(start);
  // advance to first matching weekday
  while (cursor.getDay() !== weekday && cursor <= end) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

export function combineDateAndTime(date: string, timeHm: string): string {
  const [hh, mm] = timeHm.split(":").map(Number);
  const d = parseDateOnly(date);
  d.setHours(hh, mm, 0, 0);
  return toDateTimeLocal(d);
}

export function formatDateTimeAr(isoLocal: string): string {
  const d = new Date(isoLocal);
  if (Number.isNaN(d.getTime())) return isoLocal;
  const day = WEEKDAY_LABELS[d.getDay()];
  return `${day} ${toDateOnly(d)} — ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

/** Add calendar months to a YYYY-MM-DD date (clamped to last day of target month). */
export function addCalendarMonths(dateOnly: string, months: number): string {
  const d = parseDateOnly(dateOnly);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateOnly(d);
}

/**
 * Resolve a schedule end date that never blocks an arbitrary group start.
 * Prefer explicit end; else year end if still after start; else start + 12 months.
 */
export function resolveGroupScheduleEnd(
  startDate: string,
  endDate?: string | null,
  yearEndDate?: string | null
): string {
  if (endDate && endDate >= startDate) return endDate;
  if (yearEndDate && yearEndDate >= startDate) return yearEndDate;
  return addCalendarMonths(startDate, 12);
}

export function formatMoney(amount: number): string {
  return `${amount.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;
}
