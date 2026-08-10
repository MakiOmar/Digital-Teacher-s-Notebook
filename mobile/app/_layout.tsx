import "react-native-gesture-handler";
import "react-native-reanimated";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { AppState, I18nManager, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { AppDataProvider, useAppData } from "@/src/contexts/AppDataContext";
import { AppShell, SplashBackground } from "@/src/components/AppBackground";
import { DialogProvider } from "@/src/components/DialogProvider";
import {
  LicenseProvider,
  useLicense,
} from "@/src/license/LicenseContext";
import { LicenseActivateScreen } from "@/src/license/LicenseActivateScreen";
import {
  TutorProfileProvider,
  useTutorProfile,
} from "@/src/profile/TutorProfileContext";
import { SetupWizardScreen } from "@/src/profile/SetupWizardScreen";
import { runAutoBackupIfDue } from "@/src/backup/autoBackup";
import { rescheduleReminders } from "@/src/reminders/reminders";
import {
  AppLockProvider,
  useAppLock,
} from "@/src/security/AppLockContext";
import { AppLockScreen } from "@/src/security/AppLockScreen";
import { GeneralSettingsProvider } from "@/src/settings/GeneralSettingsContext";
import { TourProvider } from "@/src/tour/TourContext";
import { TourSpotlight } from "@/src/tour/TourSpotlight";
import { LanguageProvider } from "@/src/i18n/LanguageContext";
import { bootstrapLanguageLayout } from "@/src/i18n/language";

/**
 * Prefer reading-start alignment helpers in src/theme/rtl.ts.
 * Preferred language drives I18nManager.forceRTL (ar) / false (en).
 * app.json forcesRTL is false so English LTR works after prebuild.
 */
I18nManager.allowRTL(true);

/**
 * Do NOT call preventAutoHideAsync here. Keeping the native splash with
 * OnPreDraw while Metro/JS is still loading causes Android's splash-transfer
 * timeout → black surface that never paints. Rely on CONTENT_APPEARED auto-hide
 * + an explicit hide on RootLayout mount; JS SplashBackground covers boot.
 */

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function hideNativeSplashSoon() {
  void SplashScreen.hideAsync().catch(() => undefined);
}

function Bootstrap({
  children,
  onAppReady,
}: {
  children: React.ReactNode;
  onAppReady: () => void;
}) {
  const { ready, error } = useAppData();
  const { status: licenseStatus, ready: licenseReady } = useLicense();
  const { ready: profileReady, setupComplete } = useTutorProfile();
  const { ready: appLockReady, locked: appLocked } = useAppLock();
  const [rtlReady, setRtlReady] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await bootstrapLanguageLayout();
        if (!cancelled) setRtlReady(true);
      } catch {
        if (!cancelled) setRtlReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bootReady = ready && rtlReady && licenseReady && profileReady && appLockReady;

  useEffect(() => {
    if (bootReady) {
      onAppReady();
    }
  }, [bootReady, onAppReady]);

  // Fail-safe: never stay on splash if init hangs (license/db/rtl).
  useEffect(() => {
    const id = setTimeout(() => {
      setRtlReady(true);
      setForceShow(true);
      onAppReady();
    }, 10_000);
    return () => clearTimeout(id);
  }, [onAppReady]);

  // Silent auto-backup + reminder reschedule when unlocked + setup done.
  // Deferred so splash → first paint is not blocked / killed by heavy DB work.
  useEffect(() => {
    if (licenseStatus !== "unlocked" || !setupComplete) return;
    let lastRemindersAt = 0;
    const REMINDERS_MIN_MS = 60_000;
    let cancelled = false;

    const runReminders = () => {
      const now = Date.now();
      if (now - lastRemindersAt < REMINDERS_MIN_MS) return;
      lastRemindersAt = now;
      void rescheduleReminders().catch(() => undefined);
    };

    const bootWork = setTimeout(() => {
      if (cancelled) return;
      void runAutoBackupIfDue().catch(() => undefined);
      runReminders();
    }, 1500);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void runAutoBackupIfDue().catch(() => undefined);
        runReminders();
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(bootWork);
      sub.remove();
    };
  }, [licenseStatus, setupComplete]);

  if (!bootReady && !forceShow) {
    return (
      <View style={styles.bootPlaceholder}>
        <SplashBackground />
      </View>
    );
  }
  if (error && !forceShow) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Full-app license gate (only after license resolved, or fail-safe)
  if (licenseStatus === "locked") {
    return <LicenseActivateScreen />;
  }
  // Never stay on splash forever if validate hangs — fail-safe forces exit from loading
  if (licenseStatus === "loading") {
    if (forceShow) {
      return <LicenseActivateScreen />;
    }
    return (
      <View style={styles.bootPlaceholder}>
        <SplashBackground />
      </View>
    );
  }
  if (licenseStatus !== "unlocked") {
    return (
      <View style={styles.bootPlaceholder}>
        <SplashBackground />
      </View>
    );
  }

  // Post-license setup wizard until tutor profile is completed
  if (profileReady && !setupComplete) {
    return <SetupWizardScreen />;
  }

  // Device PIN / biometric app lock
  if (appLocked) {
    return <AppLockScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const onAppReady = useCallback(() => setAppReady(true), []);
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setFontsTimedOut(true), 5000);
    return () => clearTimeout(id);
  }, []);

  const fontsOk = fontsLoaded || fontsTimedOut;

  // Unblock Android OnPreDraw immediately — do not wait for DB/license/fonts.
  // JS SplashBackground covers boot until Bootstrap sets appReady.
  useEffect(() => {
    hideNativeSplashSoon();
    const id = setTimeout(hideNativeSplashSoon, 50);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!appReady || !fontsOk) return;
    hideNativeSplashSoon();
  }, [appReady, fontsOk]);

  if (!fontsOk) {
    return (
      <View style={styles.root}>
        <SplashBackground />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="dark" />
      <LanguageProvider>
        <AppDataProvider>
          <LicenseProvider>
            <TutorProfileProvider>
              <AppLockProvider>
                <GeneralSettingsProvider>
                  <TourProvider>
                    <DialogProvider>
                      <Bootstrap onAppReady={onAppReady}>
                        <AppShell>
                          <Stack
                            screenOptions={{
                              // No page titles — back button only on stack screens
                              headerShown: true,
                              headerTitle: "",
                              headerTitleStyle: { fontFamily: fonts.bold },
                              headerShadowVisible: false,
                              // Opaque scenes — transparent content lets both pages'
                              // text paint during the slide, which looks like overlap.
                              headerStyle: { backgroundColor: colors.background },
                              headerTintColor: colors.text,
                              contentStyle: {
                                flex: 1,
                                backgroundColor: colors.background,
                              },
                              animation: "slide_from_right",
                            }}
                          >
                            <Stack.Screen
                              name="(tabs)"
                              options={{
                                headerShown: false,
                                contentStyle: {
                                  flex: 1,
                                  backgroundColor: colors.background,
                                },
                                animation: "fade",
                              }}
                            />
                            <Stack.Screen name="groups/form" />
                            <Stack.Screen name="groups/[id]" />
                            <Stack.Screen name="groups/add-students" />
                            <Stack.Screen name="groups/round-payments" />
                            <Stack.Screen name="groups/sessions" />
                            <Stack.Screen name="attendance/[sessionId]" />
                            <Stack.Screen name="students/form" />
                            <Stack.Screen name="students/[id]" />
                            <Stack.Screen name="payments/form" />
                            <Stack.Screen name="years/index" />
                            <Stack.Screen name="years/form" />
                            <Stack.Screen name="backup" />
                            <Stack.Screen name="about" />
                            <Stack.Screen name="license-manage" />
                            <Stack.Screen name="profile-edit" />
                            <Stack.Screen name="app-lock" />
                            <Stack.Screen name="reminders" />
                            <Stack.Screen name="general-settings" />
                            <Stack.Screen name="reports" />
                          </Stack>
                          <TourSpotlight />
                        </AppShell>
                      </Bootstrap>
                    </DialogProvider>
                  </TourProvider>
                </GeneralSettingsProvider>
              </AppLockProvider>
            </TutorProfileProvider>
          </LicenseProvider>
        </AppDataProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  bootPlaceholder: { flex: 1 },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    width: "100%",
    fontFamily: fonts.regular,
  },
});
