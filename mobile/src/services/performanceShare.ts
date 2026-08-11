import { Linking } from "react-native";
import { t } from "@/src/i18n/ar";
import { getDb } from "@/src/db/client";
import type { AttendanceStatus, Student } from "@/src/db/types";
import { formatDateTimeAr, formatMoney, formatInteger } from "@/src/utils/date";
import { attendanceStatusLabel } from "@/src/utils/statusLabels";
import { whatsappUrl } from "@/src/utils/phone";

/** Prefer guardian phone for parent messages; fall back to student phone. */
export function preferredSharePhone(student: {
  student_phone?: string | null;
  guardian_phone?: string | null;
}): string | null {
  const guardian = student.guardian_phone?.trim();
  if (guardian) return guardian;
  const own = student.student_phone?.trim();
  return own || null;
}

export async function openWhatsAppMessage(
  phone: string,
  text: string
): Promise<void> {
  await Linking.openURL(whatsappUrl(phone, text));
}

/** Build a WhatsApp-friendly lesson performance message for one student. */
export function buildLessonPerformanceMessage(input: {
  studentName: string;
  groupName: string;
  startsAt: string;
  attendance: AttendanceStatus | null;
  homeworkDone: boolean | null;
  isStar: boolean;
  sessionNotes?: string | null;
}): string {
  const lines = [
    t("shareLessonTitle"),
    "",
    `👤 ${input.studentName}`,
    `📚 ${input.groupName}`,
    `🗓 ${formatDateTimeAr(input.startsAt)}`,
    `✅ ${t("filterByStatus")}: ${
      input.attendance
        ? attendanceStatusLabel(input.attendance)
        : t("shareNotMarked")
    }`,
    `📝 ${t("homework")}: ${
      input.homeworkDone == null
        ? t("shareNotMarked")
        : input.homeworkDone
          ? t("homeworkDone")
          : t("homeworkNotDone")
    }`,
  ];
  if (input.isStar) {
    lines.push(`⭐ ${t("starOfClass")}`);
  }
  const notes = input.sessionNotes?.trim();
  if (notes) {
    lines.push("", `📌 ${t("sessionNotes")}: ${notes}`);
  }
  return lines.join("\n");
}

type MonthlyAgg = {
  groupName: string;
  roundNumber: number;
  present: number;
  excused: number;
  unexcused: number;
  homeworkDone: number;
  homeworkTotal: number;
  counted: number;
  target: number;
  due: number;
  paid: number;
  remaining: number;
  isRoundStar: boolean;
};

