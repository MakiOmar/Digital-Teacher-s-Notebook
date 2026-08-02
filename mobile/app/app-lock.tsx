import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Muted, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import { useAppLock } from "@/src/security/AppLockContext";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlRow, rtlText } from "@/src/theme/rtl";

/** Enable/disable device PIN / biometric app lock. */
export default function AppLockSettingsScreen() {
  const { enabled, setEnabled } = useAppLock();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  async function onToggle(next: boolean) {
    setBusy(true);
    try {
      await setEnabled(next);
      dialog.toast(
        next ? t("appLockEnabled") : t("appLockDisabled"),
        "success"
      );
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "no_device_auth"
          ? t("appLockNoDeviceAuth")
          : e instanceof Error && e.message === "auth_cancelled"
            ? t("appLockAuthCancelled")
            : e instanceof Error
              ? e.message
              : t("error");
      if (e instanceof Error && e.message === "auth_cancelled") {
        // Silent cancel — no alert
        return;
      }
      await dialog.alert({ title: t("error"), message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t("appLock")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>{t("appLockSettingsHint")}</Muted>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("appLockEnable")}</Text>
        <Switch
          value={enabled}
          disabled={busy}
          onValueChange={(v) => void onToggle(v)}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={enabled ? colors.primary : colors.textMuted}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchLabel: {
    ...rtlText,
    flex: 1,
    fontWeight: "700",
    color: colors.text,
  },
});
