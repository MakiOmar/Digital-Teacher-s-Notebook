import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  MenuCard,
  Muted,
  Screen,
  BorderedCard,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import { listUpcomingSessions } from "@/src/repositories";
import { formatDateTimeAr, formatMoney } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, groupAccentColor, spacing } from "@/src/theme/colors";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";

const LOGO = require("../../assets/images/logo.png");

/** Welcome line under logo/profile: waving hand + tutor name. */
function WelcomeRow({ name }: { name: string }) {
  if (!name.trim()) return null;
  return (
    <View style={styles.welcomeRow}>
      <Text style={styles.welcomeWave}>👋</Text>
      <Text style={styles.welcomeText} numberOfLines={1}>
        {t("homeWelcome")} {name.trim()}
      </Text>
    </View>
  );
}

const ICONS = {
  today: require("../../assets/icons/icon-today.png"),
  schedule: require("../../assets/icons/icon-schedule.png"),
  groups: require("../../assets/icons/icon-groups.png"),
  students: require("../../assets/icons/icon-students.png"),
  payments: require("../../assets/icons/icon-payments.png"),
  more: require("../../assets/icons/icon-more.png"),
};

export default function HomeScreen() {
  const router = useRouter();
  const { activeYear, revision } = useAppData();
  const { name: tutorName, profileSource } = useTutorProfile();
  const [loading, setLoading] = useState(true);
  const [nextSession, setNextSession] = useState<
    (GroupSession & { group_name: string; accent_color?: string | null }) | null
  >(null);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [upcoming, summary] = await Promise.all([
        listUpcomingSessions(1),
        getOpenRoundsPaymentSummary(),
      ]);
      setNextSession(upcoming[0] ?? null);
      setTotalCollected(summary.totalCollected);
      setTotalRemaining(summary.totalRemaining);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, revision])
  );

  if (!activeYear) {
    return (
      <Screen>
        <View style={styles.header}>
          <View style={styles.profileCol}>
            <View style={styles.profileRing}>
              <Image source={profileSource} style={styles.profile} />
            </View>
          </View>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <WelcomeRow name={tutorName} />
        <Muted>{t("brandTagline")}</Muted>
        <EmptyState message={t("noActiveYear")} />
        <IconActionBar
          actions={[
            {
              key: "add-year",
              icon: "plus",
              label: t("actionAdd"),
              tone: "accent",
              onPress: () => router.push("/years/form"),
            },
          ]}
        />
      </Screen>
    );
  }

  if (loading && !nextSession) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <View style={styles.header}>
          <View style={styles.profileCol}>
            <View style={styles.profileRing}>
              <Image source={profileSource} style={styles.profile} />
            </View>
          </View>
          <View style={styles.logoCol}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Muted>{activeYear.name}</Muted>
          </View>
        </View>
        <WelcomeRow name={tutorName} />

        <Text style={styles.section}>{t("nextSession")}</Text>
        {!nextSession ? (
          <Muted>{t("noSessions")}</Muted>
        ) : (
          <Pressable
            onPress={() => router.push(`/attendance/${nextSession.id}`)}
          >
            <BorderedCard
              borderColor={groupAccentColor(
                nextSession.group_id,
                nextSession.accent_color
              )}
            >
              <Text style={styles.sessionTitle}>{nextSession.group_name}</Text>
              <Muted>{formatDateTimeAr(nextSession.starts_at)}</Muted>
            </BorderedCard>
          </Pressable>
        )}

        <MenuCard
          title={t("todaySchedule")}
          icon={ICONS.today}
          borderColor={colors.accent}
          onPress={() => router.push("/today" as never)}
        />
        <MenuCard
          title={t("weeklySchedule")}
          icon={ICONS.schedule}
          borderColor={colors.primary}
          onPress={() => router.push("/schedule" as never)}
        />
        <MenuCard
          title={t("groups")}
          icon={ICONS.groups}
          borderColor="#14B8A6"
          onPress={() => router.push("/groups" as never)}
        />
        <MenuCard
          title={t("students")}
          icon={ICONS.students}
          borderColor="#8B5CF6"
          onPress={() => router.push("/students" as never)}
        />
        <MenuCard
          title={t("payments")}
          subtitle={`${t("totalCollected")}: ${formatMoney(totalCollected)} · ${t("remaining")}: ${formatMoney(totalRemaining)}`}
          icon={ICONS.payments}
          borderColor={colors.success}
          onPress={() => router.push("/payments" as never)}
        />
        <MenuCard
          title={t("more")}
          icon={ICONS.more}
          borderColor={colors.textMuted}
          onPress={() => router.push("/more" as never)}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  logoCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  logo: {
    width: "100%",
    height: 64,
  },
  profileCol: {
    alignItems: "center",
    maxWidth: 96,
  },
  profileRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#000",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  profile: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  welcomeRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  welcomeWave: {
    fontSize: 22,
  },
  welcomeText: {
    ...rtlText,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  section: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sessionTitle: {
    ...rtlText,
    width: "100%",
    fontWeight: "800",
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
});
