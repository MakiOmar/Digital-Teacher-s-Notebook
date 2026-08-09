import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Muted, PrimaryButton, Screen, Title } from "@/src/components/ui";
import { useAppLock } from "@/src/security/AppLockContext";
import { t } from "@/src/i18n/ar";
import { spacing } from "@/src/theme/colors";

/** Full-screen gate when app lock is enabled and the session is locked. */
export function AppLockScreen() {
  const { unlock } = useAppLock();
  const [busy, setBusy] = useState(false);

  async function onUnlock() {
    setBusy(true);
    try {
      await unlock();
    } finally {
      setBusy(false);
    }
  }

  // Prompt the system lock UI as soon as the gate appears
  useEffect(() => {
    const id = setTimeout(() => {
      void onUnlock();
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen safeTop padded={false} style={styles.root}>
      <View style={styles.content}>
        <Title>{t("appLockTitle")}</Title>
        <Muted style={{ marginBottom: spacing.lg }}>{t("appLockHint")}</Muted>
        <PrimaryButton
          label={busy ? t("loading") : t("appLockUnlock")}
          onPress={() => void onUnlock()}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
});
