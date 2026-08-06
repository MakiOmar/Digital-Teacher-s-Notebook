import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MenuCard, Screen, Title } from "@/src/components/ui";
import { SUPPORT_WHATSAPP } from "@/src/config/support";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { ICONS } from "@/src/theme/icons";
import { rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { useTour } from "@/src/tour/TourContext";
import { useDialog } from "@/src/components/DialogProvider";
import { whatsappUrl } from "@/src/utils/phone";

/** Approximate default bottom tab bar content height (excluding safe area). */
const TAB_BAR_CONTENT = 56;

export default function MoreTab() {
  const router = useRouter();
  const { activeYear } = useAppData();
  const { start } = useTour();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const bottomClearance = TAB_BAR_CONTENT + insets.bottom + spacing.xl;

  async function onRestartTour() {
    await start();
    dialog.toast(t("tourRestart"), "success");
  }

  async function onSupportWhatsApp() {
    const url = whatsappUrl(SUPPORT_WHATSAPP, t("supportWhatsAppMessage"));
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
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: bottomClearance,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Title>{t("more")}</Title>
        {activeYear ? (
          <Text style={styles.meta}>
            {t("activeYear")}: {activeYear.name}
          </Text>
        ) : null}
        <TourAnchor id="moreMenu">
          <View style={{ marginTop: spacing.md }}>
            <MenuCard
              title={t("tourGuide")}
              icon={ICONS.more}
              borderColor={colors.primary}
              onPress={() => void onRestartTour()}
            />
            <MenuCard
              title={t("academicYears")}
              icon={ICONS.years}
              borderColor={colors.accent}
              onPress={() => router.push("/years")}
            />
            <MenuCard
              title={t("tutorProfile")}
              icon={ICONS.more}
              borderColor={colors.primary}
              onPress={() => router.push("/profile-edit" as never)}
            />
            <MenuCard
              title={t("backup")}
              icon={ICONS.backup}
              borderColor={colors.warning}
              onPress={() => router.push("/backup")}
            />
            <MenuCard
              title={t("generalSettings")}
              icon={ICONS.more}
              borderColor={colors.primary}
              onPress={() => router.push("/general-settings" as never)}
            />
            <MenuCard
              title={t("reminders")}
              icon={ICONS.more}
              borderColor={colors.accent}
              onPress={() => router.push("/reminders" as never)}
            />
            <MenuCard
              title={t("reports")}
              icon={ICONS.payments}
              borderColor="#14B8A6"
              onPress={() => router.push("/reports" as never)}
            />
            <MenuCard
              title={t("appLock")}
              icon={ICONS.more}
              borderColor={colors.danger}
              onPress={() => router.push("/app-lock" as never)}
            />
            <MenuCard
              title={t("license")}
              icon={ICONS.more}
              borderColor={colors.success}
              onPress={() => router.push("/license-manage" as never)}
            />
            <MenuCard
              title={t("supportWhatsApp")}
              icon={ICONS.more}
              borderColor="#25D366"
              onPress={() => void onSupportWhatsApp()}
            />
            <MenuCard
              title={t("about")}
              icon={ICONS.more}
              borderColor={colors.textMuted}
              onPress={() => router.push("/about")}
            />
          </View>
        </TourAnchor>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
