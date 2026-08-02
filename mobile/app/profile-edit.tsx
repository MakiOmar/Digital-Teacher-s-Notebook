import { useEffect, useState } from "react";
import {
  Image,
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
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

const FALLBACK = require("../assets/images/profile.png");

/** Edit tutor name / photo from More. */
export default function ProfileEditScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const { name: savedName, profileUri: savedUri, saveProfile, pickImage } =
    useTutorProfile();
  const [name, setName] = useState(savedName);
  const [profileUri, setProfileUri] = useState<string | null>(savedUri);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(savedName);
    setProfileUri(savedUri);
  }, [savedName, savedUri]);

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
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{t("editProfile")}</Title>
        <Muted style={{ marginBottom: spacing.lg }}>
          {t("setupWizardHint")}
        </Muted>

        <Pressable onPress={() => void onPickPhoto()} style={styles.avatarWrap}>
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

        <FormField label={t("tutorName")} value={name} onChangeText={setName} />
        <PrimaryButton
          label={busy ? t("loading") : t("save")}
          onPress={() => void onSave()}
          disabled={busy}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
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
