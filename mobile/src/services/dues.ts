import { getDb } from "../db/client";
import type { PaymentStatus, StudentDueRow } from "../db/types";

function statusFor(due: number, paid: number): PaymentStatus {
  if (due <= 0) return paid > 0 ? "paid" : "paid";
  if (paid <= 0) return "unpaid";
  if (paid + 0.001 >= due) return "paid";
  return "partial";
}

/** Per-student dues for a study month (active students with active enrollment). */
export async function getStudentDuesForMonth(
  studyMonthId: number
): Promise<StudentDueRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    guardian_phone: string | null;
    group_id: number;
    group_name: string;
    default_monthly_fee: number;
    custom_monthly_fee: number | null;
    paid: number | null;
  }>(
    `SELECT
       s.id as student_id,
       s.name as student_name,
       s.student_phone,
       s.guardian_phone,
       g.id as group_id,
       g.name as group_name,
       g.default_monthly_fee,
       e.custom_monthly_fee,
       (
         SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         WHERE p.student_id = s.id AND p.study_month_id = ?
       ) as paid
     FROM students s
     JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
     JOIN groups g ON g.id = e.group_id AND g.status = 'active'
     WHERE s.status = 'active'
     ORDER BY s.name COLLATE NOCASE`,
    [studyMonthId]
  );

  return rows.map((r) => {
    const due =
      r.custom_monthly_fee != null && r.custom_monthly_fee >= 0
        ? r.custom_monthly_fee
        : r.default_monthly_fee;
    const paid = Number(r.paid ?? 0);
    const remaining = Math.max(0, due - paid);
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      student_phone: r.student_phone,
      guardian_phone: r.guardian_phone,
      group_id: r.group_id,
      group_name: r.group_name,
      due,
      paid,
      remaining,
      status: statusFor(due, paid),
    };
  });
}

export async function getMonthPaymentSummary(studyMonthId: number): Promise<{
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  dues: StudentDueRow[];
}> {
  const dues = await getStudentDuesForMonth(studyMonthId);
  const totalCollected = dues.reduce((s, d) => s + d.paid, 0);
  const totalDue = dues.reduce((s, d) => s + d.due, 0);
  const totalRemaining = dues.reduce((s, d) => s + d.remaining, 0);
  return {
    totalCollected,
    totalDue,
    totalRemaining,
    unpaidCount: dues.filter((d) => d.status === "unpaid").length,
    partialCount: dues.filter((d) => d.status === "partial").length,
    paidCount: dues.filter((d) => d.status === "paid").length,
    dues,
  };
}
