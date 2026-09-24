import type { GroupSession } from "../db/types";
import { getDb } from "../db/client";
import { formatDateTimeAr } from "../utils/date";
import { t } from "../i18n/ar";

export type OverlappingSession = GroupSession & { group_name: string };

/**
 * True when [aStart, aEnd) overlaps [bStart, bEnd).
 * Touching endpoints (end == other start) do not count as a conflict.
 */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Find any non-cancelled session that overlaps [startsAt, endsAt)
 * across all groups (single-tutor calendar).
 */
export async function findOverlappingSession(input: {
  startsAt: string;
  endsAt: string;
  excludeSessionId?: number | null;
}): Promise<OverlappingSession | null> {
  const db = await getDb();
  const excludeId = input.excludeSessionId ?? null;
  return (
    (await db.getFirstAsync<OverlappingSession>(
      `SELECT gs.*, g.name AS group_name
       FROM group_sessions gs
       INNER JOIN groups g ON g.id = gs.group_id
       WHERE g.status = 'active'
         AND gs.status != 'cancelled'
         AND gs.starts_at < ?
         AND gs.ends_at > ?
         AND (? IS NULL OR gs.id != ?)
       ORDER BY gs.starts_at ASC
       LIMIT 1`,
      [input.endsAt, input.startsAt, excludeId, excludeId]
    )) ?? null
  );
}

export function conflictMessage(hit: OverlappingSession): string {
  return t("sessionScheduleConflict", {
    group: hit.group_name,
    when: formatDateTimeAr(hit.starts_at),
  });
}
