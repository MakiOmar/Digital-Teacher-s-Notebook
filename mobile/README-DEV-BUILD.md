# Using a development build (not Expo Go, not the browser)

A **development build** is your own Android/iOS app (package `com.tutoringmanager.app`) that still loads JS from Metro. It is **not** opening `http://localhost:8081` in Chrome.

## Common mistake

| What you did | What it actually is |
|--------------|---------------------|
| Pressed `s` in Expo CLI (“switch to development build”) | Only tells Metro to expect a **native** dev client |
| Opened `http://localhost:8081` in the browser | Metro’s HTTP endpoint / **web** — not the mobile app |
| Red screen `wa-sqlite.wasm` | `expo-sqlite` web path loading in the browser |

Opening the localhost URL in a browser will not run the Android tutoring app correctly.

## Correct steps (Android)

### 1. One-time: install native tools

- [Android Studio](https://developer.android.com/studio) with an emulator, **or** a USB phone with USB debugging enabled
- JDK 17+ (Android Studio’s JDK is fine)

### 2. Build and install the development app on the device

From `mobile/`:

```bash
cd E:\tutoring-manager\mobile
npx expo run:android
```

This compiles the native project, installs **دفتر المعلم الرقمي** on the emulator/phone, and starts Metro.

First build can take several minutes. Later runs are faster.

### 3. Day-to-day (after the app is installed)

```bash
cd E:\tutoring-manager\mobile
npx expo start -c
```

Then:

1. Press `s` if prompted so the CLI targets a **development build** (not Expo Go).
2. Open the installed app **دفتر المعلم الرقمي** on the phone/emulator (do **not** open Chrome).
3. The app connects to Metro and loads your JS.

USB device tip: use the same network, or `adb reverse tcp:8081 tcp:8081` if the app cannot reach the PC.

### 4. Reload after code changes

- Shake device → **Reload**, or
- Press `r` in the Metro terminal

## Expo Go vs development build

| | Expo Go | Development build |
|-|---------|-------------------|
| Install | From Play Store | `npx expo run:android` |
| App icon | Expo Go | دفتر المعلم الرقمي |
| Custom native / splash / branding | Limited | Full |
| Reminders (`expo-notifications`) | Broken/limited on Android Go | Works |
| When to use | Quick UI checks | Real feature testing |

## If you only wanted Expo Go

```bash
cd E:\tutoring-manager\mobile
npx expo start -c
```

Press `s` until the CLI says it is targeting **Expo Go**, then scan the QR with Expo Go — again, **not** the browser.

## Web (optional / alpha)

Web needs Metro `.wasm` support (already in `metro.config.js`). Prefer Android/iOS for this app; SQLite-on-web is alpha and needs special COOP/COEP headers.

```bash
npx expo start --web
```

## Related

- Expo Go guide: [`README-EXPO-GO.md`](./README-EXPO-GO.md)
- Main mobile README: [`README.md`](./README.md)
