import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  LoadingBlock,
  Muted,
  Title,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { ScreenWithFixedActions } from "@/src/components/ScreenWithFixedActions";
import { t } from "@/src/i18n/ar";
import {
  getGroup,
  getSessionAttendanceCoverage,
  listPatterns,
  listSessionsForGroup,
  softDeleteGroup,
  listRoundStarsForGroup,
} from "@/src/repositories";
import type {
  GroupSession,
  SchedulePattern,
  StudentDueRow,
  StudyGroup,
} from "@/src/db/types";
import {
  WEEKDAY_LABELS,
  formatDateAr,
  formatMoney,
  formatRoundTitle,
} from "@/src/utils/date";
import { generateSessionsForGroup } from "@/src/services/schedule";
import { getRoundDues } from "@/src/services/rounds";
import { SessionClassButton } from "@/src/components/SessionClassButton";
import { MonthStarTitle } from "@/src/components/MonthStarTitle";
import { useDialog } from "@/src/components/DialogProvider";
import { useAppData } from "@/src/contexts/AppDataContext";
import { colors, spacing } from "@/src/theme/colors";
import {
  paymentStatusBorderColor,
  paymentStatusLabel,
} from "@/src/utils/statusLabels";

type ListRowItem =
  | { kind: "meta" }
  | { kind: "studentsTitle" }
  | { kind: "studentEmpty" }
  | { kind: "student"; due: StudentDueRow }
  | { kind: "sessionsTitle" }
  | { kind: "sessionsEmpty" }
  | {
      kind: "roundHeader";
      roundNumber: number;
      title: string;
      starName?: string;
    }
  | { kind: "session"; session: GroupSession };

function chunkSessionsByRound(
  sessions: GroupSession[],
  classesPerRound: number
): { roundNumber: number; sessions: GroupSession[] }[] {
  const per = Math.max(1, classesPerRound || 4);
  const active = sessions.filter((s) => s.status !== "cancelled");
  const out: { roundNumber: number; sessions: GroupSession[] }[] = [];
  for (let i = 0; i < active.length; i += per) {
    out.push({
      roundNumber: Math.floor(i / per) + 1,
      sessions: active.slice(i, i + per),
    });
  }
  return out;
}

