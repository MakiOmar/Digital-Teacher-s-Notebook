import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import {
  EmptyState,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { PageToolbar } from "@/src/components/PageToolbar";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listGroupsWithPatternsPage } from "@/src/repositories";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import type { StudyGroup, Weekday } from "@/src/db/types";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SORT,
  formatInteger,
  formatMoney,
} from "@/src/utils/date";
import { groupAccentColor, spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { useAppData } from "@/src/contexts/AppDataContext";

type GroupRow = StudyGroup & {
  scheduleLabel: string;
  student_count: number;
  total_fees: number;
  month_session_total: number;
  month_session_remaining: number;
  weekdays: Weekday[];
};

const WEEKDAY_ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5];

export default function GroupsTab() {
  const router = useRouter();
  const colors = useColors();
  const { bump, revision } = useAppData();
  const { pageSize } = useGeneralSettings();
  const [query, setQuery] = useState("");
  const [weekdayFilter, setWeekdayFilter] = useState<"all" | string>("all");

  const resetKey = `${query.trim()}:${weekdayFilter}`;
  const fetchPage = useCallback(
    async (limit: number, offset: number) => {
      const page = await listGroupsWithPatternsPage({
        query,
        weekday:
          weekdayFilter === "all"
            ? undefined
            : (Number(weekdayFilter) as Weekday),
        limit,
        offset,
      });
      const items: GroupRow[] = page.items.map((g) => {
        const weekdays = g.patterns.map((p) => p.weekday as Weekday);
        const scheduleLabel = g.patterns
          .slice()
          .sort(
            (a, b) =>
              (WEEKDAY_SORT[a.weekday] ?? 99) -
              (WEEKDAY_SORT[b.weekday] ?? 99)
          )
          .map((p) => `${WEEKDAY_LABELS[p.weekday]} ${p.start_time}`)
          .join("، ");
        return {
          ...g,
          scheduleLabel,
          student_count: Number(g.student_count ?? 0),
          total_fees: Number(g.total_fees ?? 0),
          month_session_total: Number(g.month_session_total ?? 0),
          month_session_remaining: Number(g.month_session_remaining ?? 0),
          weekdays,
        };
      });
      return { items, total: page.total };
    },
    [query, revision, weekdayFilter]
  );
  const paging = useServerPagination(fetchPage, pageSize, resetKey);

  const weekdayOptions = useMemo(
    () => [
      { value: "all", label: t("filterAllWeekdays") },
      ...WEEKDAY_ORDER.map((d) => ({
        value: String(d),
        label: WEEKDAY_LABELS[d],
      })),
    ],
    []
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
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <PageToolbar
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
          filter={{
            fields: [
              {
                key: "weekday",
                label: t("filterByWeekday"),
                value: weekdayFilter,
                options: weekdayOptions,
              },
            ],
            onApply: (next) => setWeekdayFilter(next.weekday ?? "all"),
          }}
        >
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchPlaceholder")}
          />
        </PageToolbar>
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
          <TourAnchor id="groupsList">
            <EmptyState
              message={t("noGroups")}
              actionLabel={t("addGroupCta")}
              onAction={() => router.push("/groups/form")}
            />
          </TourAnchor>
        }
        ListFooterComponent={
          <PaginationBar {...pagingBarProps(paging)} />
        }
        renderItem={({ item, index }) => {
          const row = (
            <DetailCard
              title={item.name}
              right={formatMoney(item.default_monthly_fee)}
              details={[
                {
                  icon: "calendar",
                  label: t("scheduleShort"),
                  value: item.scheduleLabel || "—",
                },
                {
                  icon: "users",
                  label: t("studentsCount"),
                  value: formatInteger(item.student_count),
                },
                {
                  icon: "money",
                  label: t("groupTotalFees"),
                  value: formatMoney(item.total_fees),
                },
                {
                  icon: "clock-o",
                  label: t("classesThisMonth"),
                  value: t("classesRemainingOfTotal", {
                    remaining: item.month_session_remaining,
                    total: item.month_session_total,
                  }),
                },
              ]}
              borderColor={groupAccentColor(
                item.id,
                item.accent_color,
                colors
              )}
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
          );
          // Spotlight the first visible group as the hub example
          if (index === 0) {
            return <TourAnchor id="groupsList">{row}</TourAnchor>;
          }
          return row;
        }}
        onRefresh={() => {
          bump();
          void paging.reload();
        }}
        refreshing={paging.refreshing}
      />
    </Screen>
  );
}
