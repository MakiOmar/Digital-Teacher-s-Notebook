import { useCallback, useState } from "react";
import {
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
  PrimaryButton,
  Screen,
  BorderedCard,
} from "@/src/components/ui";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import { listUpcomingSessions } from "@/src/repositories";
import { formatDateTimeAr, formatMoney } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

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
        <Text style={styles.brand}>{t("appName")}</Text>
        <Muted>{t("brandTagline")}</Muted>
        <EmptyState message={t("noActiveYear")} />
        <PrimaryButton
          label={t("addYear")}
          onPress={() => router.push("/years/form")}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{t("appName")}</Text>
            <Muted>{t("brandTagline")}</Muted>
            <Muted>{activeYear.name}</Muted>
          </View>
        </View>

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
    marginBottom: spacing.lg,
  },
  brand: {
    ...rtlText,
    fontSize: 26,
    fontWeight: "900",
    color: colors.primaryDark,
    width: "100%",
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
