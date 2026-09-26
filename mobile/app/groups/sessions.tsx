import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import { useHeaderToolbar } from "@/src/components/useHeaderToolbar";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import {
  getSessionAttendanceCoverage,
  listSessionsForGroupPage,
} from "@/src/repositories";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import {
  SessionClassButton,
  sessionStatusLabel,
} from "@/src/components/SessionClassButton";
import { t } from "@/src/i18n/ar";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { spacing } from "@/src/theme/colors";
import { sessionStatusFilterOptions } from "@/src/utils/statusLabels";

export default function GroupSessionsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = Number(groupId);
  const router = useRouter();
  const navigation = useNavigation();
  const { pageSize } = useGeneralSettings();
  const [coverage, setCoverage] = useState<
    Record<number, { marked: number; total: number }>
  >({});
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const coverageRequest = useRef(0);
  const statusOptions = useMemo(() => sessionStatusFilterOptions(), []);

  useEffect(() => {
    navigation.setOptions({ headerTitle: t("sessions") });
  }, [navigation]);

  useHeaderToolbar({
    filter: {
      fields: [
        {
          key: "status",
          label: t("filterByStatus"),
          value: statusFilter,
          options: statusOptions,
        },
      ],
      onApply: (next) => setStatusFilter(next.status ?? "all"),
    },
  });

  const fetchPage = useCallback(
    async (limit: number, offset: number) => {
      const request = ++coverageRequest.current;
      const page = await listSessionsForGroupPage({
        groupId: id,
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as SessionStatus),
        limit,
        offset,
      });
      const nextCoverage = await getSessionAttendanceCoverage(
        id,
        page.items.map((session) => session.id)
      );
      if (request === coverageRequest.current) setCoverage(nextCoverage);
      return page;
    },
    [id, statusFilter]
  );
  const paging = useServerPagination<GroupSession>(
    fetchPage,
    pageSize,
    `${id}:${statusFilter}`
  );

  if (paging.loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={
              statusFilter === "all"
                ? t("noSessions")
                : `${t("empty")} · ${sessionStatusLabel(statusFilter)}`
            }
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListFooterComponent={
          <PaginationBar {...pagingBarProps(paging)} />
        }
        renderItem={({ item }) => (
          <SessionClassButton
            session={item}
            coverage={coverage[item.id]}
            onPress={() => router.push(`/attendance/${item.id}`)}
          />
        )}
        refreshing={paging.refreshing}
        onRefresh={() => void paging.reload()}
      />
    </Screen>
  );
}
