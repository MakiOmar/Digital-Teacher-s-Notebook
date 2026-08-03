export type EntityStatus = "active" | "paused" | "withdrawn" | "closed" | "open" | "ended";

export type AttendanceStatus = "present" | "absent_excused" | "absent_unexcused";

export type SessionStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export type PaymentMethod = "cash" | "transfer" | "other";

export type PaymentStatus = "paid" | "partial" | "unpaid";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // JS getDay(): 0=Sun ... 6=Sat

export interface AcademicYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  status: string;
  created_at: string;
}

export interface Semester {
  id: number;
  academic_year_id: number;
  name: string;
  sort_order: number;
  start_date: string;
  end_date: string;
  status: string;
}

export interface StudyMonth {
  id: number;
  semester_id: number;
  academic_year_id: number;
  year_month: string; // YYYY-MM
  display_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface StudyGroup {
  id: number;
  name: string;
  subject: string | null;
  default_monthly_fee: number;
  classes_per_round: number;
  /** Group schedule start (YYYY-MM-DD) — not limited to semester bounds. */
  start_date: string | null;
  /** Optional schedule end; null = open-ended through active year end. */
  end_date: string | null;
  accent_color: string | null;
  status: string;
  created_at: string;
}

export interface SchedulePattern {
  id: number;
  group_id: number;
  weekday: Weekday;
  start_time: string; // HH:mm
  end_time: string;
}

export interface Student {
  id: number;
  name: string;
  guardian_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface Enrollment {
  id: number;
  student_id: number;
  group_id: number;
  start_date: string;
  end_date: string | null;
  custom_monthly_fee: number | null;
  status: string;
}

export interface GroupSession {
  id: number;
  group_id: number;
  study_month_id: number;
  starts_at: string;
  ends_at: string;
  session_index: number;
  status: SessionStatus;
  source: "auto" | "manual";
  star_student_id: number | null;
  notes: string | null;
}

export interface Attendance {
  id: number;
  session_id: number;
  student_id: number;
  status: AttendanceStatus;
  notes: string | null;
}

export interface BillingRound {
  id: number;
  group_id: number;
  student_id: number;
  round_number: number;
  target_classes: number;
  counted_classes: number;
  status: "open" | "closed" | string;
  started_at: string;
  closed_at: string | null;
}

export interface RoundStar {
  group_id: number;
  round_number: number;
  student_id: number;
}

export interface Payment {
  id: number;
  student_id: number;
  study_month_id: number | null;
  billing_round_id: number | null;
  group_id: number | null;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  note: string | null;
  created_at: string;
}

export interface StudentDueRow {
  student_id: number;
  student_name: string;
  guardian_phone: string | null;
  group_id: number;
  group_name: string;
  due: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
  round_id?: number;
  round_number?: number;
  counted_classes?: number;
  target_classes?: number;
  remaining_classes?: number;
  started_at?: string | null;
  closed_at?: string | null;
}

export interface GroupListRow extends StudyGroup {
  student_count: number;
  total_fees: number;
  scheduleLabel: string;
}
