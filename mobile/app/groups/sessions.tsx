import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import { FilterBar, FilterSelect } from "@/src/components/FilterSelect";
import { PaginationBar } from "@/src/components/PaginationBar";
import {
  getSessionAttendanceCoverage,
  listSessionsForGroup,
} from "@/src/repositories";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import {
  SessionClassButton,
  sessionStatusLabel,
} from "@/src/components/SessionClassButton";
import { t } from "@/src/i18n/ar";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { spacing } from "@/src/theme/colors";

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filterAllStatuses" as const },
  { value: "scheduled", labelKey: "sessionScheduled" as const },
  { value: "completed", labelKey: "sessionCompleted" as const },
  { value: "cancelled", labelKey: "sessionCancelled" as const },
  { value: "rescheduled", labelKey: "sessionRescheduled" as const },
];

export default function GroupSessionsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = Number(groupId);
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [coverage, setCoverage] = useState<
    Record<number, { marked: number; total: number }>
  >({});
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await listSessionsForGroup(id));
      setCoverage(await getSessionAttendanceCoverage(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

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
    if (statusFilter === "all") return sessions;
    return sessions.filter(
      (s) => s.status === (statusFilter as SessionStatus)
    );
  }, [sessions, statusFilter]);

  const paging = useClientPagination(
    filtered,
    pageSize,
    `${id}:${statusFilter}`
  );

  if (loading) {
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
        ListHeaderComponent={
          <FilterBar>
            <FilterSelect
              label={t("filterByStatus")}
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
            />
          </FilterBar>
        }
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
          <SessionClassButton
            session={item}
            coverage={coverage[item.id]}
            onPress={() => router.push(`/attendance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
