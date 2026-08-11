import { useCallback, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Muted, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import {
  DEFAULT_CLASS_LEAD_MINUTES,
  loadReminderSettings,
  remindersAvailableInThisRuntime,
  saveReminderSettings,
  type ReminderSettings,
} from "@/src/reminders/reminders";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

export default function RemindersScreen() {
  const dialog = useDialog();
  const schedulingOk = remindersAvailableInThisRuntime();
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    classEnabled: true,
    unpaidEnabled: false,
    classLeadMinutes: DEFAULT_CLASS_LEAD_MINUTES,
  });

  useFocusEffect(
    useCallback(() => {
      void loadReminderSettings().then(setSettings);
    }, [])
  );

  async function persist(partial: Partial<ReminderSettings>) {
    setBusy(true);
    try {
      const next = await saveReminderSettings(partial);
      setSettings(next);
      dialog.toast(t("remindersSaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {/* Page title */}
      <Title>{t("reminders")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>{t("remindersHint")}</Muted>
      {!schedulingOk ? (
        <Muted style={{ marginBottom: spacing.lg, color: colors.warning }}>
          {t("remindersExpoGoUnavailable")}
        </Muted>
      ) : null}

      {/* Class alerts: one local notification per upcoming session */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderTodayEnable")}</Text>
        <Switch
          value={settings.classEnabled}
          disabled={busy || !schedulingOk}
          onValueChange={(classEnabled) => void persist({ classEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.classEnabled ? colors.primary : colors.textMuted
          }
        />
      </View>

      {/* Weekly unpaid dues nudge */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderUnpaidEnable")}</Text>
        <Switch
          value={settings.unpaidEnabled}
          disabled={busy || !schedulingOk}
          onValueChange={(unpaidEnabled) => void persist({ unpaidEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.unpaidEnabled ? colors.primary : colors.textMuted
          }
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
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  label: {
    ...rtlText,
    flex: 1,
    fontWeight: "700",
    color: colors.text,
  },
});
