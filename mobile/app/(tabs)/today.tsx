import { useCallback, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  LoadingBlock,
  Screen,
  Title,
} from "@/src/components/ui";
import { PaginationBar } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listTodaysSessions } from "@/src/repositories";
import type { GroupSession } from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { groupAccentColor, spacing } from "@/src/theme/colors";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";

type Row = GroupSession & { group_name: string; accent_color: string | null };

export default function TodayScreen() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

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

  const paging = useClientPagination(rows, pageSize);

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
          <TourAnchor id="todayHeader">
            <Title>{t("todaySchedule")}</Title>
          </TourAnchor>
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
