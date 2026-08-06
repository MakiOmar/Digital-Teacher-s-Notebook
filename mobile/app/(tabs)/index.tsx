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
  MenuCard,
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
import { loadAutoBackupSettings } from "@/src/backup/autoBackup";
import { formatDateTimeAr, formatMoney } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { ICONS } from "@/src/theme/icons";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import { TourAnchor } from "@/src/tour/TourAnchor";

const LOGO = require("../../assets/images/logo.webp");

/** Welcome line under logo/profile: waving hand + tutor name. */
function WelcomeRow({ name }: { name: string }) {
  if (!name.trim()) return null;
  return (
    <View style={styles.welcomeRow}>
      <Text style={styles.welcomeWave}>👋</Text>
      <Text style={styles.welcomeText} numberOfLines={1}>
        {t("homeWelcome")} {name.trim()}
      </Text>
    </View>
  );
}

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
  const [lastBackupLabel, setLastBackupLabel] = useState(t("autoBackupNever"));
  const [totalRemaining, setTotalRemaining] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [upcoming, today, groups, backup] = await Promise.all([
        listUpcomingSessions(1),
        listTodaysSessions(),
        listGroups(),
        loadAutoBackupSettings(),
      ]);
      setNextSession(upcoming[0] ?? null);
      setTodayCount(today.length);
      setGroupCount(groups.length);
      setLastBackupLabel(
        backup.lastRunAt
          ? formatDateTimeAr(backup.lastRunAt)
          : t("autoBackupNever")
      );
      // Payment summary can be heavy after a large import — load after shell paints
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
            <View style={styles.profileCol}>
              <View style={styles.profileRing}>
                <Image source={profileSource} style={styles.profile} />
              </View>
            </View>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
        </TourAnchor>
        <WelcomeRow name={tutorName} />
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
            <View style={styles.profileCol}>
              <View style={styles.profileRing}>
                <Image source={profileSource} style={styles.profile} />
              </View>
            </View>
            <View style={styles.logoCol}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Muted>{activeYear.name}</Muted>
            </View>
          </View>
        </TourAnchor>
        <WelcomeRow name={tutorName} />

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
            <Muted style={{ marginBottom: spacing.md }}>
              {t("snapshotLastBackup")}: {lastBackupLabel}
            </Muted>

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
              <View style={styles.qaHalf}>
                <MenuCard
                  title={t("qaStudents")}
                  icon={ICONS.students}
                  borderColor="#8B5CF6"
                  onPress={() => router.push("/students" as never)}
                />
              </View>
              <View style={styles.qaHalf}>
                <MenuCard
                  title={t("qaWeeklySchedule")}
                  icon={ICONS.schedule}
                  borderColor={colors.primary}
                  onPress={() => router.push("/schedule" as never)}
                />
              </View>
              <View style={styles.qaHalf}>
                <MenuCard
                  title={t("qaUnpaid")}
                  subtitle={
                    unpaidCount
                      ? `${unpaidCount} · ${formatMoney(totalRemaining)}`
                      : undefined
                  }
                  icon={ICONS.payments}
                  borderColor={colors.danger}
                  onPress={() => router.push("/payments" as never)}
                />
              </View>
              <View style={styles.qaHalf}>
                <MenuCard
                  title={t("qaAddGroup")}
                  icon={ICONS.groups}
                  borderColor="#14B8A6"
                  onPress={() => router.push("/groups/form")}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  logoCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  logo: {
    width: "100%",
    height: 92,
    backgroundColor: "transparent",
  },
  profileCol: {
    alignItems: "center",
    maxWidth: 96,
  },
  profileRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
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
  welcomeRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  welcomeWave: { fontSize: 22 },
  welcomeText: {
    ...rtlText,
    flexShrink: 1,
    fontSize: 18,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    color: colors.text,
  },
  snapRow: {
    ...rtlRow(),
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.sm,
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
    gap: 0,
  },
  qaHalf: {
    width: "100%",
  },
});
