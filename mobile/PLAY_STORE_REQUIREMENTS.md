# Google Play — release requirements & checklist

App: **دفتر المعلم الرقمي** (`com.itqandev.digitalteachernotebook`)  
Target artifact: signed **Android App Bundle (`.aab`)**

**Full step-by-step publish + testing guide:** [`README-GOOGLE-PLAY.md`](./README-GOOGLE-PLAY.md)

---

## 1. Build identity (configured)

| Item | Value |
|------|--------|
| applicationId | `com.itqandev.digitalteachernotebook` |
| iOS bundle ID | `com.itqandev.digitalteachernotebook` |
| versionName | `1.0.0` |
| versionCode | `1` (must increase for every Play upload) |
| minSdk | 24 |
| targetSdk | 36 |
| ABIs in AAB | `armeabi-v7a`, `arm64-v8a` only — enough for phones; Play delivers the matching split. Do **not** add `x86`/`x86_64` for store builds. |
| JS engine | Hermes |
| Minify / shrink | R8 + resource shrinking **on** |
| Upload signing | `credentials/upload-keystore.p12` (local, gitignored) |

---

## 2. Signing (critical)

- Keystore path: `mobile/credentials/upload-keystore.p12`
- Passwords / alias: `mobile/credentials/keystore.properties`
- **Back up both files offline** (password manager + encrypted USB). Losing them blocks updates unless you use Play App Signing recovery.
- Never commit `credentials/` (already in `.gitignore`).
- Fingerprints (upload key):

```
SHA-1:   1F:A9:D5:7C:E6:C2:10:A9:EB:20:C6:C6:28:51:15:2C:15:0F:7C:83
SHA-256: ED:9D:17:22:09:BA:E1:9F:97:D5:5D:CB:0A:0D:CA:0F:0A:45:ED:DF:AB:58:1F:0E:CE:59:64:8F:D5:F2:D1:4C
```

On first Play Console upload, enable **Play App Signing** (Google holds the app signing key; you keep the upload key).

Rebuild after `expo prebuild`:

```bash
cd mobile
npx expo prebuild --platform android
# plugin withAndroidReleaseSigning re-applies signing block
npm run build:aab
```

---

## 3. Produce the AAB

```bash
cd mobile
npm run build:aab
```

Output (typical):

`android/app/build/outputs/bundle/release/app-release.aab`

Verify signature:

```bash
npm run verify:aab
```

---

## 4. Play Console listing (you must complete)

### Store listing
- [ ] App name (Arabic + optional short EN)
- [ ] Short description (≤80 chars)
- [ ] Full description
- [ ] App icon 512×512
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots (≥2; Arabic UI)
- [ ] Optional tablet screenshots

### Policy / compliance
- [ ] **Privacy policy URL** (hosted HTTPS) — required (license activation, backups, camera, biometrics, notifications)
- [ ] Data safety form (see §5)
- [ ] Content rating questionnaire
- [ ] Target audience / news apps declarations (as applicable)
- [ ] Ads declaration (this app: typically **No ads**)

### App access
- [ ] If license locks the app, provide demo credentials or unlock steps for reviewers

### Release
- [ ] Create production (or closed testing) track
- [ ] Upload `app-release.aab`
- [ ] Countries / pricing
- [ ] Rollout

---

## 5. Data Safety draft (map to Console)

| Data type | Collected? | Shared? | Purpose |
|-----------|------------|---------|---------|
| App activity / diagnostics | Optional (local) | No | App functionality |
| Photos (tutor profile) | Optional, on-device / user-chosen | No | App functionality |
| Files / backups | User-exported backups | No (unless user shares) | App functionality |
| Device / biometric unlock | On-device only (Secure Store / biometrics) | No | App lock |
| License / device checks | May contact license server | With your license backend only | Fraud prevention / entitlement |

Document exact endpoints in the privacy policy (`ULSP` / license activate).

Permissions used (expected merged):
- `INTERNET` — license / updates
- `CAMERA` / photos — tutor profile (optional)
- `USE_BIOMETRIC` / `USE_FINGERPRINT` — app lock
- `POST_NOTIFICATIONS` — reminders
- Storage (scoped / legacy maxSdk 32) — backups
- **Blocked for Play:** `SYSTEM_ALERT_WINDOW` (removed via `android.blockedPermissions`)

---

## 6. Local quality gate before upload

- [ ] Install release build on a physical phone (not only emulator)
- [ ] Cold start, license unlock, create group, payment, backup export
- [ ] App lock + biometric
- [ ] Orientation / RTL layout
- [ ] No debug menu / `__DEV__` tools in release

Quick install from AAB (bundletool), optional:

```bash
# java -jar bundletool.jar build-apks --bundle=app-release.aab --output=app.apks --mode=universal --ks=... 
```

Or use Play internal testing for real devices.

---

## 7. Version bump rule

Every new Play upload **must** raise `android.versionCode` in `app.json` (and rebuild).  
Raise `version` (versionName) for user-visible releases (e.g. `1.0.1`).

---

## 8. If something fails

| Symptom | Fix |
|---------|-----|
| `SigningConfig "release" is missing required property` | Ensure `credentials/keystore.properties` exists and paths are correct |
| Play rejects debuggable / debug-signed | Confirm `signingConfigs.release` is used (`npm run verify:aab`) |
| R8 crash at runtime | Extend `extraProguardRules` / `proguard-rules.pro` |
| `gradlew clean` CMake errors on Windows | Delete `android/app/.cxx` and `**/android/build` manually, then rebuild (do not rely on broken native clean) |
