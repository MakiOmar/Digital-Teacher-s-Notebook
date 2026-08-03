# Sample backup (full demo data)

Importable JSON matching the app backup format (`version: 1`).

## Files

- `tutoring-backup-sample-full.json` — small demo sample
- `generate-sample-backup.js` — regenerates the small sample
- `generate-heavy-backup.js` — stress-test generator
- `tutoring-backup-heavy.json` — large dataset (regenerate; often gitignored)
- `tutoring-backup-heavy.meta.json` — counts / size for the last heavy run

## How to import

1. Open the app → **المزيد** → **النسخ الاحتياطي**
2. Tap **استيراد نسخة احتياطية**
3. Confirm replace
4. Pick the JSON file (heavy copy is also on Desktop as `tutoring-backup-heavy.json`)

**Warning:** Import replaces all local tutoring data.

## Small sample (`tutoring-backup-sample-full.json`)

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

## Heavy sample (stress test)

```bash
cd mobile/samples
node generate-heavy-backup.js              # default: heavy
node generate-heavy-backup.js --profile medium
node generate-heavy-backup.js --profile extreme
```

Default **heavy** profile (approx.):

| Table | ~Count |
|-------|-------:|
| groups | 40 |
| students | 720 |
| enrollments | ~790 |
| sessions | ~3.5k |
| attendances | ~60k |
| billing_rounds | ~3k |
| payments | ~2.5k |
| **total rows** | **~70k** |
| **file size** | **~7 MB** |

Use this to check Home summary, students/groups search, payments filters, attendance mark-all, and restore time under load.
