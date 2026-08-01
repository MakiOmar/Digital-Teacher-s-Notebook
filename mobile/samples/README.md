# Sample backup (full demo data)

Importable JSON matching the app backup format (`version: 1`).

## Files

- `tutoring-backup-sample-full.json` — full sample
- `generate-sample-backup.js` — regenerates the JSON

## How to import

1. Open the app → **المزيد** → **النسخ الاحتياطي**
2. Tap **استيراد نسخة احتياطية**
3. Confirm replace
4. Pick `tutoring-backup-sample-full.json` (also copied to Desktop)

## What’s included

| Table | Count | Notes |
|-------|------:|-------|
| academic_years | 1 | 2025/2026 active |
| semesters | 2 | |
| study_months | 7 | includes Jul–Aug 2026 |
| groups | 3 | Math / Physics / Chemistry |
| schedule patterns | 6 | Sat–Thu slots |
| students | 12 | 1 paused |
| enrollments | 12 | |
| sessions | 15 | past completed + Aug week scheduled |
| attendances | for Jul sessions | present / excused / unexcused |
| billing_rounds | 11 | open round #1 |
| payments | 6 | cash / transfer / other; full + partial |

Designed so **جدول اليوم** / **الجدول الأسبوعي** show data around **1 Aug 2026**.
