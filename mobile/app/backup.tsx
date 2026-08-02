import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import { exportBackupFile, importBackupFromPicker } from "@/src/services/backup";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import {
  loadAutoBackupSettings,
  runAutoBackupIfDue,
  saveAutoBackupSettings,
  type AutoBackupFrequency,
  type AutoBackupSettings,
} from "@/src/backup/autoBackup";
import { colors, radii, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { formatDateTimeAr } from "@/src/utils/date";

export default function BackupScreen() {
  const { bump } = useAppData();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<AutoBackupSettings>({
    enabled: false,
    frequency: "daily",
    lastRunAt: null,
    lastPath: null,
  });

  const refreshSettings = useCallback(async () => {
    const next = await loadAutoBackupSettings();
    setSettings(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await runAutoBackupIfDue().catch(() => undefined);
        await refreshSettings();
      })();
    }, [refreshSettings])
  );

  async function persistPartial(partial: Partial<AutoBackupSettings>) {
    const next = await saveAutoBackupSettings(partial);
    setSettings(next);
    dialog.toast(t("autoBackupSaved"), "success");
  }

  async function onExport() {
    setBusy(true);
    try {
      await exportBackupFile();
      dialog.toast(t("exportDone"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      setBusy(false);
    }
  }

  function onImport() {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("importBackup"),
        message: t("importConfirm"),
        confirmLabel: t("confirm"),
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      try {
        await importBackupFromPicker();
        bump();
        dialog.toast(t("importDone"), "success");
      } catch (e) {
        if (e instanceof Error && e.message === "تم إلغاء الاختيار") return;
        await dialog.alert({
          title: t("error"),
          message: e instanceof Error ? e.message : t("error"),
        });
      } finally {
        setBusy(false);
      }
    })();
  }

  const lastRunLabel = settings.lastRunAt
    ? formatDateTimeAr(settings.lastRunAt)
    : t("autoBackupNever");

  return (
    <Screen>
      <IconActionBar
        actions={[
          {
            key: "export",
            icon: "upload",
            label: t("actionExport"),
            tone: "accent",
            disabled: busy,
            onPress: () => void onExport(),
          },
          {
            key: "import",
            icon: "download",
            label: t("actionImport"),
            disabled: busy,
            onPress: onImport,
          },
        ]}
      />
      <Title>{t("backup")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>
        صدّر نسخة احتياطية كملف JSON واحفظها على جهازك أو Google Drive يدوياً.
      </Muted>

      <Text style={styles.section}>{t("autoBackup")}</Text>
      <Muted style={{ marginBottom: spacing.md }}>{t("autoBackupHint")}</Muted>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("autoBackupEnable")}</Text>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => void persistPartial({ enabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={settings.enabled ? colors.primary : colors.textMuted}
        />
      </View>

      <Text style={styles.freqLabel}>{t("autoBackupFrequency")}</Text>
      <View style={styles.freqRow}>
        {(["daily", "weekly"] as AutoBackupFrequency[]).map((f) => {
          const selected = settings.frequency === f;
          return (
            <Pressable
              key={f}
              onPress={() => void persistPartial({ frequency: f })}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {f === "daily" ? t("autoBackupDaily") : t("autoBackupWeekly")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.lastBox}>
        <Text style={styles.lastLabel}>{t("autoBackupLastRun")}</Text>
        <Muted>{lastRunLabel}</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  switchRow: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  switchLabel: {
    ...rtlText,
    flex: 1,
    fontWeight: "700",
    color: colors.text,
  },
  freqLabel: {
    ...rtlText,
    width: "100%",
    fontWeight: "600",
    marginBottom: 8,
    color: colors.text,
  },
  freqRow: {
    ...rtlChipRow(),
    gap: 8,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...rtlText,
    fontWeight: "700",
    color: colors.text,
  },
  chipTextOn: { color: "#fff" },
  lastBox: {
    marginTop: spacing.sm,
    gap: 4,
  },
  lastLabel: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    color: colors.text,
  },
});
