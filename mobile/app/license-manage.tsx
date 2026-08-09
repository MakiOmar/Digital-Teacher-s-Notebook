import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import {
  Card,
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { SUPPORT_WHATSAPP } from "@/src/config/support";
import { useLicense } from "@/src/license/LicenseContext";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { formatDateAr, dateOnlyFromDateTime } from "@/src/utils/date";
import { rtlText } from "@/src/theme/rtl";
import { whatsappUrl } from "@/src/utils/phone";

function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  const day = dateOnlyFromDateTime(iso);
  return day ? formatDateAr(day) : iso;
}

/** Manage / status screen for an active license (including trial → paid upgrade). */
export default function LicenseManageScreen() {
  const {
    licenseKeyMasked,
    expiresAt,
    lastValidatedAt,
    isTrial,
    daysRemaining,
    activate,
    refresh,
    removeLicense,
  } = useLicense();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState("");

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

  async function onActivatePaid() {
    if (!upgradeKey.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("licenseKeyRequired"),
      });
      return;
    }
    setBusy(true);
    try {
      await activate(upgradeKey);
      setUpgradeKey("");
      dialog.toast(t("licenseActivated"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("licenseInvalid"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRequestLicense() {
    const url = whatsappUrl(
      SUPPORT_WHATSAPP,
      t("licenseRequestWhatsAppMessage")
    );
    try {
      await Linking.openURL(url);
    } catch {
      await dialog.alert({
        title: t("error"),
        message: t("supportWhatsAppFailed"),
      });
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

      {/* Comment: online paid activation is available during trial without removing the trial license first. */}
      {isTrial ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.line}>{t("licenseUpgradeTitle")}</Text>
          <Muted style={{ marginBottom: spacing.md }}>
            {t("licenseUpgradeHint")}
          </Muted>
          <FormField
            label={t("licenseKey")}
            value={upgradeKey}
            onChangeText={setUpgradeKey}
            placeholder="XXXX-XXXX-XXXX-XXXX"
          />
          <View style={{ marginTop: spacing.md, gap: 10 }}>
            <PrimaryButton
              label={busy ? t("loading") : t("licenseUpgradeActivate")}
              onPress={() => void onActivatePaid()}
              disabled={busy}
            />
            <PrimaryButton
              label={t("licenseRequestWhatsApp")}
              variant="ghost"
              onPress={() => void onRequestLicense()}
              disabled={busy}
            />
          </View>
        </Card>
      ) : null}
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
