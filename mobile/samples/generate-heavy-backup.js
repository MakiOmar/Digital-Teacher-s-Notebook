/**
 * Generate a large version-1 backup for stress-testing lists, payments, Home, etc.
 *
 * Usage:
 *   node generate-heavy-backup.js
 *   node generate-heavy-backup.js --profile medium
 *   node generate-heavy-backup.js --profile extreme
 *
 * Writes:
 *   mobile/samples/tutoring-backup-heavy.json
 *   Desktop/tutoring-backup-heavy.json (if Desktop exists)
 */
const fs = require("fs");
const path = require("path");

const PROFILE = (() => {
  const i = process.argv.indexOf("--profile");
  return i >= 0 ? process.argv[i + 1] : "heavy";
})();

const PROFILES = {
  medium: { groups: 15, studentsPerGroup: 12, closedRounds: 2 },
  heavy: { groups: 40, studentsPerGroup: 18, closedRounds: 3 },
  extreme: { groups: 60, studentsPerGroup: 22, closedRounds: 4 },
};

const cfg = PROFILES[PROFILE] || PROFILES.heavy;

const FIRST = [
  "أحمد", "محمد", "علي", "يوسف", "كريم", "حسام", "زياد", "عمر", "طارق", "وليد",
  "سارة", "مريم", "نورهان", "لينا", "دينا", "هنا", "ياسمين", "ملك", "رهف", "جنى",
  "عبدالله", "إبراهيم", "خالد", "حسن", "محمود", "فؤاد", "سمير", "أشرف", "أمير", "وائل",
];
const MIDDLE = [
  "محمد", "علي", "حسن", "خالد", "عمر", "طارق", "وليد", "حسين", "رضا", "سامي",
  "إبراهيم", "مصطفى", "فؤاد", "ناصر", "سعيد", "جمال", "رامي", "شريف", "هاني", "عادل",
];
const LAST = [
  "علي", "إبراهيم", "محمود", "حسن", "سمير", "فؤاد", "طارق", "أشرف", "أمير", "وائل",
  "عبدالرحمن", "المنسي", "الشاذلي", "فهمي", "زكي", "جابر", "سلامة", "نجيب", "راشد", "كامل",
];

const SUBJECTS = [
  ["رياضيات", "#3B82F6"],
  ["فيزياء", "#14B8A6"],
  ["كيمياء", "#F59E0B"],
  ["عربي", "#EF4444"],
  ["إنجليزي", "#8B5CF6"],
  ["أحياء", "#10B981"],
  ["تاريخ", "#F97316"],
  ["جغرافيا", "#06B6D4"],
];

const LEVELS = [
  "أولى إعدادي",
  "ثانية إعدادي",
  "ثالثة إعدادي",
  "أولى ثانوي",
  "ثانية ثانوي",
  "ثالثة ثانوي",
];

const MONTH_AR = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dt = (y, m, d, h, mi) => `${ymd(y, m, d)} ${pad(h)}:${pad(mi)}:00`;

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function lastDay(y, m) {
  return ymd(y, m, daysInMonth(y, m));
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function phoneFor(i) {
  return `01${String(100000000 + (i * 7919) % 900000000).slice(0, 9)}`;
}

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260803);

