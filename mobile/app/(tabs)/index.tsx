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
  Muted,
  PrimaryButton,
  Screen,
  StatCard,
  Title,
} from "@/src/components/ui";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import { listUpcomingSessions } from "@/src/repositories";
import { formatDateTimeAr, formatMoney } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

export default function HomeScreen() {
  const router = useRouter();
  const { activeYear, revision } = useAppData();
  const [loading, setLoading] = useState(true);
  const [nextSession, setNextSession] = useState<
    (GroupSession & { group_name: string }) | null
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
        <Title>{t("home")}</Title>
        <EmptyState message={t("noActiveYear")} />
        <PrimaryButton
          label={t("addYear")}
          onPress={() => router.push("/years/form")}
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Title>{t("home")}</Title>
        <Muted>{activeYear.name}</Muted>

        <Text style={styles.section}>{t("nextSession")}</Text>
        {!nextSession ? (
          <Muted>{t("noSessions")}</Muted>
        ) : (
          <Pressable
            onPress={() => router.push(`/attendance/${nextSession.id}`)}
            style={styles.session}
          >
            <Text style={styles.sessionTitle}>{nextSession.group_name}</Text>
            <Muted>{formatDateTimeAr(nextSession.starts_at)}</Muted>
          </Pressable>
        )}

        <Text style={styles.section}>{t("payments")}</Text>
        <StatCard
          label={t("totalCollected")}
          value={formatMoney(totalCollected)}
          tone="success"
        />
        <StatCard
          label={t("remaining")}
          value={formatMoney(totalRemaining)}
          tone={totalRemaining > 0 ? "danger" : "success"}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    ...rtlText,
    width: "100%",
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  session: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionTitle: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
});
