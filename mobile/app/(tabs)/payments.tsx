import { useCallback, useMemo, useRef, useState } from "react";
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
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentPage } from "@/src/services/rounds";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import type { PaymentStatus, StudentDueRow } from "@/src/db/types";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlRow } from "@/src/theme/rtl";
import { paymentStatusBorderColor } from "@/src/utils/statusLabels";

type PaymentListState = {
  totalCollected: number;
  totalRemaining: number;
  groups: { id: number; name: string }[];
};

export default function PaymentsTab() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [filter, setFilter] = useState<PaymentStatus | "all">("unpaid");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");
  const [state, setState] = useState<PaymentListState>({
    totalCollected: 0,
    totalRemaining: 0,
    groups: [],
  });
  const metadataRequest = useRef(0);

  const groupOptions = useMemo(
    () => [
      { value: "all", label: t("filterAllGroups") },
      ...state.groups.map((g) => ({ value: String(g.id), label: g.name })),
    ],
    [state.groups]
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

  const resetKey = `${filter}:${groupFilter}`;
  const fetchPage = useCallback(
    async (limit: number, offset: number) => {
      const request = ++metadataRequest.current;
      const result = await getOpenRoundsPaymentPage({
        status: filter === "all" ? undefined : filter,
        groupId: groupFilter === "all" ? undefined : groupFilter,
        limit,
        offset,
      });
      if (request === metadataRequest.current) {
        setState({
          totalCollected: result.totalCollected,
          totalRemaining: result.totalRemaining,
          groups: result.groups,
        });
      }
      return { items: result.items, total: result.total };
    },
    [filter, groupFilter]
  );
  const paging = useServerPagination<StudentDueRow>(
    fetchPage,
    pageSize,
    resetKey
  );

  if (paging.loading) {
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
          <PaginationBar {...pagingBarProps(paging)} />
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
            borderColor={paymentStatusBorderColor(item.status)}
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
        refreshing={paging.refreshing}
        onRefresh={() => void paging.reload()}
      />
    </Screen>
  );
}