function build() {
  const academic_years = [
    {
      id: 1,
      name: "2025/2026",
      start_date: "2025-10-01",
      end_date: "2026-08-31",
      is_active: 1,
      status: "open",
      created_at: "2025-09-10 08:00:00",
    },
  ];

  const semesters = [
    {
      id: 1,
      academic_year_id: 1,
      name: "الفصل الأول",
      sort_order: 1,
      start_date: "2025-10-01",
      end_date: "2026-01-15",
      status: "closed",
    },
    {
      id: 2,
      academic_year_id: 1,
      name: "الفصل الثاني",
      sort_order: 2,
      start_date: "2026-02-01",
      end_date: "2026-08-31",
      status: "open",
    },
  ];

  // Oct 2025 → Jul 2026 (skip Jan mid-break for simplicity; include Jan as closed)
  const monthSpecs = [
    [2025, 10, 1, "closed"],
    [2025, 11, 1, "closed"],
    [2025, 12, 1, "closed"],
    [2026, 1, 1, "closed"],
    [2026, 2, 2, "closed"],
    [2026, 3, 2, "closed"],
    [2026, 4, 2, "closed"],
    [2026, 5, 2, "closed"],
    [2026, 6, 2, "open"],
    [2026, 7, 2, "open"],
  ];

  const study_months = monthSpecs.map(([y, m, sem, status], i) => ({
    id: i + 1,
    semester_id: sem,
    academic_year_id: 1,
    year_month: `${y}-${pad(m)}`,
    display_name: `${MONTH_AR[m]} ${y}`,
    start_date: ymd(y, m, 1),
    end_date: lastDay(y, m),
    status,
  }));

  const monthByKey = Object.fromEntries(
    study_months.map((sm) => [sm.year_month, sm])
  );

  const groups = [];
  const patterns = [];
  let patternId = 1;

  for (let g = 1; g <= cfg.groups; g++) {
    const [subject, color] = pick(SUBJECTS, g - 1);
    const level = pick(LEVELS, Math.floor((g - 1) / SUBJECTS.length));
    const fee = 300 + ((g * 37) % 8) * 50;
    groups.push({
      id: g,
      name: `${level} — ${subject} (${g})`,
      subject,
      default_monthly_fee: fee,
      classes_per_round: 4,
      start_date: "2025-10-01",
      end_date: null,
      accent_color: color,
      status: g % 17 === 0 ? "paused" : "active",
      created_at: "2025-09-20 09:00:00",
    });

    const w1 = g % 7;
    const w2 = (w1 + 3) % 7;
    const hour = 14 + (g % 5);
    for (const weekday of [w1, w2]) {
      patterns.push({
        id: patternId++,
        group_id: g,
        weekday,
        start_time: `${pad(hour)}:00`,
        end_time: `${pad(hour + 2)}:00`,
      });
    }
  }

  const students = [];
  const enrollments = [];
  const groupStudentIds = new Map();
  let studentId = 1;
  let enrollmentId = 1;

  for (let g = 1; g <= cfg.groups; g++) {
    const sids = [];
    for (let s = 0; s < cfg.studentsPerGroup; s++) {
      const id = studentId++;
      const paused = id % 41 === 0;
      students.push({
        id,
        name: `${pick(FIRST, id)} ${pick(MIDDLE, id * 3)} ${pick(LAST, id * 7)}`,
        guardian_phone: phoneFor(id),
        notes: id % 23 === 0 ? "يحتاج متابعة" : null,
        status: paused ? "paused" : "active",
        created_at: dt(2025, 9, 15 + (id % 14), 10, 0),
      });
      sids.push(id);
      enrollments.push({
        id: enrollmentId++,
        student_id: id,
        group_id: g,
        start_date: "2025-10-01",
        end_date: paused ? "2026-01-15" : null,
        custom_monthly_fee: id % 19 === 0 ? groups[g - 1].default_monthly_fee - 50 : null,
        status: paused ? "paused" : "active",
      });
    }
    groupStudentIds.set(g, sids);
  }

  // ~10% of active students also enroll in a second group
  for (const st of students) {
    if (st.status !== "active") continue;
    if (st.id % 10 !== 0) continue;
    const extraGroup = ((st.id * 7) % cfg.groups) + 1;
    const already = enrollments.some(
      (e) => e.student_id === st.id && e.group_id === extraGroup
    );
    if (already) continue;
    enrollments.push({
      id: enrollmentId++,
      student_id: st.id,
      group_id: extraGroup,
      start_date: "2025-11-01",
      end_date: null,
      custom_monthly_fee: null,
      status: "active",
    });
    const list = groupStudentIds.get(extraGroup);
    if (!list.includes(st.id)) list.push(st.id);
  }

  const groupPatterns = new Map();
  for (const p of patterns) {
    if (!groupPatterns.has(p.group_id)) groupPatterns.set(p.group_id, []);
    groupPatterns.get(p.group_id).push(p);
  }

  const sessions = [];
  const attendances = [];
  let sessionId = 1;
  let attendanceId = 1;

  for (const sm of study_months) {
    const [yStr, mStr] = sm.year_month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const dim = daysInMonth(y, m);
    const monthClosed = sm.status === "closed";

    for (let g = 1; g <= cfg.groups; g++) {
      const pats = groupPatterns.get(g) || [];
      let sessionIndex = 0;
      const activeSids = groupStudentIds
        .get(g)
        .filter((sid) => {
          const en = enrollments.find(
            (e) => e.student_id === sid && e.group_id === g
          );
          return en && en.status === "active";
        });

      for (let day = 1; day <= dim; day++) {
        const weekday = new Date(y, m - 1, day).getDay();
        for (const p of pats) {
          if (p.weekday !== weekday) continue;
          sessionIndex += 1;
          const [sh, smi] = p.start_time.split(":").map(Number);
          const [eh, emi] = p.end_time.split(":").map(Number);

          // Past months: completed; current open months: mix scheduled/completed
          let status = "scheduled";
          if (monthClosed) status = "completed";
          else if (day <= 15) status = "completed";
          else if (day <= 20 && rand() < 0.15) status = "cancelled";

          const star =
            status === "completed" && activeSids.length
              ? activeSids[Math.floor(rand() * activeSids.length)]
              : null;

          const sid = sessionId++;
          sessions.push({
            id: sid,
            group_id: g,
            study_month_id: sm.id,
            starts_at: dt(y, m, day, sh, smi || 0),
            ends_at: dt(y, m, day, eh, emi || 0),
            session_index: sessionIndex,
            status,
            source: "auto",
            star_student_id: star,
            notes: status === "cancelled" ? "إلغاء طارئ" : null,
          });

          if (status === "completed") {
            for (const student_id of activeSids) {
              const r = rand();
              const aStatus =
                r < 0.82
                  ? "present"
                  : r < 0.91
                    ? "absent_excused"
                    : "absent_unexcused";
              attendances.push({
                id: attendanceId++,
                session_id: sid,
                student_id,
                status: aStatus,
                notes: null,
              });
            }
          }
        }
      }
    }
  }

  const billing_rounds = [];
  const payments = [];
  const round_stars = [];
  let roundId = 1;
  let paymentId = 1;

  const activeEnrollments = enrollments.filter((e) => e.status === "active");

  for (const en of activeEnrollments) {
    const group = groups[en.group_id - 1];
    const fee = en.custom_monthly_fee ?? group.default_monthly_fee;
    const totalRounds = cfg.closedRounds + 1;

    for (let rn = 1; rn <= totalRounds; rn++) {
      const isOpen = rn === totalRounds;
      const counted = isOpen ? 1 + Math.floor(rand() * 3) : 4;
      const startedMonth = monthSpecs[Math.min(rn - 1, monthSpecs.length - 1)];
      const started_at = dt(startedMonth[0], startedMonth[1], 1, 0, 0);
      const rid = roundId++;

      billing_rounds.push({
        id: rid,
        group_id: en.group_id,
        student_id: en.student_id,
        round_number: rn,
        target_classes: 4,
        counted_classes: counted,
        status: isOpen ? "open" : "closed",
        started_at,
        closed_at: isOpen ? null : dt(startedMonth[0], startedMonth[1], 28, 18, 0),
      });

      // Stars: one per (group, round_number) — set once
      if (
        !round_stars.some(
          (rs) => rs.group_id === en.group_id && rs.round_number === rn
        )
      ) {
        const pool = groupStudentIds.get(en.group_id);
        round_stars.push({
          group_id: en.group_id,
          round_number: rn,
          student_id: pool[Math.floor(rand() * pool.length)],
        });
      }

      // Payments: closed rounds usually fully paid; open rounds mixed
      const payRoll = rand();
      if (!isOpen || payRoll < 0.35) {
        const full = !isOpen || payRoll < 0.15;
        const amount = full ? fee : Math.round(fee * (0.3 + rand() * 0.5));
        const method = pick(["cash", "transfer", "other"], Math.floor(rand() * 3));
        const sm = monthByKey[`${startedMonth[0]}-${pad(startedMonth[1])}`];
        payments.push({
          id: paymentId++,
          student_id: en.student_id,
          study_month_id: sm ? sm.id : null,
          billing_round_id: rid,
          group_id: en.group_id,
          amount,
          paid_at: dt(startedMonth[0], startedMonth[1], 5 + Math.floor(rand() * 10), 12, 0),
          method,
          note: full ? null : "دفعة جزئية",
          created_at: dt(startedMonth[0], startedMonth[1], 5, 12, 0),
        });
      }
    }
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    tables: {
      academic_years,
      semesters,
      study_months,
      groups,
      group_schedule_patterns: patterns,
      students,
      enrollments,
      group_sessions: sessions,
      attendances,
      billing_rounds,
      round_stars,
      payments,
    },
  };
}

