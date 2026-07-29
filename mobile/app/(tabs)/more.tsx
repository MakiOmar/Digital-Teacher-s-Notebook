import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MenuCard, Screen, Title } from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";

const ICONS = {
  years: require("../../assets/icons/icon-years.png"),
  students: require("../../assets/icons/icon-students.png"),
  schedule: require("../../assets/icons/icon-schedule.png"),
  backup: require("../../assets/icons/icon-backup.png"),
  more: require("../../assets/icons/icon-more.png"),
};

export default function MoreTab() {
  const router = useRouter();
  const { activeYear } = useAppData();

  return (
    <Screen>
      <Title>{t("more")}</Title>
      {activeYear ? (
        <Text style={styles.meta}>
          {t("activeYear")}: {activeYear.name}
        </Text>
      ) : null}
      <View style={{ marginTop: spacing.md }}>
        <MenuCard
          title={t("students")}
          icon={ICONS.students}
          borderColor="#8B5CF6"
          onPress={() => router.push("/students" as never)}
        />
        <MenuCard
          title={t("weeklySchedule")}
          icon={ICONS.schedule}
          borderColor={colors.primary}
          onPress={() => router.push("/schedule" as never)}
        />
        <MenuCard
          title={t("academicYears")}
          icon={ICONS.years}
          borderColor={colors.accent}
          onPress={() => router.push("/years")}
        />
        <MenuCard
          title={t("backup")}
          icon={ICONS.backup}
          borderColor={colors.warning}
          onPress={() => router.push("/backup")}
        />
        <MenuCard
          title={t("about")}
          icon={ICONS.more}
          borderColor={colors.textMuted}
          onPress={() => router.push("/about")}
        />
      </View>
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
