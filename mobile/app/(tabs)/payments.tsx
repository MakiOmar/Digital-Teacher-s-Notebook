import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  Screen,
  SkeletonList,
  StatCard,
} from "@/src/components/ui";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { PaginationBar } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import { useRefreshableList } from "@/src/hooks/useRefreshableList";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import type { PaymentStatus, StudentDueRow } from "@/src/db/types";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlRow } from "@/src/theme/rtl";

type PaymentListState = {
  dues: StudentDueRow[];
  totalCollected: number;
  totalRemaining: number;
};

export default function PaymentsTab() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [filter, setFilter] = useState<PaymentStatus | "all">("unpaid");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");

  const fetcher = useCallback(async () => {
    const summary = await getOpenRoundsPaymentSummary();
    return [
      {
        dues: summary.dues,
        totalCollected: summary.totalCollected,
        totalRemaining: summary.totalRemaining,
      } satisfies PaymentListState,
    ];
  }, []);

  const { data, loading, refreshing, reload } = useRefreshableList(fetcher);
  const state = data[0] ?? {
    dues: [] as StudentDueRow[],
    totalCollected: 0,
    totalRemaining: 0,
  };

  const groups = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of state.dues) map.set(d.group_id, d.group_name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [state.dues]);

  const groupOptions = useMemo(
    () => [
      { value: "all", label: t("filterAllGroups") },
      ...groups.map((g) => ({ value: String(g.id), label: g.name })),
    ],
    [groups]
  );

  const statusOptions = useMemo(
    () => [
      { value: "unpaid", label: t("unpaid") },
      { value: "partial", label: t("partial") },
      { value: "paid", label: t("paid") },
      { value: "all", label: t("filterAll") },
    ],
    []
  );

  const filtered = useMemo(() => {
    let rows = state.dues;
    if (groupFilter !== "all") {
      rows = rows.filter((d) => d.group_id === groupFilter);
    }
    if (filter !== "all") {
      rows = rows.filter((d) => d.status === filter);
    }
    return rows;
  }, [state.dues, filter, groupFilter]);

  const resetKey = `${filter}:${groupFilter}`;
  const paging = useClientPagination(filtered, pageSize, resetKey);

  if (loading) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg }}>
        <TourAnchor id="paymentsHeader">
          {/* Equal-width summary tiles in one row (RTL: collected on the right). */}
          <View
            style={[
              rtlRow(),
              { gap: spacing.sm, marginBottom: spacing.sm, alignItems: "stretch" },
            ]}
          >
            <StatCard
              label={t("totalCollected")}
              value={formatMoney(state.totalCollected)}
              tone="success"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <StatCard
              label={t("remaining")}
              value={formatMoney(state.totalRemaining)}
              tone="danger"
              style={{ flex: 1, marginBottom: 0 }}
            />
          </View>
        </TourAnchor>
        <FiltersSheet
          fields={[
            {
              key: "group",
              label: t("filterByGroup"),
              value: groupFilter === "all" ? "all" : String(groupFilter),
              options: groupOptions,
            },
            {
              key: "status",
              label: t("filterByStatus"),
              value: filter,
              options: statusOptions,
            },
          ]}
          onApply={(next) => {
            const g = next.group ?? "all";
            setGroupFilter(g === "all" ? "all" : Number(g));
            setFilter((next.status as PaymentStatus | "all") ?? "unpaid");
          }}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={paging.pageItems}
        keyExtractor={(item) => `${item.student_id}-${item.round_id ?? 0}`}
        ListEmptyComponent={<EmptyState message={t("empty")} />}
        ListFooterComponent={
          <PaginationBar
            page={paging.page}
            totalPages={paging.totalPages}
            totalItems={paging.totalItems}
            pageSize={paging.pageSize}
            hasPrev={paging.hasPrev}
            hasNext={paging.hasNext}
            onPrev={paging.prevPage}
            onNext={paging.nextPage}
          />
        }
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
        refreshing={refreshing}
        onRefresh={() => void reload()}
      />
    </Screen>
  );
}
