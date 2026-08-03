import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import { listGroups, listPatterns } from "@/src/repositories";
import type { StudyGroup, Weekday } from "@/src/db/types";
import { WEEKDAY_LABELS, formatMoney } from "@/src/utils/date";
import { colors, groupAccentColor, spacing } from "@/src/theme/colors";
import { useAppData } from "@/src/contexts/AppDataContext";
import { getGroupListStats } from "@/src/services/rounds";

/** Sat → Fri sort order for Arabic week. */
const WEEKDAY_SORT: Record<number, number> = {
  6: 0,
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
};

function primaryWeekday(weekdays: Weekday[]): number {
  if (!weekdays.length) return 99;
  return Math.min(...weekdays.map((d) => WEEKDAY_SORT[d] ?? 99));
}

export default function GroupsTab() {
  const router = useRouter();
  const { bump } = useAppData();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<
    (StudyGroup & {
      scheduleLabel: string;
      student_count: number;
      total_fees: number;
      sortDay: number;
    })[]
  >([]);

  const load = useCallback(async () => {
    const had = groups.length > 0;
    if (!had) setLoading(true);
    try {
      const list = await listGroups();
      const stats = await getGroupListStats();
      const statsMap = new Map(stats.map((s) => [s.group_id, s]));
      const enriched = await Promise.all(
        list.map(async (g) => {
          const patterns = await listPatterns(g.id);
          const weekdays = patterns.map((p) => p.weekday as Weekday);
          const scheduleLabel = patterns
            .slice()
            .sort(
              (a, b) =>
                (WEEKDAY_SORT[a.weekday] ?? 99) -
                (WEEKDAY_SORT[b.weekday] ?? 99)
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
        })
      );
      enriched.sort((a, b) => {
        if (a.sortDay !== b.sortDay) return a.sortDay - b.sortDay;
        return a.name.localeCompare(b.name, "ar");
      });
      setGroups(enriched);
    } finally {
      setLoading(false);
    }
  }, [groups.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    return groups.filter(
      (g) => g.name.includes(q) || (g.subject ?? "").includes(q)
    );
  }, [groups, query]);

  if (loading && !groups.length) {
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
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={t("noGroups")}
            actionLabel={t("addGroupCta")}
            onAction={() => router.push("/groups/form")}
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
          void load();
        }}
        refreshing={loading}
      />
    </Screen>
  );
}
