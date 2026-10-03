import { getDb } from "../db/client";
import type { GroupSession } from "../db/types";

type MonthSession = Pick<GroupSession, "id" | "starts_at" | "status">;

export type MonthChunk<S extends MonthSession = GroupSession> = {
  roundNumber: number;
  sessions: S[];
};

export type SessionCoverage = Record<number, { marked: number; total: number }>;

/** Group month N = non-cancelled sessions [(N-1)*per, N*per) by start time. */
export function chunkSessionsByRound<S extends MonthSession>(
  sessions: S[],
  classesPerRound: number
): MonthChunk<S>[] {
  const per = Math.max(1, classesPerRound || 4);
  // Exclude cancelled so month headers match payment date ranges / billing.
  const ordered = [...sessions]
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const out: MonthChunk<S>[] = [];
  for (let i = 0; i < ordered.length; i += per) {
    out.push({
      roundNumber: Math.floor(i / per) + 1,
      sessions: ordered.slice(i, i + per),
    });
  }
  return out;
}

/** A month is finished only when every class is completed and fully marked. */
export function isRoundAttendanceComplete(
  chunk: MonthChunk<MonthSession>,
  coverage: SessionCoverage
): boolean {
  if (!chunk.sessions.length) return false;
  return chunk.sessions.every((s) => {
    if (s.status !== "completed") return false;
    const c = coverage[s.id];
    return Boolean(c && c.total > 0 && c.marked >= c.total);
  });
}

/** Months up through the first incomplete one (gates the next month). */
export function visibleRoundChunks<S extends MonthSession>(
  chunks: MonthChunk<S>[],
  coverage: SessionCoverage
): MonthChunk<S>[] {
  const out: MonthChunk<S>[] = [];
  for (const chunk of chunks) {
    out.push(chunk);
    if (!isRoundAttendanceComplete(chunk, coverage)) break;
  }
  return out;
}

type SessionCoverageRow = MonthSession & { group_id: number; marked: number };

async function loadActiveGroupMonthInputs(groupId?: number) {
  const db = await getDb();
  const groupFilter = groupId != null ? "AND g.id = ?" : "";
  const params = groupId != null ? [groupId] : [];

  const groups = await db.getAllAsync<{
    id: number;
    classes_per_round: number;
    roster: number;
  }>(
    `SELECT g.id, g.classes_per_round,
       (SELECT COUNT(*) FROM enrollments e
        JOIN students s ON s.id = e.student_id AND s.status = 'active'
        WHERE e.group_id = g.id AND e.status = 'active') as roster
     FROM groups g
     WHERE g.status = 'active' ${groupFilter}`,
    params
  );

  const sessions = await db.getAllAsync<SessionCoverageRow>(
    `SELECT gs.id, gs.group_id, gs.starts_at, gs.status,
       COUNT(CASE WHEN e.id IS NOT NULL AND s.id IS NOT NULL THEN a.id END) as marked
     FROM group_sessions gs
     JOIN groups g ON g.id = gs.group_id AND g.status = 'active'
     LEFT JOIN attendances a ON a.session_id = gs.id
     LEFT JOIN students s ON s.id = a.student_id AND s.status = 'active'
     LEFT JOIN enrollments e
       ON e.student_id = a.student_id
      AND e.group_id = gs.group_id
      AND e.status = 'active'
     WHERE gs.status != 'cancelled' ${groupFilter}
     GROUP BY gs.id`,
    params
  );

  return { groups, sessions };
}

/**
 * Current month per active group, using the same gate as the group page
 * (last visible month). Groups without sessions default to month 1.
 */
export async function getCurrentMonthByGroup(
  groupId?: number
): Promise<Map<number, number>> {
  const { groups, sessions } = await loadActiveGroupMonthInputs(groupId);

  const sessionsByGroup = new Map<number, SessionCoverageRow[]>();
  for (const s of sessions) {
    const list = sessionsByGroup.get(s.group_id) ?? [];
    list.push(s);
    sessionsByGroup.set(s.group_id, list);
  }

  const result = new Map<number, number>();
  for (const g of groups) {
    const groupSessions = sessionsByGroup.get(g.id) ?? [];
    const total = Number(g.roster ?? 0);
    const coverage: SessionCoverage = {};
    for (const s of groupSessions) {
      coverage[s.id] = { marked: Number(s.marked ?? 0), total };
    }
    const visible = visibleRoundChunks(
      chunkSessionsByRound(groupSessions, g.classes_per_round),
      coverage
    );
    result.set(g.id, visible.at(-1)?.roundNumber ?? 1);
  }
  return result;
}
