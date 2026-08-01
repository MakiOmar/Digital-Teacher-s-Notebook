const fs = require("fs");

const pad = (n) => String(n).padStart(2, "0");
const dt = (y, m, d, h, mi) =>
  `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}:00`;

const students = [
  { id: 1, name: "أحمد محمد علي", guardian_phone: "01011112222", notes: null, status: "active", created_at: "2025-10-01 10:00:00" },
  { id: 2, name: "سارة حسن إبراهيم", guardian_phone: "01022223333", notes: null, status: "active", created_at: "2025-10-01 10:00:00" },
  { id: 3, name: "يوسف خالد محمود", guardian_phone: "01033334444", notes: "يحتاج متابعة", status: "active", created_at: "2025-10-02 10:00:00" },
  { id: 4, name: "مريم عمر فؤاد", guardian_phone: "01044445555", notes: null, status: "active", created_at: "2025-10-02 10:00:00" },
  { id: 5, name: "كريم وليد سمير", guardian_phone: "01055556666", notes: null, status: "active", created_at: "2025-10-03 10:00:00" },
  { id: 6, name: "نورهان طارق", guardian_phone: "01066667777", notes: null, status: "active", created_at: "2025-10-03 10:00:00" },
  { id: 7, name: "عبدالله حسين", guardian_phone: "01077778888", notes: null, status: "active", created_at: "2025-10-04 10:00:00" },
  { id: 8, name: "لينا مصطفى", guardian_phone: "01088889999", notes: null, status: "active", created_at: "2025-10-04 10:00:00" },
  { id: 9, name: "حسام رضا", guardian_phone: "01111112222", notes: null, status: "active", created_at: "2025-10-05 10:00:00" },
  { id: 10, name: "دينا أشرف", guardian_phone: "01122223333", notes: null, status: "active", created_at: "2025-10-05 10:00:00" },
  { id: 11, name: "زياد أمير", guardian_phone: "01133334444", notes: null, status: "paused", created_at: "2025-10-06 10:00:00" },
  { id: 12, name: "هنا وائل", guardian_phone: "01144445555", notes: null, status: "active", created_at: "2025-10-06 10:00:00" },
];

const groups = [
  { id: 1, name: "أولى إعدادي — رياضيات", subject: "رياضيات", default_monthly_fee: 400, classes_per_round: 4, accent_color: "#3B82F6", status: "active", created_at: "2025-09-20 09:00:00" },
  { id: 2, name: "ثانية ثانوي — فيزياء", subject: "فيزياء", default_monthly_fee: 500, classes_per_round: 4, accent_color: "#14B8A6", status: "active", created_at: "2025-09-20 09:00:00" },
  { id: 3, name: "ثالثة ثانوي — كيمياء", subject: "كيمياء", default_monthly_fee: 600, classes_per_round: 4, accent_color: "#F59E0B", status: "active", created_at: "2025-09-20 09:00:00" },
];

const patterns = [
  { id: 1, group_id: 1, weekday: 6, start_time: "16:00", end_time: "18:00" },
  { id: 2, group_id: 1, weekday: 2, start_time: "16:00", end_time: "18:00" },
  { id: 3, group_id: 2, weekday: 0, start_time: "17:00", end_time: "19:00" },
  { id: 4, group_id: 2, weekday: 3, start_time: "17:00", end_time: "19:00" },
  { id: 5, group_id: 3, weekday: 1, start_time: "15:00", end_time: "17:00" },
  { id: 6, group_id: 3, weekday: 4, start_time: "15:00", end_time: "17:00" },
];

const enrollments = [
  { id: 1, student_id: 1, group_id: 1, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 2, student_id: 2, group_id: 1, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 3, student_id: 3, group_id: 1, start_date: "2025-10-01", end_date: null, custom_monthly_fee: 350, status: "active" },
  { id: 4, student_id: 4, group_id: 1, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 5, student_id: 5, group_id: 2, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 6, student_id: 6, group_id: 2, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 7, student_id: 7, group_id: 2, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 8, student_id: 8, group_id: 2, start_date: "2025-10-01", end_date: null, custom_monthly_fee: 450, status: "active" },
  { id: 9, student_id: 9, group_id: 3, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 10, student_id: 10, group_id: 3, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 11, student_id: 12, group_id: 3, start_date: "2025-10-01", end_date: null, custom_monthly_fee: null, status: "active" },
  { id: 12, student_id: 11, group_id: 3, start_date: "2025-10-01", end_date: "2026-01-15", custom_monthly_fee: null, status: "paused" },
];

