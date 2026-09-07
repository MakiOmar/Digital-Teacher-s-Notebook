# Tutoring Manager — Agent Notes

- Mobile app lives in `mobile/` (Expo SDK **57** + Expo Router).
- Offline-first: all data in `expo-sqlite` on device. No live server.
- UI language is **Arabic only** with RTL forced at launch.
- Read Expo **v57** docs — Expo APIs change between majors.
- Avoid storefront-mobile pitfalls: Reanimated babel plugin last, splash hide on mount, Metro Windows `.gradle` blockList, no style arrays on Router `Link`, FlatList `flex:1`, KeyboardAvoidingView on forms.
- Android emulator (x86_64): local builds include `x86_64` via `withAndroidEmulatorSupport` + `buildArchs`. Debug embeds JS (no Metro required for Android Studio Run). Clean Project skips flaky ninja clean and deletes `.cxx` instead. Keep Play AAB arm-only with `npm run build:aab`.
