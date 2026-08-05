import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Card,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { useLicense } from "@/src/license/LicenseContext";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { formatDateAr, dateOnlyFromDateTime } from "@/src/utils/date";
import { rtlText } from "@/src/theme/rtl";

function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  const day = dateOnlyFromDateTime(iso);
  return day ? formatDateAr(day) : iso;
}

/** Manage / status screen for an active license. */
export default function LicenseManageScreen() {
  const {
    licenseKeyMasked,
    expiresAt,
    lastValidatedAt,
    isTrial,
    daysRemaining,
    refresh,
    removeLicense,
  } = useLicense();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  async function onRefresh() {
    setBusy(true);
    try {
      await refresh();
      dialog.toast(t("licenseRechecked"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    const ok = await dialog.confirm({
      title: t("licenseRemove"),
      message: t("licenseRemoveConfirm"),
      confirmLabel: t("licenseRemove"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeLicense();
      dialog.toast(t("licenseRemoved"), "success");
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
      <IconActionBar
        actions={[
          {
            key: "refresh",
            icon: "refresh",
            label: t("licenseRecheck"),
            tone: "accent",
            disabled: busy,
            onPress: () => void onRefresh(),
          },
          {
            key: "remove",
            icon: "trash",
            label: t("licenseRemove"),
            tone: "danger",
            disabled: busy,
            onPress: () => void onRemove(),
          },
        ]}
      />
      <Title>{t("license")}</Title>
      <Card>
        <Text style={styles.line}>
          {t("licenseKey")}: {licenseKeyMasked ?? "—"}
        </Text>
        {isTrial ? (
          <View style={{ marginBottom: 6 }}>
            <Muted>{t("licenseTrialActive")}</Muted>
            {daysRemaining != null ? (
              <Muted>
                {t("licenseDaysRemaining", { days: daysRemaining })}
              </Muted>
            ) : null}
          </View>
        ) : null}
        <Muted>
          {t("licenseExpires")}: {formatIsoDate(expiresAt)}
        </Muted>
        <Muted>
          {t("licenseLastCheck")}: {formatIsoDate(lastValidatedAt)}
        </Muted>
        <Muted style={{ marginTop: spacing.sm }}>{t("licenseStatusActive")}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: {
    ...rtlText,
    width: "100%",
    color: colors.text,
    fontWeight: "700",
    marginBottom: 6,
  },
});
