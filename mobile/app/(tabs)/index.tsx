import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  Muted,
  Screen,
  BorderedCard,
  SkeletonList,
} from "@/src/components/ui";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import {
  listGroups,
  listTodaysSessions,
  listUpcomingSessions,
} from "@/src/repositories";
import { formatDateTimeAr, formatMoney } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { ICONS } from "@/src/theme/icons";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import { TourAnchor } from "@/src/tour/TourAnchor";

const LOGO = require("../../assets/images/logo-mark.png");

function SnapshotChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapChip}>
      <Text style={styles.snapValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.snapLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Profile + welcome (+ optional year chip) grouped for the home header. */
function ProfileWelcome({
  name,
  yearName,
  profileSource,
  onPressProfile,
}: {
  name: string;
  yearName?: string | null;
  profileSource: ReturnType<typeof useTutorProfile>["profileSource"];
  onPressProfile: () => void;
}) {
  return (
    <View style={styles.profileWelcome}>
      {/* Tap avatar → profile settings */}
      <Pressable
        onPress={onPressProfile}
        accessibilityRole="button"
        accessibilityLabel={t("tutorProfile")}
        style={({ pressed }) => [
          styles.profileRing,
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Image source={profileSource} style={styles.profile} />
      </Pressable>
      <View style={styles.welcomeCol}>
        {name.trim() ? (
          <View style={styles.welcomeRow}>
            <Text style={styles.welcomeWave}>👋</Text>
            <Text style={styles.welcomeText} numberOfLines={1}>
              {t("homeWelcome")} {name.trim()}
            </Text>
          </View>
        ) : null}
        {yearName ? (
          <View style={styles.yearChip}>
            <Text style={styles.yearChipText} numberOfLines={1}>
              {yearName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { activeYear, revision } = useAppData();
  const { name: tutorName, profileSource } = useTutorProfile();
  const [loading, setLoading] = useState(true);
  const [nextSession, setNextSession] = useState<
    (GroupSession & { group_name: string; accent_color?: string | null }) | null
  >(null);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [upcoming, today, groups] = await Promise.all([
        listUpcomingSessions(1),
        listTodaysSessions(),
        listGroups(),
      ]);
      setNextSession(upcoming[0] ?? null);
      setTodayCount(today.length);
      setGroupCount(groups.length);
      try {
        const summary = await getOpenRoundsPaymentSummary();
        setUnpaidCount(summary.unpaidCount + summary.partialCount);
        setTotalRemaining(summary.totalRemaining);
      } catch {
        setUnpaidCount(0);
        setTotalRemaining(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, revision])
  );

  if (!activeYear) {
    return (
      <Screen>
        <TourAnchor id="homeHeader">
          <View style={styles.header}>
            {/* Logo physical left; profile cluster on the right */}
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <ProfileWelcome
              name={tutorName}
              profileSource={profileSource}
              onPressProfile={() => router.push("/profile-edit" as never)}
            />
          </View>
        </TourAnchor>
        <EmptyState
          message={t("noActiveYear")}
          actionLabel={t("createYearCta")}
          onAction={() => router.push("/years/form")}
          tourAnchorId="homeYearCta"
        />
      </Screen>
    );
  }

  if (loading && !nextSession && groupCount === 0) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList rows={6} />
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
        <TourAnchor id="homeHeader">
          <View style={styles.header}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <ProfileWelcome
              name={tutorName}
              yearName={activeYear.name}
              profileSource={profileSource}
              onPressProfile={() => router.push("/profile-edit" as never)}
            />
          </View>
        </TourAnchor>

        {groupCount === 0 ? (
          <EmptyState
            message={t("getStartedGroup")}
            actionLabel={t("addGroupCta")}
            onAction={() => router.push("/groups/form")}
          />
        ) : (
          <>
            <View style={styles.snapRow}>
              <SnapshotChip
                label={t("snapshotUnpaid")}
                value={String(unpaidCount)}
              />
              <SnapshotChip
                label={t("snapshotToday")}
                value={String(todayCount)}
              />
              <SnapshotChip
                label={t("remaining")}
                value={formatMoney(totalRemaining)}
              />
            </View>

            <Text style={styles.section}>{t("nextSession")}</Text>
            {!nextSession ? (
              <Muted>{t("noSessions")}</Muted>
            ) : (
              <Pressable
                onPress={() => router.push(`/attendance/${nextSession.id}`)}
              >
                <BorderedCard
                  borderColor={groupAccentColor(
                    nextSession.group_id,
                    nextSession.accent_color
                  )}
                >
                  <Text style={styles.sessionTitle}>
                    {nextSession.group_name}
                  </Text>
                  <Muted>{formatDateTimeAr(nextSession.starts_at)}</Muted>
                </BorderedCard>
              </Pressable>
            )}

            <Text style={styles.section}>{t("quickActions")}</Text>
            <View style={styles.qaGrid}>
              {(
                [
                  {
                    key: "students",
                    title: t("qaStudents"),
                    icon: ICONS.students,
                    border: "#8B5CF6",
                    onPress: () => router.push("/students" as never),
                  },
                  {
                    key: "schedule",
                    title: t("qaWeeklySchedule"),
                    icon: ICONS.schedule,
                    border: colors.primary,
                    onPress: () => router.push("/schedule" as never),
                  },
                  {
                    key: "unpaid",
                    title: t("qaUnpaid"),
                    icon: ICONS.payments,
                    border: colors.danger,
                    subtitle: unpaidCount
                      ? `${unpaidCount} · ${formatMoney(totalRemaining)}`
                      : undefined,
                    onPress: () => router.push("/payments" as never),
                  },
                  {
                    key: "group",
                    title: t("qaAddGroup"),
                    icon: ICONS.groups,
                    border: "#14B8A6",
                    onPress: () => router.push("/groups/form"),
                  },
                ] as const
              ).map((a) => (
                <Pressable
                  key={a.key}
                  onPress={a.onPress}
                  style={({ pressed }) => [
                    styles.qaCard,
                    { borderColor: a.border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Image source={a.icon} style={styles.qaIcon} />
                  <Text style={styles.qaLabel} numberOfLines={2}>
                    {a.title}
                  </Text>
                  {"subtitle" in a && a.subtitle ? (
                    <Text style={styles.qaSub} numberOfLines={1}>
                      {a.subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Physical LTR: logo left, profile/welcome right (requested).
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  logo: {
    width: 72,
    height: 72,
    backgroundColor: "transparent",
  },
  profileWelcome: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
  profileRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#000",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  profile: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  welcomeCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    gap: 6,
  },
  welcomeRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  welcomeWave: { fontSize: 18 },
  welcomeText: {
    ...rtlText,
    flexShrink: 1,
    fontSize: 16,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    color: colors.text,
  },
  yearChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  yearChipText: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 12,
    color: "#FFFFFF",
  },
  snapRow: {
    ...rtlRow(),
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  snapChip: {
    flexGrow: 1,
    minWidth: "30%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  snapValue: {
    ...rtlText,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 16,
    color: colors.text,
  },
  snapLabel: {
    ...rtlText,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  section: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sessionTitle: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
  qaGrid: {
    ...rtlRow(),
    flexWrap: "wrap",
    gap: 10,
  },
  qaCard: {
    width: "47%",
    flexGrow: 1,
    minWidth: "42%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  qaIcon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  qaLabel: {
    ...rtlText,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
  qaSub: {
    ...rtlText,
    textAlign: "center",
    fontSize: 10,
    color: colors.textMuted,
  },
});
