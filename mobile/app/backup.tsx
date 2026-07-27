import { useState } from "react";
import { Alert, View } from "react-native";
import {
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { exportBackupFile, importBackupFromPicker } from "@/src/services/backup";
import { useAppData } from "@/src/contexts/AppDataContext";
import { spacing } from "@/src/theme/colors";

export default function BackupScreen() {
  const { bump } = useAppData();
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      await exportBackupFile();
      Alert.alert(t("success"), t("exportDone"));
    } catch (e) {
      Alert.alert(t("error"), e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  function onImport() {
    Alert.alert(t("importBackup"), t("importConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await importBackupFromPicker();
              bump();
              Alert.alert(t("success"), t("importDone"));
            } catch (e) {
              if (e instanceof Error && e.message === "تم إلغاء الاختيار") return;
              Alert.alert(t("error"), e instanceof Error ? e.message : t("error"));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
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