const payload = build();
const counts = Object.fromEntries(
  Object.entries(payload.tables).map(([k, v]) => [k, v.length])
);
const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

const samplesDir = __dirname;
const outSamples = path.join(samplesDir, "tutoring-backup-heavy.json");
const desktop = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "OneDrive",
  "Desktop",
  "tutoring-backup-heavy.json"
);
const desktopAlt = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "Desktop",
  "tutoring-backup-heavy.json"
);

// Compact JSON keeps restore parse/insert faster and file smaller
const json = JSON.stringify(payload);
fs.writeFileSync(outSamples, json, "utf8");

let desktopOut = null;
for (const candidate of [desktop, desktopAlt]) {
  try {
    const dir = path.dirname(candidate);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(candidate, json, "utf8");
      desktopOut = candidate;
      break;
    }
  } catch {
    /* ignore */
  }
}

const meta = {
  profile: PROFILE in PROFILES ? PROFILE : "heavy",
  config: cfg,
  counts,
  total_rows: totalRows,
  size_bytes: Buffer.byteLength(json, "utf8"),
  files: [outSamples, desktopOut].filter(Boolean),
};

fs.writeFileSync(
  path.join(samplesDir, "tutoring-backup-heavy.meta.json"),
  JSON.stringify(meta, null, 2),
  "utf8"
);

console.log(JSON.stringify(meta, null, 2));
console.log("Wrote", outSamples);
if (desktopOut) console.log("Wrote", desktopOut);
