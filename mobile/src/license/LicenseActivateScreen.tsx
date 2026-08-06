import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { SUPPORT_WHATSAPP } from "@/src/config/support";
import { fetchTrialInfo } from "@/src/license/api";
import { useLicense } from "@/src/license/LicenseContext";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";
import { whatsappUrl } from "@/src/utils/phone";

const BRAND_LOGO = require("../../assets/images/logo.webp");

type TrialOffer = {
  /** undefined = still loading / unknown; false = disabled by API */
  enabled: boolean | undefined;
  trialDays: number | null;
};

type BusyAction = "activate" | "trial" | null;

/** Full-screen activate gate when the app is locked. */
export function LicenseActivateScreen() {
  const { activate, startTrial, lockReason } = useLicense();
  const dialog = useDialog();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [trialOffer, setTrialOffer] = useState<TrialOffer>({
    enabled: undefined,
    trialDays: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await fetchTrialInfo();
        if (cancelled) return;
        setTrialOffer({
          enabled: info.enabled === true,
          trialDays:
            typeof info.trial_days === "number" && info.trial_days > 0
              ? info.trial_days
              : null,
        });
      } catch {
        if (cancelled) return;
        // Keep the CTA; length unknown until start-trial succeeds
        setTrialOffer({ enabled: true, trialDays: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    if (!key.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("licenseKeyRequired"),
      });
      return;
    }
    setBusy("activate");
    try {
      await activate(key);
      dialog.toast(t("licenseActivated"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("licenseInvalid"),
      });
    } finally {
      setBusy(null);
    }
  }

  async function onStartTrial() {
    setBusy("trial");
    try {
      await startTrial();
      dialog.toast(t("licenseTrialStarted"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("licenseInvalid"),
      });
    } finally {
      setBusy(null);
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

  const showTrial = trialOffer.enabled !== false;
  const trialHint =
    trialOffer.trialDays != null
      ? t("licenseStartTrialHintDays", { days: trialOffer.trialDays })
      : t("licenseStartTrialHint");
  const anyBusy = busy != null;
  const trialLabel =
    busy === "trial"
      ? t("loading")
      : trialOffer.trialDays != null
        ? t("licenseStartTrialDays", { days: trialOffer.trialDays })
        : t("licenseStartTrial");

  return (
    <Screen padded={false} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>{t("appName")}</Text>
          <Title>{t("licenseActivateTitle")}</Title>
          <Muted style={{ marginBottom: spacing.lg }}>
            {t("licenseActivateHint")}
          </Muted>
          {lockReason ? (
            <Text style={styles.reason}>{lockReason}</Text>
          ) : null}
          <FormField
            label={t("licenseKey")}
            value={key}
            onChangeText={setKey}
            placeholder="XXXX-XXXX-XXXX-XXXX"
          />
          <View style={{ marginTop: spacing.md, gap: 12 }}>
            <PrimaryButton
              label={busy === "activate" ? t("loading") : t("licenseActivate")}
              onPress={() => void onSubmit()}
              disabled={anyBusy}
            />
            {showTrial ? (
              <>
                <Muted style={{ marginTop: 4 }}>{trialHint}</Muted>
                <PrimaryButton
                  label={trialLabel}
                  variant="ghost"
                  onPress={() => void onStartTrial()}
                  disabled={anyBusy}
                />
              </>
            ) : null}
            <Muted style={{ marginTop: 4 }}>
              {t("licenseRequestWhatsAppHint")}
            </Muted>
            <PrimaryButton
              label={t("licenseRequestWhatsApp")}
              variant="ghost"
              onPress={() => void onRequestLicense()}
              disabled={anyBusy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
    paddingBottom: 48,
  },
  brandLogo: {
    width: "100%",
    height: 88,
    alignSelf: "center",
    marginBottom: spacing.sm,
    backgroundColor: "transparent",
  },
  brandName: {
    ...rtlText,
    width: "100%",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  reason: {
    ...rtlText,
    width: "100%",
    color: colors.danger,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
});
