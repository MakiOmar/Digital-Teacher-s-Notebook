# Google Play — full publish & testing guide

App: **دفتر المعلم الرقمي**  
Package: `com.itqandev.digitalteachernotebook`  
Upload format: signed **Android App Bundle (`.aab`)** only (not APK for production)

This guide is the step-by-step process from “first Play Console app” to production.  
For a short checklist of technical facts, see also [`PLAY_STORE_REQUIREMENTS.md`](./PLAY_STORE_REQUIREMENTS.md).

---

## 0. What “done” looks like

1. Developer account is paid and verified.
2. Store listing + policy forms are complete.
3. A signed **release AAB** is uploaded.
4. You tested on **real phones** via Play testing tracks (not only sideload APK).
5. Google review passes and the app is on Production (full or staged rollout).

---

## 1. Prerequisites (do these once)

### 1.1 Google Play Console account

1. Open [Google Play Console](https://play.google.com/console).
2. Pay the one-time developer registration fee.
3. Complete identity / organization verification (required for new accounts).
4. Prefer a **Google account owned by the business**, not a personal throwaway.

### 1.2 Legal & product pages you must host

You need a public **HTTPS privacy policy URL** before review. It must mention at least:

- What data the app stores on device (students, payments, attendance, backups).
- Optional camera / photos for tutor profile.
- Contacts access (adding student / parent phones).
- Biometric / app lock (on-device).
- Notifications / reminders.
- License activation (ULSP) — what is sent to the license server (license key, device id), retention, and that core teaching data stays local unless the user exports a backup.

Also prepare (not always blocking day one, but needed for a clean listing):

- Short description (≤ 80 characters)
- Full description (Arabic primary; English optional)
- Support email (and optional support website / phone)

### 1.3 Signing keys (never lose these)

Local (gitignored) files:

| File | Purpose |
|------|---------|
| `mobile/credentials/upload-keystore.p12` | Upload keystore |
| `mobile/credentials/keystore.properties` | Passwords + alias |

**Backup both offline** (password manager + encrypted USB). Losing the upload key blocks updates unless you complete Play’s upload-key reset process.

Upload key fingerprints (for Console / support):

```
SHA-1:   1F:A9:D5:7C:E6:C2:10:A9:EB:20:C6:C6:28:51:15:2C:15:0F:7C:83
SHA-256: ED:9D:17:22:09:BA:E1:9F:97:D5:5D:CB:0A:0D:CA:0F:0A:45:ED:DF:AB:58:1F:0E:CE:59:64:8F:D5:F2:D1:4C
```

On the **first** upload, enable **Play App Signing**. Google keeps the *app signing* key; you keep uploading with the *upload* key above.

### 1.4 Build machine

- Android SDK installed (`ANDROID_HOME` set)
- JDK available for Gradle / `jarsigner`
- Project at `E:\tutoring-manager\mobile` (or your clone path)
- `credentials/` present and readable by Gradle

---

## 2. App identity (already configured)

| Item | Value |
|------|--------|
| Application ID | `com.itqandev.digitalteachernotebook` |
| versionName | `1.0.0` (`expo.version` in `app.json`) |
| versionCode | `1` (`expo.android.versionCode`) — **must increase for every new Play upload** |
| minSdk / targetSdk | 24 / 36 |
| ABIs in store AAB | `armeabi-v7a` + `arm64-v8a` only |
| Minify | R8 + resource shrink **on** |

Do **not** add `x86` / `x86_64` to Play AABs. Emulators are for local testing with a separate APK if needed.

---

## 3. Build the Play AAB

### 3.1 Version bump (every upload after the first)

Before building an update:

1. Raise `expo.android.versionCode` in `app.json` (e.g. `1` → `2`).
2. Optionally raise `expo.version` / versionName for users (e.g. `1.0.0` → `1.0.1`).
3. Rebuild (Play rejects reuse of the same `versionCode`).

If you ran `npx expo prebuild`, signing is re-applied by `plugins/withAndroidReleaseSigning.js`.

### 3.2 Produce the bundle

From `mobile/`:

```bash
npm run build:aab
```

Or:

```powershell
cd android
.\gradlew.bat bundleRelease --no-daemon
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

Optional copy for sharing / archive:

`dist/digitalteachernotebook-1.0.0-v1.aab`  
(rename with the new versionCode when you bump, e.g. `...-v2.aab`)

### 3.3 Verify before upload

```bash
npm run verify:aab
```

Expect:

- File exists
- Signature OK
- **Not** `CN=Android Debug`
- Preferably upload CN (`Tutoring Manager Upload`)

Also confirm ABIs inside the AAB are only `armeabi-v7a` and `arm64-v8a`.

---

## 4. Create the app in Play Console

1. **Create app** → name: `دفتر المعلم الرقمي` (or your final store name).
2. Default language: Arabic (add English later if needed).
3. App or game: **App**.
4. Free / paid: choose correctly (license is separate from Play billing unless you sell in-Play).
5. Declarations: accept Play policies / US export / news apps as prompted.

Then open the app dashboard and work left-to-right through **Grow** / **Policy** / **Release** sections until there are no red blockers.

---

## 5. Store listing assets

### 5.1 Main store listing

| Asset | Spec | Notes |
|-------|------|--------|
| App name | ≤ 30 chars | Must match brand |
| Short description | ≤ 80 chars | Arabic |
| Full description | ≤ 4000 chars | Features, offline use, license note |
| App icon | 512×512 PNG | High-res icon |
| Feature graphic | 1024×500 | Banner in Play Store |
| Phone screenshots | ≥ 2 | Prefer Arabic UI, real flows |
| Tablet screenshots | Optional | If you claim tablet support |

Screenshot ideas (in order):

1. Home / dashboard with year active  
2. Students list  
3. Groups / schedule  
4. Attendance  
5. Payments / dues  
6. More / settings (language, backup)

### 5.2 Categorization

- Category: e.g. **Education** / Productivity (pick the closest).
- Contact email: monitored inbox.
- Privacy policy URL: **required**.

---

## 6. Policy & compliance forms

Complete these in Console before production:

| Form | What to answer for this app |
|------|-----------------------------|
| **Privacy policy** | Link to your HTTPS page |
| **Data safety** | See §7 below |
| **Ads** | Typically **No ads** |
| **Content rating** | Complete IARC questionnaire (education / tools; no UGC chat) |
| **Target audience** | Adults / teachers (not primarily children) |
| **News apps** | Usually **No** |
| **Government apps** | Usually **No** |
| **App access** | **Critical** — see §8 (license gate) |
| **Sensitive permissions** | Explain Contacts, Camera, Notifications, Biometrics if asked |

---

## 7. Data safety (draft answers)

Map honestly in Console; keep privacy policy in sync.

| Data type | Collected? | Shared? | Purpose |
|-----------|------------|---------|---------|
| App activity / diagnostics | Optional / local | No | Functionality |
| Photos (tutor profile) | Optional, user-chosen | No | Profile |
| Files / backups | User export | No (unless user shares the file) | Backup |
| Contacts | Optional, user-picked | No | Faster student entry |
| Device / biometrics | On-device unlock | No | App lock |
| License / device id | Sent to ULSP | License backend only | Entitlement / anti-abuse |

Permissions expected:

- `INTERNET` — license validation  
- Camera / photos — tutor profile (optional)  
- Contacts — pick phones (optional)  
- Biometric — app lock  
- Notifications — reminders  
- `SYSTEM_ALERT_WINDOW` is **blocked** for Play (`android.blockedPermissions`)

---

## 8. App access for Google reviewers (license)

The app stays locked until a valid ULSP license (or valid trial) is activated.

Without reviewer access, Google often rejects with “cannot review”.

**Do this before sending for review:**

1. Create a **dedicated review license key** (or temporary trial) on ULSP that works for review devices.
2. In Play Console → **App access** (or “App content” → instructions):
   - State that the app requires a license key on first launch.
   - Provide the **exact key** (and steps: open app → paste key → activate).
   - Note that teaching data is local; reviewers do not need a cloud login.
3. Keep that key valid for the whole review window (do not revoke mid-review).
4. Optionally add a short Arabic + English note in the review notes field.

If activation needs internet, say so and confirm the license API is up.

---

## 9. How testing should go (recommended order)

Do **not** jump straight to Production. Use Play tracks so installs match what users get (Play-signed splits).

```text
Local release APK (optional)
    → Internal testing
        → Closed testing
            → Open testing (optional)
                → Production (staged → 100%)
```

### 9.1 Local smoke (before any Console upload)

**Goal:** catch crashes, R8 issues, signing mistakes early.

1. Build release APK for a physical phone (`arm64-v8a` is fine for sideload):

   ```powershell
   cd android
   .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" --no-daemon
   ```

2. Install on a real Android phone (not only emulator).
3. Run the **core QA checklist** in §10.
4. Fix bugs → rebuild → retest.

Sideload APK ≠ Play install (different signing / splits), so still use Internal testing next.

### 9.2 Internal testing (mandatory first Play track)

**Goal:** same binary path as production; fastest Google processing; small trusted group.

1. Play Console → **Testing** → **Internal testing**.
2. Create a release → upload `app-release.aab`.
3. Release name e.g. `1.0.0 (1)`.
4. Add testers (email list or Google Group). Max is small; enough for you + QA.
5. Copy the **join link** / opt-in URL; each tester must accept.
6. Testers install from Play Store (Internal track), not from a random APK.

**Pass criteria:**

- Installs on 2+ real devices (different brands if possible).
- License activate works on a clean install.
- Core QA checklist (§10) all green.
- No ANR / crash in Play vitals for this build.

Stay here until stable. Typical: **3–7 days** of real use with sample data.

### 9.3 Closed testing (recommended before Production)

**Goal:** wider beta; more device diversity; policy-like review practice.

1. Create a closed track (email list or Google Groups).
2. Promote the same AAB or upload a new `versionCode`.
3. Invite real teachers / staff who will use Arabic UI daily.
4. Collect feedback for 1–2 weeks if possible.

**Pass criteria:**

- No blocker bugs from teachers.
- Backup restore works on a second device.
- RTL + English (if enabled) both usable after language switch + reload.
- Notifications / reminders acceptable on Android 13+ (permission prompt).

Closed testing can also satisfy Play’s “testing before production” expectations for new personal accounts (Console may require a period of testing / minimum testers — follow current Console prompts).

### 9.4 Open testing (optional)

Public beta link. Use only if you want outside teachers before launch. Same QA bar as closed.

### 9.5 Production release

1. Complete all policy forms (no remaining “need attention”).
2. Create Production release → upload AAB (new `versionCode` if not already used).
3. Prefer **staged rollout**: start **10–20%**, watch crashes 24–48h, then 50% → 100%.
4. Countries / pricing set correctly.
5. Submit for review.
6. After approval, monitor:
   - Crashes & ANRs
   - Ratings / reviews
   - License server uptime

---

## 10. Core QA checklist (run on every release candidate)

Use a **clean install** once per candidate, then a second pass with existing data.

### 10.1 First launch & license

- [ ] Splash shows once, then home / license screen (no double splash hang)
- [ ] Invalid license shows a clear error
- [ ] Valid license activates and unlocks the app
- [ ] Airplane mode after a successful validate respects offline grace (7 days)
- [ ] License screen in **المزيد → الترخيص** can re-check / deactivate as designed

### 10.2 Academic setup

- [ ] Create academic year with semester start/end dates from calendar
- [ ] Study months generate correctly from the range
- [ ] Activate year; home reflects it

### 10.3 Students

- [ ] Add student with optional group (`بدون مجموعة`)
- [ ] Guardian / student phone; contacts picker (permission denied handled)
- [ ] Import Excel/CSV + Google Sheets preview **scrolls** for long lists
- [ ] Duplicates skipped with clear preview status
- [ ] Export students sheet
- [ ] Bulk select + delete students (confirm dialog; toast; list refreshes)
- [ ] Search / filters / pagination

### 10.4 Groups & enrollment

- [ ] Create group (schedule, fees, dates)
- [ ] Add existing students to a group
- [ ] Add new names / seats flow
- [ ] Group detail: sessions, seats, payments entry points

### 10.5 Attendance & payments

- [ ] Mark present / absent; complete session
- [ ] Record payment; dues / unpaid lists update
- [ ] Round payments bulk actions if used

### 10.6 Data safety features

- [ ] Backup export shares a file
- [ ] Restore on another install (or after clear data) recovers SQLite data
- [ ] App lock + biometric (if enabled) locks/unlocks; wrong path does not wipe data

### 10.7 Localization & UI

- [ ] Arabic RTL layout correct (headers, forms, lists)
- [ ] Switch to English → reload → LTR works
- [ ] Switch back to Arabic → RTL works
- [ ] No cut-off buttons behind nav / keyboard
- [ ] Landscape / tablet acceptable if you claim them

### 10.8 Release hygiene

- [ ] No Expo / Metro / debug menu in the Play build
- [ ] `verify:aab` passed
- [ ] versionCode unique for this upload
- [ ] Reviewer license key documented in Console

---

## 11. Tester instructions (copy to your team)

Send testers something like:

1. Open the Internal / Closed testing join link and accept.
2. Install **دفتر المعلم الرقمي** from Play Store (you may need to switch to the testing track in Play Store).
3. Activate with the license key we send you (do not share publicly).
4. Create a test year → 1 group → 5 students → mark one session → one payment.
5. Try import (small sheet) and backup export.
6. Report: device model, Android version, steps, screenshot, and whether data was lost.

---

## 12. After Google rejects or asks for changes

| Rejection theme | What to do |
|-----------------|------------|
| Cannot login / license | Fix App access notes + working review key |
| Privacy / Data safety mismatch | Align form + policy URL with real permissions |
| Crash on launch | Reproduce on release build; check R8 / ProGuard; fix; bump versionCode |
| Deceptive / incomplete listing | Fix screenshots, description, feature graphic |
| Permissions justification | Add Console declarations + policy text for Contacts / Camera / etc. |

Always upload a **new versionCode** after code changes.

---

## 13. Ongoing release cadence

1. Develop on a feature branch → QA on Internal.
2. Bump `versionCode` (+ optional `versionName`).
3. `npm run build:aab` → `npm run verify:aab`.
4. Upload to Internal → smoke.
5. Promote to Closed if needed → then Production staged rollout.
6. Keep changelog notes for yourself (Play “release notes” for users).

---

## 14. Common build problems

| Symptom | Fix |
|---------|-----|
| Missing release signing props | Ensure `credentials/keystore.properties` exists and paths are correct |
| Debug-signed AAB | Fix signing; re-run `npm run verify:aab` |
| `gradlew clean` CMake errors on Windows | Delete `android/app/.cxx` and module `build` folders manually; rebuild |
| Stale drawable PNG/WebP clash | Clear `android/app/build/generated/res/react` and rebuild |
| Emulator cannot install arm64-only APK | Use dual-ABI AAB via Play, or build an emu-specific APK with x86_64 |

---

## 15. Quick command cheat sheet

```powershell
# Play Store AAB (dual ABI from gradle.properties)
cd E:\tutoring-manager\mobile
npm run build:aab
npm run verify:aab

# Sideload smoke APK (phones, arm64 only)
cd android
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" --no-daemon
```

Artifacts:

| Track | File |
|-------|------|
| Play upload | `android/app/build/outputs/bundle/release/app-release.aab` |
| Archive copy | `dist/digitalteachernotebook-1.0.0-v1.aab` |
| Phone sideload | `dist/digitalteachernotebook-1.0.0-arm64-min.apk` |

---

## 16. Related docs

- [`PLAY_STORE_REQUIREMENTS.md`](./PLAY_STORE_REQUIREMENTS.md) — short technical checklist  
- [`README.md`](./README.md) — app overview & license env vars  
- [`README-DEV-BUILD.md`](./README-DEV-BUILD.md) — local development builds  

When Console UI labels change, follow the same **order**: listing → policy → internal test → closed → production. The testing discipline above matters more than exact menu names.
