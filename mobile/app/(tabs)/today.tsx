import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  LoadingBlock,
  Screen,
  Title,
} from "@/src/components/ui";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { PaginationBar } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listTodaysSessions } from "@/src/repositories";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { groupAccentColor, spacing } from "@/src/theme/colors";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";

type Row = GroupSession & { group_name: string; accent_color: string | null };

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filterAllStatuses" as const },
  { value: "scheduled", labelKey: "sessionScheduled" as const },
  { value: "completed", labelKey: "sessionCompleted" as const },
  { value: "cancelled", labelKey: "sessionCancelled" as const },
  { value: "rescheduled", labelKey: "sessionRescheduled" as const },
];

export default function TodayScreen() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listTodaysSessions());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        value: o.value,
        label: t(o.labelKey),
      })),
    []
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === (statusFilter as SessionStatus));
  }, [rows, statusFilter]);

  const paging = useClientPagination(filtered, pageSize, statusFilter);

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <FlatList
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
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
            title={item.group_name}
            subtitle={`${formatDateTimeAr(item.starts_at)} · ${sessionStatusLabel(item.status)}`}
            borderColor={groupAccentColor(item.group_id, item.accent_color)}
            onPress={() => router.push(`/attendance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
