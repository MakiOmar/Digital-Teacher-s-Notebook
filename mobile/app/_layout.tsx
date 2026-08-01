import "react-native-gesture-handler";
import "react-native-reanimated";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { reloadAppAsync } from "expo";
import { useCallback, useEffect, useState } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/src/theme/colors";
import { AppDataProvider, useAppData } from "@/src/contexts/AppDataContext";
import { AppShell, SplashBackground } from "@/src/components/AppBackground";

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

  useEffect(() => {
    if (ready && rtlReady) {
      onAppReady();
    }
  }, [ready, rtlReady, onAppReady]);

  // Fail-safe: never stay on splash if init hangs.
  useEffect(() => {
    const id = setTimeout(() => {
      setRtlReady(true);
      setForceShow(true);
      onAppReady();
    }, 5000);
    return () => clearTimeout(id);
  }, [onAppReady]);

  if ((!ready || !rtlReady) && !forceShow) {
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
  return <>{children}</>;
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const onAppReady = useCallback(() => setAppReady(true), []);

  useEffect(() => {
    if (!appReady) return;
    const id = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 16);
    return () => clearTimeout(id);
  }, [appReady]);

  useEffect(() => {
    const id = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 4000);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar style="dark" />
      <AppDataProvider>
        <Bootstrap onAppReady={onAppReady}>
          <AppShell>
            <Stack
              screenOptions={{
                // No page titles — back button only on stack screens
                headerShown: true,
                headerTitle: "",
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
            </Stack>
          </AppShell>
        </Bootstrap>
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
  },
});
