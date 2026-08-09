import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import {
  EmptyState,
  Screen,
  SkeletonList,
  StatCard,
} from "@/src/components/ui";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { PaymentDueCard } from "@/src/components/PaymentDueCard";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentPage } from "@/src/services/rounds";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import type { PaymentStatus, StudentDueRow } from "@/src/db/types";
import { formatMoney } from "@/src/utils/date";
import { spacing } from "@/src/theme/colors";
import { rtlRow } from "@/src/theme/rtl";

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

  const openRoundPayments = useCallback(
    (groupId: number) => {
      router.push(`/groups/round-payments?groupId=${groupId}` as never);
    },
    [router]
  );

  if (paging.loading) {
    return (
      <Screen safeTop padded={false} style={{ flex: 1 }}>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen safeTop padded={false} style={{ flex: 1 }}>
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
          <PaymentDueCard
            item={item}
            onPress={() => openRoundPayments(item.group_id)}
            onPayPress={() => openRoundPayments(item.group_id)}
          />
        )}
        refreshing={paging.refreshing}
        onRefresh={() => void paging.reload()}
      />
    </Screen>
  );
}