const study_months = [
  { id: 1, semester_id: 1, academic_year_id: 1, year_month: "2025-10", display_name: "أكتوبر 2025", start_date: "2025-10-01", end_date: "2025-10-31", status: "closed" },
  { id: 2, semester_id: 1, academic_year_id: 1, year_month: "2025-11", display_name: "نوفمبر 2025", start_date: "2025-11-01", end_date: "2025-11-30", status: "closed" },
  { id: 3, semester_id: 1, academic_year_id: 1, year_month: "2025-12", display_name: "ديسمبر 2025", start_date: "2025-12-01", end_date: "2025-12-31", status: "closed" },
  { id: 4, semester_id: 2, academic_year_id: 1, year_month: "2026-02", display_name: "فبراير 2026", start_date: "2026-02-01", end_date: "2026-02-28", status: "closed" },
  { id: 5, semester_id: 2, academic_year_id: 1, year_month: "2026-03", display_name: "مارس 2026", start_date: "2026-03-01", end_date: "2026-03-31", status: "closed" },
  { id: 6, semester_id: 2, academic_year_id: 1, year_month: "2026-07", display_name: "يوليو 2026", start_date: "2026-07-01", end_date: "2026-07-31", status: "open" },
  { id: 7, semester_id: 2, academic_year_id: 1, year_month: "2026-08", display_name: "أغسطس 2026", start_date: "2026-08-01", end_date: "2026-08-31", status: "open" },
];

const sessions = [
  { id: 1, group_id: 1, study_month_id: 6, starts_at: dt(2026, 7, 26, 16, 0), ends_at: dt(2026, 7, 26, 18, 0), session_index: 1, status: "completed", source: "auto", star_student_id: 1 },
  { id: 2, group_id: 1, study_month_id: 6, starts_at: dt(2026, 7, 29, 16, 0), ends_at: dt(2026, 7, 29, 18, 0), session_index: 2, status: "completed", source: "auto", star_student_id: 2 },
  { id: 3, group_id: 2, study_month_id: 6, starts_at: dt(2026, 7, 27, 17, 0), ends_at: dt(2026, 7, 27, 19, 0), session_index: 1, status: "completed", source: "auto", star_student_id: 5 },
  { id: 4, group_id: 2, study_month_id: 6, starts_at: dt(2026, 7, 30, 17, 0), ends_at: dt(2026, 7, 30, 19, 0), session_index: 2, status: "completed", source: "auto", star_student_id: null },
  { id: 5, group_id: 3, study_month_id: 6, starts_at: dt(2026, 7, 28, 15, 0), ends_at: dt(2026, 7, 28, 17, 0), session_index: 1, status: "completed", source: "auto", star_student_id: 9 },
  { id: 6, group_id: 3, study_month_id: 6, starts_at: dt(2026, 7, 31, 15, 0), ends_at: dt(2026, 7, 31, 17, 0), session_index: 2, status: "completed", source: "auto", star_student_id: 10 },
  { id: 7, group_id: 1, study_month_id: 7, starts_at: dt(2026, 8, 1, 16, 0), ends_at: dt(2026, 8, 1, 18, 0), session_index: 1, status: "scheduled", source: "auto", star_student_id: null },
  { id: 8, group_id: 2, study_month_id: 7, starts_at: dt(2026, 8, 2, 17, 0), ends_at: dt(2026, 8, 2, 19, 0), session_index: 1, status: "scheduled", source: "auto", star_student_id: null },
  { id: 9, group_id: 3, study_month_id: 7, starts_at: dt(2026, 8, 3, 15, 0), ends_at: dt(2026, 8, 3, 17, 0), session_index: 1, status: "scheduled", source: "auto", star_student_id: null },
  { id: 10, group_id: 1, study_month_id: 7, starts_at: dt(2026, 8, 4, 16, 0), ends_at: dt(2026, 8, 4, 18, 0), session_index: 2, status: "scheduled", source: "auto", star_student_id: null },
  { id: 11, group_id: 2, study_month_id: 7, starts_at: dt(2026, 8, 5, 17, 0), ends_at: dt(2026, 8, 5, 19, 0), session_index: 2, status: "scheduled", source: "auto", star_student_id: null },
  { id: 12, group_id: 3, study_month_id: 7, starts_at: dt(2026, 8, 6, 15, 0), ends_at: dt(2026, 8, 6, 17, 0), session_index: 2, status: "scheduled", source: "auto", star_student_id: null },
  { id: 13, group_id: 1, study_month_id: 7, starts_at: dt(2026, 8, 8, 16, 0), ends_at: dt(2026, 8, 8, 18, 0), session_index: 3, status: "scheduled", source: "auto", star_student_id: null },
  { id: 14, group_id: 2, study_month_id: 7, starts_at: dt(2026, 8, 9, 17, 0), ends_at: dt(2026, 8, 9, 19, 0), session_index: 3, status: "scheduled", source: "auto", star_student_id: null },
  { id: 15, group_id: 3, study_month_id: 7, starts_at: dt(2026, 8, 10, 15, 0), ends_at: dt(2026, 8, 10, 17, 0), session_index: 3, status: "scheduled", source: "auto", star_student_id: null },
];

