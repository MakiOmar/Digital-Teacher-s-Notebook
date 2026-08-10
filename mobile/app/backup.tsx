import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import {
  exportBackupFile,
  importBackupFromPicker,
  type BackupProgress,
} from "@/src/services/backup";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import {
  loadAutoBackupSettings,
  runAutoBackupIfDue,
  saveAutoBackupSettings,
  type AutoBackupFrequency,
  type AutoBackupSettings,
} from "@/src/backup/autoBackup";
import {
  canPickBackupFolder,
  pickBackupFolder,
  type BackupFileMode,
} from "@/src/backup/backupLocation";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { formatDateTimeAr } from "@/src/utils/date";
import { userFacingErrorMessage } from "@/src/utils/errors";

type ProgressState = {
  mode: "import" | "export";
  percent: number;
  phase: BackupProgress["phase"];
} | null;

function phaseLabel(phase: BackupProgress["phase"], mode: "import" | "export") {
  if (mode === "export") {
    if (phase === "write") return t("backupProgressWrite");
    return t("backupProgressExport");
  }
  switch (phase) {
    case "read":
      return t("backupProgressRead");
    case "parse":
      return t("backupProgressParse");
    case "clear":
      return t("backupProgressClear");
    case "insert":
      return t("backupProgressInsert");
    default:
      return t("backupProgressImport");
  }
}

export default function BackupScreen() {
  const { bump } = useAppData();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(null);
  const [settings, setSettings] = useState<AutoBackupSettings>({
    enabled: false,
    frequency: "daily",
    fileMode: "new",
    onEveryEdit: false,
    lastRunAt: null,
    lastPath: null,
    directoryUri: null,
    directoryLabel: null,
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

  async function onPickFolder() {
    if (!canPickBackupFolder()) {
      await dialog.alert({
        title: t("backup"),
        message: t("autoBackupFolderUnavailable"),
      });
      return;
    }
    setBusy(true);
    try {
      const picked = await pickBackupFolder();
      if (!picked) return;
      const next = await saveAutoBackupSettings({
        directoryUri: picked.uri,
        directoryLabel: picked.label,
      });
      setSettings(next);
      dialog.toast(t("autoBackupFolderPicked"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onClearFolder() {
    await persistPartial({ directoryUri: null, directoryLabel: null });
  }

  async function onExport() {
    setBusy(true);
    setProgress({ mode: "export", percent: 0, phase: "export" });
    try {
      await exportBackupFile((p) => {
        setProgress({ mode: "export", percent: p.percent, phase: p.phase });
      });
      dialog.toast(t("exportDone"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
      setProgress(null);
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
      setProgress({ mode: "import", percent: 0, phase: "read" });
      try {
        await importBackupFromPicker((p) => {
          setProgress({ mode: "import", percent: p.percent, phase: p.phase });
        });
        bump();
        dialog.toast(t("importDone"), "success");
      } catch (e) {
        if (e instanceof Error && e.message === "تم إلغاء الاختيار") return;
        await dialog.alert({
          title: t("error"),
          message: userFacingErrorMessage(e),
        });
      } finally {
        setBusy(false);
        setProgress(null);
      }
    })();
  }

  const lastRunLabel = settings.lastRunAt
    ? formatDateTimeAr(settings.lastRunAt)
    : t("autoBackupNever");

  const folderLabel =
    settings.directoryLabel?.trim() ||
    (settings.directoryUri
      ? settings.directoryUri
      : t("autoBackupFolderDefault"));

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
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

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t("autoBackupOnEveryEdit")}</Text>
            <Muted>{t("autoBackupOnEveryEditHint")}</Muted>
          </View>
          <Switch
            value={settings.onEveryEdit}
            onValueChange={(onEveryEdit) => void persistPartial({ onEveryEdit })}
            disabled={!settings.enabled}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={
              settings.onEveryEdit && settings.enabled
                ? colors.primary
                : colors.textMuted
            }
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
                disabled={!settings.enabled}
                style={[
                  styles.chip,
                  selected && styles.chipOn,
                  !settings.enabled && { opacity: 0.55 },
                ]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {f === "daily" ? t("autoBackupDaily") : t("autoBackupWeekly")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.freqLabel}>{t("autoBackupFileMode")}</Text>
        <Muted style={{ marginBottom: spacing.sm }}>
          {t("autoBackupFileModeHint")}
        </Muted>
        <View style={styles.freqRow}>
          {(["replace", "new"] as BackupFileMode[]).map((mode) => {
            const selected = settings.fileMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => void persistPartial({ fileMode: mode })}
                disabled={!settings.enabled}
                style={[
                  styles.chip,
                  selected && styles.chipOn,
                  !settings.enabled && { opacity: 0.55 },
                ]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {mode === "replace"
                    ? t("autoBackupReplaceFile")
                    : t("autoBackupNewFile")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>{t("autoBackupFolder")}</Text>
        <Muted style={{ marginBottom: spacing.sm }}>
          {t("autoBackupFolderHint")}
        </Muted>
        <Muted style={{ marginBottom: spacing.md }}>{folderLabel}</Muted>
        <View style={{ gap: 10, marginBottom: spacing.lg }}>
          <PrimaryButton
            label={t("autoBackupPickFolder")}
            onPress={() => void onPickFolder()}
            disabled={busy}
          />
          {settings.directoryUri ? (
            <PrimaryButton
              label={t("autoBackupClearFolder")}
              variant="ghost"
              onPress={() => void onClearFolder()}
              disabled={busy}
            />
          ) : null}
        </View>

        <View style={styles.lastBox}>
          <Text style={styles.lastLabel}>{t("autoBackupLastRun")}</Text>
          <Muted>{lastRunLabel}</Muted>
        </View>
      </ScrollView>

      {/* Progress overlay for long import/export (keeps UI responsive) */}
      <Modal visible={!!progress} transparent animationType="fade">
        <View style={styles.progressScrim}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.progressPercent}>
              {progress ? `${progress.percent}%` : "0%"}
            </Text>
            <Text style={styles.progressPhase}>
              {progress
                ? phaseLabel(progress.phase, progress.mode)
                : t("loading")}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress?.percent ?? 0}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontFamily: fonts.extraBold,
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
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
  },
  freqLabel: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
  },
  progressScrim: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  progressCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  progressPercent: {
    ...rtlText,
    fontSize: 28,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    color: colors.primary,
    marginTop: spacing.sm,
  },
  progressPhase: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  progressTrack: {
    marginTop: spacing.md,
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
});
