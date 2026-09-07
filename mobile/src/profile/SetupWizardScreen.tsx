import { useEffect, useRef, useState, useMemo } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import {
  loadAutoBackupSettings,
  saveAutoBackupSettings,
  type AutoBackupFrequency,
  type AutoBackupSettings,
} from "@/src/backup/autoBackup";
import { useDialog } from "@/src/components/DialogProvider";
import { LanguageSwitcher } from "@/src/components/LanguageSwitcher";
import { useKeyboardBottomInset } from "@/src/hooks/useKeyboardBottomInset";
import { t } from "@/src/i18n/ar";
import { useLanguage } from "@/src/i18n/LanguageContext";
import type { AppLanguage } from "@/src/i18n/language";
import { radii, spacing, type AppColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

const FALLBACK = require("../../assets/images/profile.webp");
const BRAND_LOGO = require("../../assets/images/logo-full.webp");
const LANGUAGE_CHOSEN_KEY = "tutor.setup.languageChosen.v1";

type Step = "language" | "profile" | "backup";

/** First-run wizard: preferred language, tutor profile, then auto-backup prefs. */
export function SetupWizardScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { name: savedName, profileUri: savedUri, saveProfile, pickImage } =
    useTutorProfile();
  const { language, setLanguage } = useLanguage();
  const dialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const nameAnchorY = useRef(0);
  const keyboardInset = useKeyboardBottomInset();
  const [step, setStep] = useState<Step>("language");
  const [stepReady, setStepReady] = useState(false);
  const [pickedLang, setPickedLang] = useState<AppLanguage>(language);
  const [name, setName] = useState(savedName);
  const [profileUri, setProfileUri] = useState<string | null>(savedUri);
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<AutoBackupSettings>({
    enabled: false,
    frequency: "daily",
    fileMode: "new",
    onEveryEdit: false,
    lastRunAt: null,
    lastPath: null,
    directoryUri: null,
    directoryLabel: null,
  });

  useEffect(() => {
    setName(savedName);
    setProfileUri(savedUri);
  }, [savedName, savedUri]);

  useEffect(() => {
    setPickedLang(language);
  }, [language]);

  useEffect(() => {
    void loadAutoBackupSettings().then(setBackup);
  }, []);

  // After a language-change reload mid-wizard, resume at profile.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const chosen = await AsyncStorage.getItem(LANGUAGE_CHOSEN_KEY);
        if (!cancelled) {
          setStep(chosen === "1" ? "profile" : "language");
          setStepReady(true);
        }
      } catch {
        if (!cancelled) setStepReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When keyboard opens, scroll the name field into the visible area
  useEffect(() => {
    if (keyboardInset <= 0 || step !== "profile") return;
    const y = Math.max(0, nameAnchorY.current - 24);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [keyboardInset, step]);

  async function onPickPhoto() {
    try {
      const uri = await pickImage();
      if (uri) setProfileUri(uri);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "permission_denied"
          ? t("profilePhotoPermission")
          : userFacingErrorMessage(e);
      await dialog.alert({ title: t("error"), message: msg });
    }
  }

  async function onLanguageNext() {
    setBusy(true);
    try {
      await AsyncStorage.setItem(LANGUAGE_CHOSEN_KEY, "1");
      await setLanguage(pickedLang);
      setStep("profile");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onProfileNext() {
    if (!name.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("tutorNameRequired"),
      });
      return;
    }
    setBusy(true);
    try {
      await saveProfile({
        name: name.trim(),
        profileUri,
        completeSetup: false,
      });
      setStep("backup");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onFinish() {
    if (!name.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("tutorNameRequired"),
      });
      return;
    }
    setBusy(true);
    try {
      await saveAutoBackupSettings({
        enabled: backup.enabled,
        frequency: backup.frequency,
      });
      await saveProfile({
        name: name.trim(),
        profileUri,
        completeSetup: true,
      });
      dialog.toast(t("profileSaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  const avatarSource = profileUri ? { uri: profileUri } : FALLBACK;

  const title =
    step === "language"
      ? t("preferredLanguage")
      : step === "profile"
        ? t("setupWizardTitle")
        : t("autoBackup");
  const hint =
    step === "language"
      ? t("preferredLanguageHint")
      : step === "profile"
        ? t("setupWizardHint")
        : t("autoBackupHint");

  if (!stepReady) {
    return (
      <Screen safeTop padded={false} style={{ flex: 1, backgroundColor: colors.background }}>
        <View />
      </Screen>
    );
  }

  return (
    <Screen safeTop padded={false} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(48, keyboardInset + 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Image
            source={BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
          />

          <Title>{title}</Title>
          <Muted style={{ marginBottom: spacing.md }}>{hint}</Muted>

          {step === "language" ? (
            <>
              <LanguageSwitcher
                variant="cards"
                value={pickedLang}
                onChange={setPickedLang}
              />
              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton
                  label={busy ? t("loading") : t("setupNext")}
                  onPress={() => void onLanguageNext()}
                  disabled={busy}
                />
              </View>
            </>
          ) : step === "profile" ? (
            <>
              {/* Name first so it stays above the keyboard */}
              <View
                onLayout={(e) => {
                  nameAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <FormField
                  label={t("tutorName")}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollTo({
                        y: Math.max(0, nameAnchorY.current - 24),
                        animated: true,
                      });
                    }, 120);
                  }}
                />
              </View>

              <Pressable
                onPress={() => void onPickPhoto()}
                style={styles.avatarWrap}
              >
                <View style={styles.avatarRing}>
                  <Image source={avatarSource} style={styles.avatar} />
                </View>
                <Text style={styles.pickLabel}>
                  {profileUri
                    ? t("changeProfilePhoto")
                    : t("pickProfilePhoto")}
                </Text>
              </Pressable>
              {profileUri ? (
                <Pressable
                  onPress={() => setProfileUri(null)}
                  style={{ marginBottom: spacing.md }}
                >
                  <Text style={styles.removePhoto}>
                    {t("removeProfilePhoto")}
                  </Text>
                </Pressable>
              ) : null}

              <PrimaryButton
                label={busy ? t("loading") : t("setupNext")}
                onPress={() => void onProfileNext()}
                disabled={busy}
              />
              <View style={{ marginTop: 10 }}>
                <PrimaryButton
                  label={t("back")}
                  variant="ghost"
                  onPress={() => setStep("language")}
                  disabled={busy}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("autoBackupEnable")}</Text>
                <Switch
                  value={backup.enabled}
                  onValueChange={(enabled) =>
                    setBackup((prev) => ({ ...prev, enabled }))
                  }
                  trackColor={{ false: colors.border, true: colors.primarySoft }}
                  thumbColor={backup.enabled ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={styles.freqLabel}>{t("autoBackupFrequency")}</Text>
              <View style={styles.freqRow}>
                {(["daily", "weekly"] as AutoBackupFrequency[]).map((f) => {
                  const selected = backup.frequency === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() =>
                        setBackup((prev) => ({ ...prev, frequency: f }))
                      }
                      style={[styles.chip, selected && styles.chipOn]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextOn,
                        ]}
                      >
                        {f === "daily"
                          ? t("autoBackupDaily")
                          : t("autoBackupWeekly")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ gap: 10, marginTop: spacing.lg }}>
                <PrimaryButton
                  label={busy ? t("loading") : t("setupFinish")}
                  onPress={() => void onFinish()}
                  disabled={busy}
                />
                <PrimaryButton
                  label={t("back")}
                  variant="ghost"
                  onPress={() => setStep("profile")}
                  disabled={busy}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  brandLogo: {
    width: "100%",
    height: 160,
    alignSelf: "center",
    marginBottom: spacing.md,
    backgroundColor: "transparent",
  },
  avatarWrap: {
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: "hidden",
    backgroundColor: colors.backgroundAlt,
  },
  avatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  pickLabel: {
    ...rtlText,
    marginTop: spacing.sm,
    color: colors.primary,
    fontWeight: "700",
  },
  removePhoto: {
    ...rtlText,
    textAlign: "center",
    color: colors.danger,
    fontWeight: "600",
  },
  switchRow: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
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
});
}
