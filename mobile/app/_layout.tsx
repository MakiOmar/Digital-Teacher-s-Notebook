import "react-native-gesture-handler";
import "react-native-reanimated";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { reloadAppAsync } from "expo";
import { useCallback, useEffect, useState } from "react";
import { AppState, I18nManager, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
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
import {
  AppLockProvider,
  useAppLock,
} from "@/src/security/AppLockContext";
import { AppLockScreen } from "@/src/security/AppLockScreen";

const RTL_RELOAD_KEY = "tutoring.rtl.reload.v1";

/**
 * Do NOT wrap the tree with style direction:'rtl' — that flips textAlign.
 * Use src/theme/rtl.ts helpers (visualTextAlign / rtlRow / rtlChipRow) so
 * Arabic text stays on the physical right whether or not forceRTL has applied.
 * forceRTL needs one reload for native navigation chrome (back button side).
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

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
  const [rtlReady, setRtlReady] = useState(I18nManager.isRTL);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(true);
        if (I18nManager.isRTL) {
          if (!cancelled) setRtlReady(true);
          return;
        }
        const already = await AsyncStorage.getItem(RTL_RELOAD_KEY);
        if (already === "1") {
          if (!cancelled) setRtlReady(true);
          return;
        }
        await AsyncStorage.setItem(RTL_RELOAD_KEY, "1");
        await reloadAppAsync();
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

  // Fail-safe: never stay on splash if init hangs.
  useEffect(() => {
    const id = setTimeout(() => {
      setRtlReady(true);
      setForceShow(true);
      onAppReady();
    }, 8000);
    return () => clearTimeout(id);
  }, [onAppReady]);

  // Silent auto-backup when unlocked + setup done (launch / foreground)
  useEffect(() => {
    if (licenseStatus !== "unlocked" || !setupComplete) return;
    void runAutoBackupIfDue().catch(() => undefined);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void runAutoBackupIfDue().catch(() => undefined);
      }
    });
    return () => sub.remove();
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
    Cairo_800ExtraBold,
  });

  useEffect(() => {
    if (!appReady || !fontsLoaded) return;
    const id = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 16);
    return () => clearTimeout(id);
  }, [appReady, fontsLoaded]);

  useEffect(() => {
    const id = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 4000);
    return () => clearTimeout(id);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <SplashBackground />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="dark" />
      <AppDataProvider>
        <LicenseProvider>
          <TutorProfileProvider>
            <AppLockProvider>
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
                        headerStyle: { backgroundColor: "transparent" },
                        headerTintColor: colors.text,
                        contentStyle: { backgroundColor: "transparent" },
                      }}
                    >
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="groups/form" />
                      <Stack.Screen name="groups/[id]" />
                      <Stack.Screen name="groups/add-students" />
                      <Stack.Screen name="groups/round-payments" />
                      <Stack.Screen name="groups/sessions" />
                      <Stack.Screen name="attendance/[sessionId]" />
                      <Stack.Screen name="students/form" />
                      <Stack.Screen name="students/[id]" />
                      <Stack.Screen name="payments/form" />
                      <Stack.Screen name="payments/dues" />
                      <Stack.Screen name="years/index" />
                      <Stack.Screen name="years/form" />
                      <Stack.Screen name="backup" />
                      <Stack.Screen name="about" />
                      <Stack.Screen name="license-manage" />
                      <Stack.Screen name="profile-edit" />
                      <Stack.Screen name="app-lock" />
                    </Stack>
                  </AppShell>
                </Bootstrap>
              </DialogProvider>
            </AppLockProvider>
          </TutorProfileProvider>
        </LicenseProvider>
      </AppDataProvider>
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
    writingDirection: "rtl",
    width: "100%",
    fontFamily: fonts.regular,
  },
});