const StudentDueRowItem = memo(function StudentDueRowItem({
  due,
  onPress,
}: {
  due: StudentDueRow;
  onPress: (id: number) => void;
}) {
  const borderColor = paymentStatusBorderColor(due.status);
  const roundTitle =
    due.round_number != null
      ? formatRoundTitle(
          due.round_number,
          due.started_at,
          due.closed_at,
          t("roundUntilOngoing")
        )
      : t("currentRound");

  return (
    <DetailCard
      title={due.student_name}
      right={formatMoney(due.remaining)}
      badge={{
        label: paymentStatusLabel(due.status),
        color: borderColor,
        backgroundColor:
          due.status === "paid"
            ? colors.paid
            : due.status === "partial"
              ? colors.partial
              : colors.unpaid,
      }}
      details={[
        {
          icon: "calendar",
          label: t("selectMonth"),
          value: roundTitle,
        },
        {
          icon: "clock-o",
          label: t("remainingClasses"),
          value: `${due.remaining_classes ?? 0}/${due.target_classes ?? 0}`,
        },
        {
          icon: "money",
          label: t("payments"),
          value: `${formatMoney(due.paid)} / ${formatMoney(due.due)}`,
        },
      ]}
      borderColor={borderColor}
      onPress={() => onPress(due.student_id)}
    />
  );
});

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [patterns, setPatterns] = useState<SchedulePattern[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [dues, setDues] = useState<StudentDueRow[]>([]);
  const [coverage, setCoverage] = useState<
    Record<number, { marked: number; total: number }>
  >({});
  const [roundStars, setRoundStars] = useState<
    Record<number, { student_id: number; student_name: string }>
  >({});

  useEffect(() => {
    navigation.setOptions({
      headerTitle: group?.name || t("groups"),
    });
  }, [navigation, group?.name]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroup(await getGroup(groupId));
      setPatterns(await listPatterns(groupId));
      setSessions(await listSessionsForGroup(groupId));
      setDues(await getRoundDues(groupId));
      setCoverage(await getSessionAttendanceCoverage(groupId));
      setRoundStars(await listRoundStarsForGroup(groupId));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const sessionRounds = useMemo(() => {
    return chunkSessionsByRound(sessions, group?.classes_per_round ?? 4);
  }, [sessions, group?.classes_per_round]);

  const listData = useMemo((): ListRowItem[] => {
    const rows: ListRowItem[] = [{ kind: "meta" }, { kind: "studentsTitle" }];
    if (!dues.length) {
      rows.push({ kind: "studentEmpty" });
    } else {
      for (const due of dues) {
        rows.push({ kind: "student", due });
      }
    }
    rows.push({ kind: "sessionsTitle" });
    if (!sessionRounds.length) {
      rows.push({ kind: "sessionsEmpty" });
    } else {
      const per = group?.classes_per_round ?? 4;
      for (const chunk of sessionRounds) {
        const start = chunk.sessions[0]?.starts_at;
        const end =
          chunk.sessions.length >= per
            ? chunk.sessions[chunk.sessions.length - 1]?.starts_at
            : null;
        const title = formatRoundTitle(
          chunk.roundNumber,
          start,
          end,
          t("roundUntilOngoing")
        );
        rows.push({
          kind: "roundHeader",
          roundNumber: chunk.roundNumber,
          title,
          starName: roundStars[chunk.roundNumber]?.student_name,
        });
        for (const s of chunk.sessions) {
          rows.push({ kind: "session", session: s });
        }
      }
    }
    return rows;
  }, [dues, sessionRounds, group?.classes_per_round, roundStars]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onStudentPress = useCallback(
    (studentId: number) => {
      router.push(`/students/${studentId}`);
    },
    [router]
  );

  const onSessionPress = useCallback(
    (sessionId: number) => {
      router.push(`/attendance/${sessionId}`);
    },
    [router]
  );

  async function onGenerate() {
    const ok = await dialog.confirm({
      title: t("generateSchedule"),
      message: t("regenerateConfirm"),
    });
    if (!ok) return;
    try {
      const result = await generateSessionsForGroup(groupId);
      dialog.toast(
        `تم إنشاء ${result.created} حصة (موجود مسبقاً: ${result.skippedExisting})`,
        "success"
      );
      bump();
      await load();
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: e instanceof Error ? e.message : t("error"),
      });
    }
  }

  async function onDeleteGroup() {
    const ok = await dialog.confirm({
      title: t("delete"),
      message: t("deleteConfirm"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    await softDeleteGroup(groupId);
    bump();
    router.back();
  }

  const renderItem = useCallback(
    ({ item }: { item: ListRowItem }) => {
      if (item.kind === "meta") {
        if (!group) return null;
        const dateRangeLabel = group.start_date
          ? `${formatDateAr(group.start_date)}${
              group.end_date
                ? ` — ${formatDateAr(group.end_date)}`
                : ` — ${t("ongoing")}`
            }`
          : t("groupStartDateMissing");
        return (
          <DetailCard
            title={group.name}
            details={[
              {
                icon: "book",
                label: t("subject"),
                value: group.subject || "—",
              },
              {
                icon: "calendar",
                label: t("groupDateRange"),
                value: dateRangeLabel,
              },
              {
                icon: "money",
                label: t("defaultFee"),
                value: formatMoney(group.default_monthly_fee),
              },
              {
                icon: "clock-o",
                label: t("classesPerRound"),
                value: String(group.classes_per_round ?? 4),
              },
              {
                icon: "calendar-check-o",
                label: t("scheduleShort"),
                value:
                  patterns
                    .map(
                      (p) =>
                        `${WEEKDAY_LABELS[p.weekday]} ${p.start_time}-${p.end_time}`
                    )
                    .join("، ") || "—",
              },
            ]}
          />
        );
      }
      if (item.kind === "studentsTitle") {
        return <Title>{t("groupStudents")}</Title>;
      }
      if (item.kind === "studentEmpty") {
        return (
          <Muted style={{ marginBottom: spacing.md }}>{t("noStudents")}</Muted>
        );
      }
      if (item.kind === "student") {
        return (
          <StudentDueRowItem due={item.due} onPress={onStudentPress} />
        );
      }
      if (item.kind === "sessionsTitle") {
        return <Title>{t("sessions")}</Title>;
      }
      if (item.kind === "sessionsEmpty") {
        return <Muted>{t("noSessions")}</Muted>;
      }
      if (item.kind === "roundHeader") {
        return (
          <View style={styles.roundBlock}>
            <View style={styles.divider} />
            <MonthStarTitle title={item.title} starName={item.starName} />
            <View style={styles.divider} />
          </View>
        );
      }
      return (
        <SessionClassButton
          session={item.session}
          coverage={coverage[item.session.id]}
          onPress={() => onSessionPress(item.session.id)}
        />
      );
    },
    [group, patterns, coverage, onStudentPress, onSessionPress]
  );

  const keyExtractor = useCallback((item: ListRowItem, index: number) => {
    switch (item.kind) {
      case "meta":
        return "meta";
      case "studentsTitle":
        return "studentsTitle";
      case "studentEmpty":
        return "studentEmpty";
      case "student":
        return `student-${item.due.student_id}`;
      case "sessionsTitle":
        return "sessionsTitle";
      case "sessionsEmpty":
        return "sessionsEmpty";
      case "roundHeader":
        return `round-${item.roundNumber}`;
      case "session":
        return `session-${item.session.id}`;
      default:
        return String(index);
    }
  }, []);

  if (loading || !group) {
    return (
      <ScreenWithFixedActions actions={[]}>
        <LoadingBlock />
      </ScreenWithFixedActions>
    );
  }

  return (
    <ScreenWithFixedActions
      actions={[
        {
          key: "students",
          icon: "user-plus",
          label: t("students"),
          tone: "accent",
          onPress: () =>
            router.push(`/groups/add-students?groupId=${groupId}` as never),
        },
        {
          key: "payments",
          icon: "money",
          label: t("payments"),
          onPress: () =>
            router.push(`/groups/round-payments?groupId=${groupId}` as never),
        },
        {
          key: "edit",
          icon: "pencil",
          label: t("edit"),
          onPress: () =>
            router.push({
              pathname: "/groups/form",
              params: { id: String(groupId) },
            }),
        },
        {
          key: "schedule",
          icon: "calendar",
          label: t("scheduleShort"),
          onPress: () => void onGenerate(),
        },
        {
          key: "delete",
          icon: "trash",
          label: t("delete"),
          tone: "danger",
          onPress: () => void onDeleteGroup(),
        },
      ]}
    >
      <FlatList
        style={{ flex: 1 }}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 40,
        }}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />
    </ScreenWithFixedActions>
  );
}

const styles = StyleSheet.create({
  roundBlock: {
    marginBottom: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: "100%",
    marginVertical: 4,
  },
});
