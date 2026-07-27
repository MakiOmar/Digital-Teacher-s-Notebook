import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Chip,
  EmptyState,
  ListRow,
  LoadingBlock,
  Screen,
  StatCard,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import type { PaymentStatus, StudentDueRow } from "@/src/db/types";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import { spacing } from "@/src/theme/colors";
import { rtlChipRow } from "@/src/theme/rtl";

export default function DuesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PaymentStatus | "all">("unpaid");
  const [dues, setDues] = useState<StudentDueRow[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getOpenRoundsPaymentSummary();
      setDues(summary.dues);
      setTotalCollected(summary.totalCollected);
      setTotalRemaining(summary.totalRemaining);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (filter === "all") return dues;
    return dues.filter((d) => d.status === filter);
  }, [dues, filter]);

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg }}>
        <StatCard
          label={t("totalCollected")}
          value={formatMoney(totalCollected)}
          tone="success"
        />
        <StatCard
          label={t("remaining")}
          value={formatMoney(totalRemaining)}
          tone="danger"
        />
        <View style={rtlChipRow()}>
          {(
            [
              ["unpaid", t("unpaid")],
              ["partial", t("partial")],
              ["paid", t("paid")],
              ["all", t("filterAll")],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              selected={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </View>
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={filtered}
        keyExtractor={(item) => `${item.student_id}-${item.round_id ?? 0}`}
        ListEmptyComponent={<EmptyState message={t("empty")} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.student_name}
            subtitle={`${item.group_name} · ${
              item.round_number != null
                ? formatRoundTitle(
                    item.round_number,
                    item.started_at,
                    item.closed_at,
                    t("roundUntilOngoing")
                  )
                : t("currentRound")
            } · ${t("remainingClasses")}: ${item.remaining_classes ?? 0} · ${formatMoney(item.paid)} / ${formatMoney(item.due)}`}
            right={formatMoney(item.remaining)}
            onPress={() =>
              router.push({
                pathname: "/payments/form",
                params: {
                  studentId: String(item.student_id),
                  groupId: String(item.group_id),
                },
              })
            }
          />
        )}
        refreshing={loading}
        onRefresh={() => void load()}
      />
    </Screen>
  );
}
