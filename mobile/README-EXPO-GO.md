# Testing with Expo Go

Guide for running **دفتر المعلم الرقمي** on a physical phone (or emulator) using the [Expo Go](https://expo.dev/go) app — without building a native APK/IPA.

## Requirements

| Item | Notes |
|------|--------|
| Node.js | 20 LTS or newer recommended |
| Phone | Android or iOS with **Expo Go** installed |
| Same network | Phone and PC on the same Wi‑Fi (LAN), **or** use Tunnel mode |
| Expo SDK | This project uses **Expo SDK 57** — install Expo Go that matches SDK 57 |

Install Expo Go:

- Android: [Google Play — Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
- iOS: [App Store — Expo Go](https://apps.apple.com/app/expo-go/id982107779)

> In Expo Go, open the projects tab and confirm the app supports **SDK 57**. If it does not, update Expo Go from the store.

## One-time setup

From the repo root (or from `mobile/`):

```bash
cd mobile
npm install
```

Optional license env (ULSP). Create `mobile/.env` if you need a non-default API:

```bash
EXPO_PUBLIC_ULSP_API_BASE=https://ulsp.gamesspoteg.com/api/v1
EXPO_PUBLIC_ULSP_API_KEY=your_product_api_key
```

Restart Metro after changing `.env`.

## Start the bundler

```bash
cd mobile
npx expo start
```

Useful flags:

```bash
# Clear Metro cache if the app looks stale after asset/code changes
npx expo start -c

# Phone and PC cannot use the same Wi‑Fi (corporate/guest network, etc.)
npx expo start --tunnel

# Force LAN URL (default on most home networks)
npx expo start --lan
```

After start you should see a QR code and a Dev Tools URL in the terminal.

## Open the app in Expo Go

### Android

1. Open **Expo Go**.
2. Tap **Scan QR code** and scan the terminal QR code,  
   **or** type the `exp://…` URL shown in the terminal.
3. Wait for the bundle to download; the app should open.

Shortcut from the PC terminal: press `a` after `expo start` if an emulator/USB device is available (opens Expo Go automatically when possible).

### iOS

1. Open the system **Camera** app and scan the QR code, **or** open Expo Go → **Scan QR code**.
2. Confirm opening in Expo Go.
3. Wait for the JS bundle to load.

> iOS Simulator cannot run Expo Go the same way as a device for QR scanning; use a physical iPhone, or a development build / web for other workflows.

## Verify the connection

| Symptom | What to try |
|---------|-------------|
| Stuck on “Connecting…” | Same Wi‑Fi; disable VPN; try `npx expo start --tunnel` |
| “Something went wrong” / red screen | Read the stack in the terminal; often a JS syntax/runtime error |
| Old UI after code change | Reload in Expo Go (shake device → **Reload**), or restart with `-c` |
| Firewall blocks Metro | Allow Node on private networks, or use `--tunnel` |
| SDK mismatch | Update Expo Go so it supports SDK **57** |

Default Metro port is **8081**. Keep that port free while testing.

## Quick smoke-test checklist

Use this path once the app loads:

1. **License / trial** — activate a key or start trial (needs network for ULSP).
2. **Setup wizard** — set tutor name (and optional photo).
3. **More → Academic years** — create a year and set semester dates.
4. **Groups** — add a group with weekdays and price.
5. **Students** — add a student and attach to a group.
6. **Home / Schedule / Today** — confirm sessions and navigation.
7. **Payments** — record a payment if you want to check dues.
8. **More** — profile, backup, reports, reminders, lock (biometric may differ by device).

Home avatar → should open **profile settings**.

## What Expo Go is good for

- UI, navigation, RTL, and most day-to-day flows
- SQLite data on device (`expo-sqlite`)
- Fast iteration (edit → reload)

## Limits vs a native build (`expo run:android` / APK)

Expo Go does **not** apply custom native config the same way a release APK does. Expect differences for:

| Area | In Expo Go | In production APK |
|------|------------|-------------------|
| App name / icon / splash | Expo Go branding / default splash behavior | Full brand assets from `app.json` / plugins |
| Custom native plugins | Often skipped or partial | Applied (`withFullBleedSplash`, build properties, etc.) |
| Notifications | Limited / may need extra setup | Full native behavior |
| Absolute “store-like” install | Runs inside Expo Go | Standalone package `com.tutoringmanager.app` |

For branding, splash, ProGuard, and installable APK testing, use:

```bash
cd mobile
npx expo run:android
```

## Useful commands

```bash
cd mobile

# Start (normal)
npx expo start

# Start + clear cache
npx expo start -c

# Typecheck
npm run lint

# Native rebuild (not Expo Go)
npm run android
```

## Troubleshooting tips

1. **Kill old Metro** — stop previous `expo start` terminals before starting a new one.
2. **Cache** — `npx expo start -c` after icon/asset changes.
3. **Tunnel** — when LAN QR fails: `npx expo start --tunnel` (first run may install `@expo/ngrok`).
4. **Delete app data** — in Expo Go, clear the project or reinstall Expo Go if SQLite / SecureStore state is stuck from an old session.
5. **Windows + OneDrive** — prefer developing from a local path (`E:\tutoring-manager`) rather than a syncing Desktop copy if file watches act weird.

## Related docs

- Main mobile overview: [`README.md`](./README.md)
- Repo overview: [`../README.md`](../README.md)