/** Aggregate open (or latest) round performance for WhatsApp monthly share. */
export async function getStudentMonthlyPerformance(
  studentId: number,
  groupId?: number
): Promise<MonthlyAgg | null> {
  const db = await getDb();
  const round = await db.getFirstAsync<{
    id: number;
    group_id: number;
    round_number: number;
    counted_classes: number;
    target_classes: number;
    started_at: string;
    closed_at: string | null;
    group_name: string;
    due: number;
  }>(
    `SELECT br.id, br.group_id, br.round_number, br.counted_classes, br.target_classes,
            br.started_at, br.closed_at, g.name as group_name,
            CASE
              WHEN e.custom_monthly_fee IS NOT NULL AND e.custom_monthly_fee >= 0
                THEN e.custom_monthly_fee
              ELSE g.default_monthly_fee
            END as due
     FROM billing_rounds br
     JOIN groups g ON g.id = br.group_id
     JOIN enrollments e
       ON e.student_id = br.student_id AND e.group_id = br.group_id AND e.status = 'active'
     WHERE br.student_id = ?
       AND (? IS NULL OR br.group_id = ?)
     ORDER BY CASE WHEN br.status = 'open' THEN 0 ELSE 1 END, br.round_number DESC
     LIMIT 1`,
    [studentId, groupId ?? null, groupId ?? null]
  );
  if (!round) return null;

  const paidRow = await db.getFirstAsync<{ paid: number }>(
    `SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE billing_round_id = ?`,
    [round.id]
  );
  const paid = Number(paidRow?.paid ?? 0);
  const due = Number(round.due);

  // Approximate round window: sessions for this group ordered by starts_at,
  // slice by round (classes_per_round * (n-1) ..).
  const group = await db.getFirstAsync<{ classes_per_round: number }>(
    `SELECT classes_per_round FROM groups WHERE id = ?`,
    [round.group_id]
  );
  const per = Math.max(1, Number(group?.classes_per_round ?? 4));
  const startIndex = (round.round_number - 1) * per;
  const sessions = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM group_sessions
     WHERE group_id = ? AND status != 'cancelled'
     ORDER BY starts_at ASC
     LIMIT ? OFFSET ?`,
    [round.group_id, per, startIndex]
  );
  const sessionIds = sessions.map((s) => s.id);
  let present = 0;
  let excused = 0;
  let unexcused = 0;
  let homeworkDone = 0;
  let homeworkTotal = 0;
  if (sessionIds.length) {
    const placeholders = sessionIds.map(() => "?").join(",");
    const rows = await db.getAllAsync<{
      status: AttendanceStatus;
      homework_done: number;
    }>(
      `SELECT status, COALESCE(homework_done, 0) as homework_done
       FROM attendances
       WHERE student_id = ? AND session_id IN (${placeholders})`,
      [studentId, ...sessionIds]
    );
    for (const r of rows) {
      if (r.status === "present") present += 1;
      else if (r.status === "absent_excused") excused += 1;
      else if (r.status === "absent_unexcused") unexcused += 1;
      homeworkTotal += 1;
      if (r.homework_done) homeworkDone += 1;
    }
  }

  const star = await db.getFirstAsync<{ student_id: number }>(
    `SELECT student_id FROM round_stars
     WHERE group_id = ? AND round_number = ?`,
    [round.group_id, round.round_number]
  );

  return {
    groupName: round.group_name,
    roundNumber: round.round_number,
    present,
    excused,
    unexcused,
    homeworkDone,
    homeworkTotal,
    counted: Number(round.counted_classes),
    target: Number(round.target_classes),
    due,
    paid,
    remaining: Math.max(0, due - paid),
    isRoundStar: star?.student_id === studentId,
  };
}

export function buildMonthlyPerformanceMessage(input: {
  studentName: string;
  agg: MonthlyAgg;
}): string {
  const { agg } = input;
  const lines = [
    t("shareMonthlyTitle"),
    "",
    `👤 ${input.studentName}`,
    `📚 ${agg.groupName}`,
    `🔖 ${t("roundNumberLabel", { n: formatInteger(agg.roundNumber) })}`,
    "",
    `✅ ${t("present")}: ${formatInteger(agg.present)}`,
    `🟡 ${t("absentExcused")}: ${formatInteger(agg.excused)}`,
    `🔴 ${t("absentUnexcused")}: ${formatInteger(agg.unexcused)}`,
    `📝 ${t("homework")}: ${formatInteger(agg.homeworkDone)}/${formatInteger(
      Math.max(agg.homeworkTotal, 0)
    )}`,
    `📊 ${t("shareClassesProgress", {
      counted: formatInteger(agg.counted),
      target: formatInteger(agg.target),
    })}`,
    "",
    `💰 ${t("sharePaymentDue")}: ${formatMoney(agg.due)}`,
    `💵 ${t("sharePaymentPaid")}: ${formatMoney(agg.paid)}`,
    `📉 ${t("sharePaymentRemaining")}: ${formatMoney(agg.remaining)}`,
  ];
  if (agg.isRoundStar) {
    lines.push("", `⭐ ${t("shareRoundStar")}`);
  }
  return lines.join("\n");
}

export async function shareLessonPerformanceWhatsApp(input: {
  student: Pick<Student, "name" | "student_phone" | "guardian_phone">;
  groupName: string;
  startsAt: string;
  attendance: AttendanceStatus | null;
  homeworkDone: boolean | null;
  isStar: boolean;
  sessionNotes?: string | null;
}): Promise<{ ok: boolean; reason?: "no_phone" }> {
  const phone = preferredSharePhone(input.student);
  if (!phone) return { ok: false, reason: "no_phone" };
  const text = buildLessonPerformanceMessage({
    studentName: input.student.name,
    groupName: input.groupName,
    startsAt: input.startsAt,
    attendance: input.attendance,
    homeworkDone: input.homeworkDone,
    isStar: input.isStar,
    sessionNotes: input.sessionNotes,
  });
  await openWhatsAppMessage(phone, text);
  return { ok: true };
}

export async function shareMonthlyPerformanceWhatsApp(
  student: Student,
  groupId?: number
): Promise<{ ok: boolean; reason?: "no_phone" | "no_data" }> {
  const phone = preferredSharePhone(student);
  if (!phone) return { ok: false, reason: "no_phone" };
  const agg = await getStudentMonthlyPerformance(student.id, groupId);
  if (!agg) return { ok: false, reason: "no_data" };
  const text = buildMonthlyPerformanceMessage({
    studentName: student.name,
    agg,
  });
  await openWhatsAppMessage(phone, text);
  return { ok: true };
}
