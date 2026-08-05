import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { PaginationBar } from "@/src/components/PaginationBar";
import { t } from "@/src/i18n/ar";
import { listGroupsWithPatterns } from "@/src/repositories";
import { getGroupListStats } from "@/src/services/rounds";
import { useRefreshableList } from "@/src/hooks/useRefreshableList";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import type { StudyGroup, Weekday } from "@/src/db/types";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SORT,
  formatMoney,
  primaryWeekday,
} from "@/src/utils/date";
import { colors, groupAccentColor, spacing } from "@/src/theme/colors";
import { useAppData } from "@/src/contexts/AppDataContext";

type GroupRow = StudyGroup & {
  scheduleLabel: string;
  student_count: number;
  total_fees: number;
  sortDay: number;
};

export default function GroupsTab() {
  const router = useRouter();
  const { bump, revision } = useAppData();
  const { pageSize } = useGeneralSettings();
  const [query, setQuery] = useState("");

  const fetcher = useCallback(async () => {
    const [list, stats] = await Promise.all([
      listGroupsWithPatterns(),
      getGroupListStats(),
    ]);
    const statsMap = new Map(stats.map((s) => [s.group_id, s]));
    const enriched: GroupRow[] = list.map((g) => {
      const weekdays = g.patterns.map((p) => p.weekday as Weekday);
      const scheduleLabel = g.patterns
        .slice()
        .sort(
          (a, b) =>
            (WEEKDAY_SORT[a.weekday] ?? 99) - (WEEKDAY_SORT[b.weekday] ?? 99)
        )
        .map((p) => `${WEEKDAY_LABELS[p.weekday]} ${p.start_time}`)
        .join(" · ");
      const st = statsMap.get(g.id);
      return {
        ...g,
        scheduleLabel,
        student_count: Number(st?.student_count ?? 0),
        total_fees: Number(st?.total_fees ?? 0),
        sortDay: primaryWeekday(weekdays),
      };
    });
    enriched.sort((a, b) => {
      if (a.sortDay !== b.sortDay) return a.sortDay - b.sortDay;
      return a.name.localeCompare(b.name, "ar");
    });
    return enriched;
  }, [revision]);

  const { data: groups, loading, refreshing, reload } =
    useRefreshableList(fetcher);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    return groups.filter(
      (g) => g.name.includes(q) || (g.subject ?? "").includes(q)
    );
  }, [groups, query]);

  const paging = useClientPagination(filtered, pageSize, query.trim());

  if (loading) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <IconActionBar
          actions={[
            {
              key: "add",
              icon: "plus",
              label: t("actionAdd"),
              tone: "accent",
              tourId: "groupsAdd",
              onPress: () => router.push("/groups/form"),
            },
          ]}
        />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchPlaceholder")}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={t("noGroups")}
            actionLabel={t("addGroupCta")}
            onAction={() => router.push("/groups/form")}
          />
        }
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
            title={item.name}
            subtitle={`${item.scheduleLabel || "—"} · ${t("studentsCount")}: ${item.student_count} · ${t("groupTotalFees")}: ${formatMoney(item.total_fees)} · ${t("classesPerRound")}: ${item.classes_per_round ?? 4}`}
            right={formatMoney(item.default_monthly_fee)}
            borderColor={groupAccentColor(item.id, item.accent_color)}
            onPress={() => router.push(`/groups/${item.id}`)}
            trailing={
              <Pressable
                onPress={() => {
                  router.push(
                    `/groups/round-payments?groupId=${item.id}` as never
                  );
                }}
                hitSlop={10}
                style={{ padding: 6 }}
              >
                <FontAwesome name="money" size={18} color={colors.success} />
              </Pressable>
            }
          />
        )}
        onRefresh={() => {
          bump();
          void reload();
        }}
        refreshing={refreshing}
      />
    </Screen>
  );
}
