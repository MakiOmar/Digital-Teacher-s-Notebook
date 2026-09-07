import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Screen,
  Title,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listTodaysSessionsPage } from "@/src/repositories";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { groupAccentColor, spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { sessionStatusFilterOptions } from "@/src/utils/statusLabels";

type Row = GroupSession & { group_name: string; accent_color: string | null };

export default function TodayScreen() {
  const router = useRouter();
  const colors = useColors();
  const { pageSize } = useGeneralSettings();
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const fetchPage = useCallback(
    (limit: number, offset: number) =>
      listTodaysSessionsPage({
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as SessionStatus),
        limit,
        offset,
      }),
    [statusFilter]
  );
  const paging = useServerPagination<Row>(
    fetchPage,
    pageSize,
    statusFilter
  );

  const statusOptions = useMemo(() => sessionStatusFilterOptions(), []);

  if (paging.loading) {
    return (
      <Screen safeTop>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen safeTop padded={false} style={{ flex: 1 }}>
      <FlatList
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={paging.refreshing}
            onRefresh={() => void paging.reload()}
          />
        }
        ListHeaderComponent={
          <View>
            <TourAnchor id="todayHeader">
              <Title>{t("todaySchedule")}</Title>
            </TourAnchor>
            <FiltersSheet
              fields={[
                {
                  key: "status",
                  label: t("filterByStatus"),
                  value: statusFilter,
                  options: statusOptions,
                },
              ]}
              onApply={(next) => setStatusFilter(next.status ?? "all")}
            />
          </View>
        }
        ListEmptyComponent={<EmptyState message={t("noSessionsToday")} />}
        ListFooterComponent={
          <PaginationBar {...pagingBarProps(paging)} />
        }
        renderItem={({ item }) => (
          <DetailCard
            title={item.group_name}
            details={[
              {
                icon: "calendar",
                label: t("scheduleShort"),
                value: formatDateTimeAr(item.starts_at),
              },
              {
                icon:
                  item.status === "cancelled" ? "flag" : "info-circle",
                label: t("filterByStatus"),
                value: sessionStatusLabel(item.status),
              },
            ]}
            borderColor={groupAccentColor(
              item.group_id,
              item.accent_color,
              colors
            )}
            onPress={() => router.push(`/attendance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
