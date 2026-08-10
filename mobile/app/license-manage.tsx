import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { colors, radii, spacing } from "@/src/theme/colors";
import { formatDateAr, dateOnlyFromDateTime } from "@/src/utils/date";
import { rtlBlock, rtlRow, rtlText } from "@/src/theme/rtl";
import { whatsappUrl } from "@/src/utils/phone";
import { userFacingErrorMessage } from "@/src/utils/errors";

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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState("");

  async function onRefresh() {
    setBusy(true);
    try {
      await refresh();
      dialog.toast(t("licenseRechecked"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
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
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  function closeUpgradeModal() {
    if (busy) return;
    setUpgradeOpen(false);
    setUpgradeKey("");
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
      setUpgradeOpen(false);
      dialog.toast(t("licenseActivated"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
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

      {/* Comment: trial users open a modal to enter the paid key instead of always showing the form. */}
      {isTrial ? (
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton
            label={t("licenseUpgradeOpen")}
            onPress={() => setUpgradeOpen(true)}
            disabled={busy}
          />
        </View>
      ) : null}

      <Modal
        visible={upgradeOpen}
        transparent
        animationType="fade"
        onRequestClose={closeUpgradeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeUpgradeModal}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("licenseUpgradeTitle")}</Text>
            <Muted style={{ marginBottom: spacing.md }}>
              {t("licenseUpgradeHint")}
            </Muted>
            <View style={rtlBlock}>
              <FormField
                label={t("licenseKey")}
                value={upgradeKey}
                onChangeText={setUpgradeKey}
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </View>
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
            <View style={[styles.modalActions, rtlRow()]}>
              <Pressable
                onPress={closeUpgradeModal}
                style={styles.modalCancel}
                disabled={busy}
              >
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...rtlText,
    width: "100%",
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    ...rtlText,
    color: colors.text,
    fontWeight: "700",
  },
});
