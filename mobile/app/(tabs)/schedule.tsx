import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState, LoadingBlock, Screen, Title } from "@/src/components/ui";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listWeekSessions } from "@/src/repositories";
import type { GroupSession, Weekday } from "@/src/db/types";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

type Row = GroupSession & { group_name: string; accent_color: string | null };

/** Display order Sat → Fri */
const DAY_ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5];

function dayLabel(d: Weekday): string {
  const map: Record<Weekday, string> = {
    0: t("sun"),
    1: t("mon"),
    2: t("tue"),
    3: t("wed"),
    4: t("thu"),
    5: t("fri"),
    6: t("sat"),
  };
  return map[d];
}

function timeOf(iso: string): string {
  const m = iso.match(/(\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

function weekdayOf(iso: string): Weekday {
  // SQLite local datetime "YYYY-MM-DD HH:mm:ss" — parse as local
  const d = new Date(iso.replace(" ", "T"));
  return d.getDay() as Weekday;
}

export default function WeeklyScheduleScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWeekSessions());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const byDay = useMemo(() => {
    const map: Record<number, Row[]> = {};
    for (const d of DAY_ORDER) map[d] = [];
    for (const r of rows) {
      const wd = weekdayOf(r.starts_at);
      if (!map[wd]) map[wd] = [];
      map[wd].push(r);
    }
    return map;
  }, [rows]);

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
        horizontal={false}
      >
        <TourAnchor id="scheduleHeader">
          <Title>{t("weeklySchedule")}</Title>
        </TourAnchor>
        {!rows.length ? <EmptyState message={t("noSessions")} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {DAY_ORDER.map((day) => (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayLabel}>
                  <Text style={styles.dayLabelText}>{dayLabel(day)}</Text>
                </View>
                <View style={styles.cells}>
                  {(byDay[day] ?? []).length === 0 ? (
                    <View style={styles.emptyCell}>
                      <Text style={styles.emptyText}>—</Text>
                    </View>
                  ) : (
                    (byDay[day] ?? []).map((s) => {
                      const accent = groupAccentColor(s.group_id, s.accent_color);
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => router.push(`/attendance/${s.id}`)}
                          style={[styles.cell, { borderColor: accent }]}
                        >
                          <Text style={styles.cellTitle} numberOfLines={1}>
                            {s.group_name}
                          </Text>
                          <Text style={styles.cellTime}>{timeOf(s.starts_at)}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: {
    minWidth: "100%",
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayLabel: {
    width: 88,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    justifyContent: "center",
  },
  dayLabelText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
    fontSize: 13,
  },
  cells: {
    flex: 1,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cell: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 110,
  },
  cellTitle: {
    ...rtlText,
    fontWeight: "700",
    color: colors.text,
    fontSize: 13,
  },
  cellTime: {
    ...rtlText,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyCell: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
  },
});
