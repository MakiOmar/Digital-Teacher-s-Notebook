import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
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
import { useLicense } from "@/src/license/LicenseContext";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

const BRAND_LOGO = require("../../assets/images/logo.png");

/** Full-screen activate gate when the app is locked. */
export function LicenseActivateScreen() {
  const { activate, lockReason } = useLicense();
  const dialog = useDialog();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!key.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("licenseKeyRequired"),
      });
      return;
    }
    setBusy(true);
    try {
      await activate(key);
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
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton
              label={busy ? t("loading") : t("licenseActivate")}
              onPress={() => void onSubmit()}
              disabled={busy}
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
