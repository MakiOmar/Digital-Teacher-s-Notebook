import { useState } from "react";
import { View } from "react-native";
import {
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { exportBackupFile, importBackupFromPicker } from "@/src/services/backup";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { spacing } from "@/src/theme/colors";

export default function BackupScreen() {
  const { bump } = useAppData();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

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

  return (
    <Screen>
      <Title>{t("backup")}</Title>
      <Muted>
        صدّر نسخة احتياطية كملف JSON واحفظها على جهازك أو Google Drive يدوياً.
      </Muted>
      <View style={{ gap: 12, marginTop: spacing.lg }}>
        <PrimaryButton
          label={busy ? t("loading") : t("exportBackup")}
          onPress={() => void onExport()}
          disabled={busy}
        />
        <PrimaryButton
          label={t("importBackup")}
          variant="ghost"
          onPress={onImport}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}
