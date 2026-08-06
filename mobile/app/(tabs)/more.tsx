import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

/**
 * Scroll offsets for tour targets after frequency-based reorder:
 * Profile → Years → Backup → Reports → Reminders → Settings cluster → …
 */
const MORE_SCROLL_Y: Record<string, number> = {
  moreHint: 360,
  backupHint: 200,
  remindersHint: 320,
  reportsHint: 260,
};

export default function MoreTab() {
  const router = useRouter();
  const { activeYear } = useAppData();
  const { start, active, stepId } = useTour();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
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

  // Bring the current More tour target into the visible area before measure
  useEffect(() => {
    if (!active) return;
    const y = MORE_SCROLL_Y[stepId];
    if (y == null) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [active, stepId]);

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
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
        {/* Frequency order: everyday tools first, rare/help last */}
        <View style={{ marginTop: spacing.sm }}>
          <MenuCard
            title={t("tutorProfile")}
            icon={ICONS.profile}
            borderColor={colors.primary}
            onPress={() => router.push("/profile-edit" as never)}
          />
          <MenuCard
            title={t("academicYears")}
            icon={ICONS.years}
            borderColor={colors.accent}
            tourId="moreSettings"
            onPress={() => router.push("/years")}
          />
          <MenuCard
            title={t("backup")}
            icon={ICONS.backup}
            borderColor={colors.warning}
            tourId="moreBackup"
            onPress={() => router.push("/backup")}
          />
          <MenuCard
            title={t("reports")}
            icon={ICONS.reports}
            borderColor="#14B8A6"
            tourId="moreReports"
            onPress={() => router.push("/reports" as never)}
          />
          <MenuCard
            title={t("reminders")}
            icon={ICONS.reminders}
            borderColor={colors.accent}
            tourId="moreReminders"
            onPress={() => router.push("/reminders" as never)}
          />
          <TourAnchor id="moreSettingsCluster">
            <MenuCard
              title={t("generalSettings")}
              icon={ICONS.settings}
              borderColor={colors.primary}
              onPress={() => router.push("/general-settings" as never)}
            />
            <MenuCard
              title={t("appLock")}
              icon={ICONS.lock}
              borderColor={colors.danger}
              onPress={() => router.push("/app-lock" as never)}
            />
            <MenuCard
              title={t("license")}
              icon={ICONS.license}
              borderColor={colors.success}
              onPress={() => router.push("/license-manage" as never)}
            />
          </TourAnchor>
          <MenuCard
            title={t("supportWhatsApp")}
            icon={ICONS.support}
            borderColor="#25D366"
            onPress={() => void onSupportWhatsApp()}
          />
          <MenuCard
            title={t("about")}
            icon={ICONS.about}
            borderColor={colors.textMuted}
            onPress={() => router.push("/about")}
          />
          <MenuCard
            title={t("tourGuide")}
            icon={ICONS.guide}
            borderColor={colors.primary}
            tourId="moreMenu"
            onPress={() => void onRestartTour()}
          />
        </View>
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
