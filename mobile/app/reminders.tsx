import { useCallback, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Muted, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import {
  loadReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
} from "@/src/reminders/reminders";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlRow, rtlText } from "@/src/theme/rtl";

export default function RemindersScreen() {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    todayEnabled: false,
    unpaidEnabled: false,
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
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t("reminders")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>{t("remindersHint")}</Muted>

      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderTodayEnable")}</Text>
        <Switch
          value={settings.todayEnabled}
          disabled={busy}
          onValueChange={(todayEnabled) => void persist({ todayEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.todayEnabled ? colors.primary : colors.textMuted
          }
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderUnpaidEnable")}</Text>
        <Switch
          value={settings.unpaidEnabled}
          disabled={busy}
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