const attendances = [];
let aid = 1;
function addAtt(sessionId, studentIds, statuses) {
  studentIds.forEach((sid, i) => {
    attendances.push({
      id: aid++,
      session_id: sessionId,
      student_id: sid,
      status: statuses[i] || "present",
      notes: null,
    });
  });
}
addAtt(1, [1, 2, 3, 4], ["present", "present", "absent_excused", "present"]);
addAtt(2, [1, 2, 3, 4], ["present", "present", "present", "present"]);
addAtt(3, [5, 6, 7, 8], ["present", "absent_unexcused", "present", "present"]);
addAtt(4, [5, 6, 7, 8], ["present", "present", "present", "present"]);
addAtt(5, [9, 10, 12], ["present", "present", "present"]);
addAtt(6, [9, 10, 12], ["present", "absent_excused", "present"]);

const billing_rounds = [];
let rid = 1;
[
  [1, [1, 2, 3, 4]],
  [2, [5, 6, 7, 8]],
  [3, [9, 10, 12]],
].forEach(([gid, sids]) => {
  sids.forEach((sid) => {
    billing_rounds.push({
      id: rid++,
      group_id: gid,
      student_id: sid,
      round_number: 1,
      target_classes: 4,
      counted_classes: 2,
      status: "open",
      started_at: "2026-07-01 00:00:00",
      closed_at: null,
    });
  });
});

const payments = [
  { id: 1, student_id: 1, study_month_id: 7, billing_round_id: 1, group_id: 1, amount: 400, paid_at: "2026-07-05 12:00:00", method: "cash", note: "دفعة كاملة", created_at: "2026-07-05 12:00:00" },
  { id: 2, student_id: 2, study_month_id: 7, billing_round_id: 2, group_id: 1, amount: 200, paid_at: "2026-07-06 12:00:00", method: "transfer", note: "دفعة جزئية", created_at: "2026-07-06 12:00:00" },
  { id: 3, student_id: 5, study_month_id: 7, billing_round_id: 5, group_id: 2, amount: 500, paid_at: "2026-07-07 12:00:00", method: "cash", note: null, created_at: "2026-07-07 12:00:00" },
  { id: 4, student_id: 6, study_month_id: 7, billing_round_id: 6, group_id: 2, amount: 250, paid_at: "2026-07-08 12:00:00", method: "transfer", note: null, created_at: "2026-07-08 12:00:00" },
  { id: 5, student_id: 9, study_month_id: 7, billing_round_id: 9, group_id: 3, amount: 600, paid_at: "2026-07-09 12:00:00", method: "cash", note: null, created_at: "2026-07-09 12:00:00" },
  { id: 6, student_id: 10, study_month_id: 7, billing_round_id: 10, group_id: 3, amount: 300, paid_at: "2026-07-10 12:00:00", method: "other", note: "تحويل فودافون كاش", created_at: "2026-07-10 12:00:00" },
];

const payload = {
  version: 1,
  exported_at: new Date().toISOString(),
  tables: {
    academic_years: [
      {
        id: 1,
        name: "2025/2026",
        start_date: "2025-10-01",
        end_date: "2026-08-31",
        is_active: 1,
        status: "open",
        created_at: "2025-09-15 08:00:00",
      },
    ],
    semesters: [
      { id: 1, academic_year_id: 1, name: "الفصل الأول", sort_order: 1, start_date: "2025-10-01", end_date: "2026-01-15", status: "closed" },
      { id: 2, academic_year_id: 1, name: "الفصل الثاني", sort_order: 2, start_date: "2026-02-01", end_date: "2026-08-31", status: "open" },
    ],
    study_months,
    groups,
    group_schedule_patterns: patterns,
    students,
    enrollments,
    group_sessions: sessions,
    attendances,
    billing_rounds,
    payments,
  },
};

const out1 = "E:/tutoring-manager/mobile/samples/tutoring-backup-sample-full.json";
const out2 = "C:/Users/mo7am/OneDrive/Desktop/tutoring-backup-sample-full.json";
const json = JSON.stringify(payload, null, 2);
fs.writeFileSync(out1, json, "utf8");
fs.writeFileSync(out2, json, "utf8");
console.log("Wrote", out1);
console.log("Wrote", out2);
console.log(
  "Counts:",
  Object.fromEntries(Object.entries(payload.tables).map(([k, v]) => [k, v.length]))
);
