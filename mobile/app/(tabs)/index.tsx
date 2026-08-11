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
import { LanguageSwitcher } from "@/src/components/LanguageSwitcher";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import {
  listGroups,
  listTodaysSessions,
  listUpcomingSessions,
} from "@/src/repositories";
import { formatDateTimeAr, formatMoney, formatInteger } from "@/src/utils/date";
import type { GroupSession } from "@/src/db/types";
import { colors, groupAccentColor, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { ICONS } from "@/src/theme/icons";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import { TourAnchor } from "@/src/tour/TourAnchor";

/** Soft cap so the home header stays compact next to the language switcher. */
const HOME_NAME_MAX = 18;

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

function displayHomeName(raw: string): string {
  const name = raw.trim();
  if (name.length <= HOME_NAME_MAX) return name;
  return `${name.slice(0, HOME_NAME_MAX).trimEnd()}…`;
}

/** Profile + welcome (+ optional year chip) grouped for the home header. */
function ProfileWelcome({
  name,
  yearName,
  profileSource,
  onPressProfile,
  arabic,
}: {
  name: string;
  yearName?: string | null;
  profileSource: ReturnType<typeof useTutorProfile>["profileSource"];
  onPressProfile: () => void;
  /** Arabic → avatar on the trailing / physical right of the cluster. */
  arabic: boolean;
}) {
  const shownName = displayHomeName(name);

  const avatar = (
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
  );

  const welcome = (
    <View
      style={[
        styles.welcomeCol,
        arabic ? styles.welcomeColAr : styles.welcomeColEn,
      ]}
    >
      {shownName ? (
        // One text run so 👋 always sits immediately before the name
        <Text
          style={styles.welcomeText}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {t("homeWelcome")} 👋 {shownName}
        </Text>
      ) : null}
      {yearName ? (
        <View style={styles.yearChip}>
          <Text style={styles.yearChipText} numberOfLines={1}>
            {yearName}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.profileWelcome,
        arabic ? styles.profileWelcomeAr : styles.profileWelcomeEn,
      ]}
    >
      {/*
        Header cluster is direction:ltr (physical left→right).
        Arabic: text then avatar → avatar on the trailing right.
        English: avatar then text.
      */}
      {arabic ? (
        <>
          {welcome}
          {avatar}
        </>
      ) : (
        <>
          {avatar}
          {welcome}
        </>
      )}
    </View>
  );
}

/** Language pill + profile; sides flip by preferred language. */
function HomeHeader({
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
  const { language } = useLanguage();
  const arabic = language === "ar";
  const switcher = <LanguageSwitcher variant="pill" />;
  const profile = (
    <ProfileWelcome
      name={name}
      yearName={yearName}
      profileSource={profileSource}
      onPressProfile={onPressProfile}
      arabic={arabic}
    />
  );

  return (
    <View style={styles.header}>
      {/*
        Header uses direction:ltr so child order maps to physical sides
        even when I18nManager.forceRTL is on (Yoga would otherwise pack row from the right).
        Arabic: switcher left, profile right. English: profile left, switcher right.
      */}
      {arabic ? (
        <>
          {switcher}
          {profile}
        </>
      ) : (
        <>
          {profile}
          {switcher}
        </>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { activeYear } = useAppData();
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

  // Focus + pull-to-refresh only — do not reload heavy dues on every global bump().
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!activeYear) {
    return (
      <Screen safeTop>
        <TourAnchor id="homeHeader">
          <HomeHeader
            name={tutorName}
            profileSource={profileSource}
            onPressProfile={() => router.push("/profile-edit" as never)}
          />
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
      <Screen safeTop padded={false} style={{ flex: 1 }}>
        <SkeletonList rows={6} />
      </Screen>
    );
  }

  return (
    <Screen safeTop padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <TourAnchor id="homeHeader">
          <HomeHeader
            name={tutorName}
            yearName={activeYear.name}
            profileSource={profileSource}
            onPressProfile={() => router.push("/profile-edit" as never)}
          />
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
                value={formatInteger(unpaidCount)}
              />
              <SnapshotChip
                label={t("snapshotToday")}
                value={formatInteger(todayCount)}
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
                      ? `${formatInteger(unpaidCount)} · ${formatMoney(totalRemaining)}`
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
                    <Text
                      style={styles.qaSub}
                      numberOfLines={1}
                      adjustsFontSizeToFit={false}
                      allowFontScaling={false}
                    >
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
  // Physical LTR: under forceRTL, plain `row` still packs from the right.
  header: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  profileWelcome: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  profileWelcomeEn: {
    justifyContent: "flex-start",
  },
  profileWelcomeAr: {
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
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    gap: 6,
  },
  welcomeColEn: {
    alignItems: "flex-start",
  },
  welcomeColAr: {
    alignItems: "flex-end",
  },
  welcomeText: {
    ...rtlText,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    color: colors.text,
  },
  yearChip: {
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
    fontSize: 22,
    lineHeight: 28,
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
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    // Keep well above qaLabel (12) — was ~10 and illegible on the dues tile.
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    marginTop: 6,
    width: "100%",
  },
});
