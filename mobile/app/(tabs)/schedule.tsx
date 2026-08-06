import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState, LoadingBlock, Screen, Title } from "@/src/components/ui";
import { TourAnchor } from "@/src/tour/TourAnchor";
import { t } from "@/src/i18n/ar";
import { listWeekSessions } from "@/src/repositories";
import type { GroupSession, Weekday } from "@/src/db/types";
import {
  formatWeekRangeAr,
  saturdayOfWeek,
  toDateOnly,
  weekDatesFromSaturday,
} from "@/src/utils/date";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";

type Row = GroupSession & { group_name: string; accent_color: string | null };

/** Display order Sat → Fri */
const DAY_ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5];

function dayLetter(d: Weekday): string {
  const map: Record<Weekday, string> = {
    0: t("sunLetter"),
    1: t("monLetter"),
    2: t("tueLetter"),
    3: t("wedLetter"),
    4: t("thuLetter"),
    5: t("friLetter"),
    6: t("satLetter"),
  };
  return map[d];
}

function timeOf(iso: string): string {
  const m = iso.match(/(\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

function weekdayOf(iso: string): Weekday {
  const d = new Date(iso.replace(" ", "T"));
  return d.getDay() as Weekday;
}

function dateKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

export default function WeeklyScheduleScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedYmd, setSelectedYmd] = useState(() => toDateOnly(new Date()));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const weekStart = useMemo(
    () => saturdayOfWeek(weekOffset),
    [weekOffset]
  );
  const weekDays = useMemo(
    () => weekDatesFromSaturday(weekStart),
    [weekStart]
  );
  const weekStartYmd = toDateOnly(weekStart);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWeekSessions(weekStartYmd));
    } finally {
      setLoading(false);
    }
  }, [weekStartYmd]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Keep selection inside the visible week (prefer today when in this week)
  useEffect(() => {
    const today = toDateOnly(new Date());
    const inWeek = weekDays.some((d) => toDateOnly(d) === today);
    if (inWeek) {
      setSelectedYmd(today);
      return;
    }
    setSelectedYmd(toDateOnly(weekDays[0]));
  }, [weekStartYmd]); // eslint-disable-line react-hooks/exhaustive-deps -- weekDays derived

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of rows) {
      const key = dateKeyOf(r.starts_at);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [rows]);

  const selectedSessions = sessionsByDate[selectedYmd] ?? [];
  const todayYmd = toDateOnly(new Date());

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
      >
        <TourAnchor id="scheduleHeader">
          <Title>{t("weeklySchedule")}</Title>
        </TourAnchor>

        {/* Week navigator */}
        <View style={styles.weekNav}>
          <Pressable
            onPress={() => setWeekOffset((o) => o - 1)}
            hitSlop={12}
            accessibilityLabel={t("prevWeek")}
            style={styles.navBtn}
          >
            <FontAwesome name="chevron-right" size={16} color={colors.primary} />
          </Pressable>
          <Text style={styles.weekRange}>{formatWeekRangeAr(weekStart)}</Text>
          <Pressable
            onPress={() => setWeekOffset((o) => o + 1)}
            hitSlop={12}
            accessibilityLabel={t("nextWeek")}
            style={styles.navBtn}
          >
            <FontAwesome name="chevron-left" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {/* Day strip: Arabic letter + date */}
        <View style={styles.dayStrip}>
          {weekDays.map((d, i) => {
            const ymd = toDateOnly(d);
            const wd = DAY_ORDER[i];
            const selected = ymd === selectedYmd;
            const hasSessions = (sessionsByDate[ymd]?.length ?? 0) > 0;
            const isToday = ymd === todayYmd;
            return (
              <Pressable
                key={ymd}
                onPress={() => setSelectedYmd(ymd)}
                style={styles.dayCol}
              >
                <Text
                  style={[
                    styles.dayLetter,
                    selected && styles.dayLetterOn,
                    isToday && !selected && styles.dayLetterToday,
                  ]}
                >
                  {dayLetter(wd)}
                </Text>
                <View
                  style={[
                    styles.dayNumWrap,
                    selected && styles.dayNumWrapOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      selected && styles.dayNumOn,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                {hasSessions ? (
                  <View
                    style={[
                      styles.dot,
                      selected && styles.dotOn,
                    ]}
                  />
                ) : (
                  <View style={styles.dotSpacer} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>
          {selectedYmd === todayYmd
            ? t("todaySchedule")
            : (() => {
                const d = weekdayOf(`${selectedYmd}T12:00:00`);
                const full: Record<Weekday, string> = {
                  0: t("sun"),
                  1: t("mon"),
                  2: t("tue"),
                  3: t("wed"),
                  4: t("thu"),
                  5: t("fri"),
                  6: t("sat"),
                };
                return full[d];
              })()}
        </Text>

        {selectedSessions.length === 0 ? (
          <EmptyState message={t("noSessions")} />
        ) : (
          <View style={styles.sessionList}>
            {selectedSessions.map((s) => {
              const accent = groupAccentColor(s.group_id, s.accent_color);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/attendance/${s.id}`)}
                  style={[styles.sessionCard, { borderColor: accent }]}
                >
                  <Text style={styles.sessionTime}>{timeOf(s.starts_at)}</Text>
                  <View style={styles.sessionBody}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {s.group_name}
                    </Text>
                    <Text style={styles.sessionMeta} numberOfLines={1}>
                      {t("markAttendance")}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekNav: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  weekRange: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 15,
    color: colors.text,
  },
  dayStrip: {
    ...rtlRow(),
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  dayCol: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  dayLetter: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  dayLetterOn: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontWeight: "700",
  },
  dayLetterToday: {
    color: colors.primary,
  },
  dayNumWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumWrapOn: {
    backgroundColor: colors.primary,
  },
  dayNum: {
    fontSize: 14,
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
  },
  dayNumOn: {
    color: "#fff",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  dotOn: {
    backgroundColor: colors.accent,
  },
  dotSpacer: {
    width: 5,
    height: 5,
  },
  sectionLabel: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionCard: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  sessionTime: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 14,
    color: colors.primary,
    minWidth: 52,
    textAlign: "center",
  },
  sessionBody: {
    flex: 1,
  },
  sessionTitle: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 15,
    color: colors.text,
  },
  sessionMeta: {
    ...rtlText,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
