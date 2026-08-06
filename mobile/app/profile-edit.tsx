import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import { useKeyboardBottomInset } from "@/src/hooks/useKeyboardBottomInset";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

const FALLBACK = require("../assets/images/profile.webp");

/** Edit tutor name / photo from More. */
export default function ProfileEditScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const nameAnchorY = useRef(0);
  const keyboardInset = useKeyboardBottomInset();
  const { name: savedName, profileUri: savedUri, saveProfile, pickImage } =
    useTutorProfile();
  const [name, setName] = useState(savedName);
  const [profileUri, setProfileUri] = useState<string | null>(savedUri);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(savedName);
    setProfileUri(savedUri);
  }, [savedName, savedUri]);

  useEffect(() => {
    if (keyboardInset <= 0) return;
    const y = Math.max(0, nameAnchorY.current - 24);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [keyboardInset]);

  async function onPickPhoto() {
    try {
      const uri = await pickImage();
      if (uri) setProfileUri(uri);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "permission_denied"
          ? t("profilePhotoPermission")
          : e instanceof Error
            ? e.message
            : t("error");
      await dialog.alert({ title: t("error"), message: msg });
    }
  }

  async function onSave() {
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
        completeSetup: true,
      });
      dialog.toast(t("profileSaved"), "success");
      router.back();
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      setBusy(false);
    }
  }

  const avatarSource = profileUri ? { uri: profileUri } : FALLBACK;

  return (
    <Screen style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: Math.max(48, keyboardInset + 24),
          }}
        >
          <Title>{t("editProfile")}</Title>
          <Muted style={{ marginBottom: spacing.md }}>
            {t("setupWizardHint")}
          </Muted>

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
              {profileUri ? t("changeProfilePhoto") : t("pickProfilePhoto")}
            </Text>
          </Pressable>
          {profileUri ? (
            <Pressable
              onPress={() => setProfileUri(null)}
              style={{ marginBottom: spacing.md }}
            >
              <Text style={styles.removePhoto}>{t("removeProfilePhoto")}</Text>
            </Pressable>
          ) : null}

          <PrimaryButton
            label={busy ? t("loading") : t("save")}
            onPress={() => void onSave()}
            disabled={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
