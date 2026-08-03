import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Chip,
  EmptyState,
  ListRow,
  Screen,
  SkeletonList,
  StatCard,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import type { PaymentStatus, StudentDueRow } from "@/src/db/types";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow } from "@/src/theme/rtl";

export default function PaymentsTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PaymentStatus | "all">("unpaid");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");
  const [dues, setDues] = useState<StudentDueRow[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);

  const load = useCallback(async () => {
    const had = dues.length > 0;
    if (!had) setLoading(true);
    try {
      const summary = await getOpenRoundsPaymentSummary();
      setDues(summary.dues);
      setTotalCollected(summary.totalCollected);
      setTotalRemaining(summary.totalRemaining);
    } finally {
      setLoading(false);
    }
  }, [dues.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const groups = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of dues) map.set(d.group_id, d.group_name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [dues]);

  const filtered = useMemo(() => {
    let rows = dues;
    if (groupFilter !== "all") {
      rows = rows.filter((d) => d.group_id === groupFilter);
    }
    if (filter !== "all") {
      rows = rows.filter((d) => d.status === filter);
    }
    return rows;
  }, [dues, filter, groupFilter]);

  if (loading && !dues.length) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList />
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
        <View style={[rtlChipRow(), { marginBottom: 8 }]}>
          <Chip
            label={t("filterAllGroups")}
            selected={groupFilter === "all"}
            onPress={() => setGroupFilter("all")}
          />
          {groups.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={groupFilter === g.id}
              onPress={() => setGroupFilter(g.id)}
            />
          ))}
        </View>
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
            borderColor={
              item.status === "paid"
                ? colors.paidBorder
                : item.status === "partial"
                  ? colors.partialBorder
                  : colors.unpaidBorder
            }
            onPress={() =>
              router.push(
                `/groups/round-payments?groupId=${item.group_id}` as never
              )
            }
            trailing={
              item.status !== "paid" ? (
                <Pressable
                  onPress={() => {
                    router.push(
                      `/groups/round-payments?groupId=${item.group_id}` as never
                    );
                  }}
                  hitSlop={10}
                  style={{ padding: 6 }}
                >
                  <FontAwesome name="money" size={18} color={colors.warning} />
                </Pressable>
              ) : null
            }
          />
        )}
        refreshing={loading}
        onRefresh={() => void load()}
      />
    </Screen>
  );
}
