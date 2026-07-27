import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Card,
  ListRow,
  LoadingBlock,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import {
  getGroup,
  getSessionAttendanceCoverage,
  listPatterns,
  listSessionsForGroup,
  softDeleteGroup,
} from "@/src/repositories";
import type {
  GroupSession,
  SchedulePattern,
  StudentDueRow,
  StudyGroup,
} from "@/src/db/types";
import { WEEKDAY_LABELS, formatMoney, formatRoundTitle } from "@/src/utils/date";
import { generateSessionsForGroup } from "@/src/services/schedule";
import { getRoundDues } from "@/src/services/rounds";
import { SessionClassButton } from "@/src/components/SessionClassButton";
import { useAppData } from "@/src/contexts/AppDataContext";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";

function statusLabel(status: StudentDueRow["status"]): string {
  if (status === "paid") return t("paid");
  if (status === "partial") return t("partial");
  return t("unpaid");
}

function chunkSessionsByRound(
  sessions: GroupSession[],
  classesPerRound: number
): { roundNumber: number; sessions: GroupSession[] }[] {
  const per = Math.max(1, classesPerRound || 4);
  const active = sessions.filter((s) => s.status !== "cancelled");
  const chunks: { roundNumber: number; sessions: GroupSession[] }[] = [];
  for (let i = 0; i < active.length; i += per) {
    chunks.push({
      roundNumber: Math.floor(i / per) + 1,
      sessions: active.slice(i, i + per),
    });
  }
  return chunks;
}

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const router = useRouter();
  const { bump } = useAppData();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [patterns, setPatterns] = useState<SchedulePattern[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [dues, setDues] = useState<StudentDueRow[]>([]);
  const [coverage, setCoverage] = useState<
    Record<number, { marked: number; total: number }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroup(await getGroup(groupId));
      setPatterns(await listPatterns(groupId));
      setSessions(await listSessionsForGroup(groupId));
      setDues(await getRoundDues(groupId));
      setCoverage(await getSessionAttendanceCoverage(groupId));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const sessionRounds = useMemo(() => {
    return chunkSessionsByRound(sessions, group?.classes_per_round ?? 4);
  }, [sessions, group?.classes_per_round]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onGenerate() {
    Alert.alert(t("generateSchedule"), t("regenerateConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => {
          void (async () => {
            try {
              const result = await generateSessionsForGroup(groupId);
              Alert.alert(
                t("success"),
                `تم إنشاء ${result.created} حصة (موجود مسبقاً: ${result.skippedExisting})`
              );
              bump();
              await load();
            } catch (e) {
              Alert.alert(
                t("error"),
                e instanceof Error ? e.message : t("error")
              );
            }
          })();
        },
      },
    ]);
  }

  if (loading || !group) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      >
        {/* Group header */}
        <Title>{group.name}</Title>
        <Muted>{group.subject || "—"}</Muted>
        <Card>
          <Text style={styles.cardLine}>
            {t("defaultFee")}: {formatMoney(group.default_monthly_fee)}
          </Text>
          <Text style={styles.cardLine}>
            {t("classesPerRound")}: {group.classes_per_round ?? 4}
          </Text>
          <Muted>
            {patterns
              .map(
                (p) =>
                  `${WEEKDAY_LABELS[p.weekday]} ${p.start_time}-${p.end_time}`
              )
              .join(" · ") || "—"}
          </Muted>
        </Card>

        <View style={{ gap: 10, marginBottom: spacing.md }}>
          <PrimaryButton
            label={t("addStudentsToGroup")}
            onPress={() =>
              router.push(`/groups/add-students?groupId=${groupId}` as never)
            }
          />
          <PrimaryButton
            label={t("roundPayments")}
            onPress={() =>
              router.push(
                `/groups/round-payments?groupId=${groupId}` as never
              )
            }
          />
          <PrimaryButton
            label={t("edit")}
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/groups/form",
                params: { id: String(groupId) },
              })
            }
          />
          {!sessions.length ? (
            <PrimaryButton
              label={t("needScheduleFirst")}
              variant="ghost"
              onPress={() => void onGenerate()}
            />
          ) : null}
          <PrimaryButton
            label={t("delete")}
            variant="danger"
            onPress={() => {
              Alert.alert(t("delete"), t("deleteConfirm"), [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("delete"),
                  style: "destructive",
                  onPress: () => {
                    void softDeleteGroup(groupId).then(() => {
                      bump();
                      router.back();
                    });
                  },
                },
              ]);
            }}
          />
        </View>

        {/* Open-round status per student */}
        <Title>{t("groupStudents")}</Title>
        {!dues.length ? (
          <Muted style={{ marginBottom: spacing.md }}>{t("noStudents")}</Muted>
        ) : (
          dues.map((d) => (
            <ListRow
              key={d.student_id}
              title={d.student_name}
              subtitle={`${
                d.round_number != null
                  ? formatRoundTitle(
                      d.round_number,
                      d.started_at,
                      d.closed_at,
                      t("roundUntilOngoing")
                    )
                  : t("currentRound")
              } · ${t("remainingClasses")}: ${d.remaining_classes ?? 0}/${d.target_classes ?? 0} · ${statusLabel(d.status)} · ${formatMoney(d.paid)}/${formatMoney(d.due)}`}
              right={formatMoney(d.remaining)}
              onPress={() => router.push(`/students/${d.student_id}`)}
            />
          ))
        )}

        <Title>{t("sessions")}</Title>
        {!sessionRounds.length ? (
          <Muted>{t("noSessions")}</Muted>
        ) : (
          sessionRounds.map((chunk) => {
            const per = group?.classes_per_round ?? 4;
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
            return (
              <View key={chunk.roundNumber} style={styles.roundBlock}>
                <View style={styles.divider} />
                <Text style={styles.roundTitle}>{title}</Text>
                <View style={styles.divider} />
                {chunk.sessions.map((s) => (
                  <SessionClassButton
                    key={s.id}
                    session={s}
                    coverage={coverage[s.id]}
                    onPress={() => router.push(`/attendance/${s.id}`)}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardLine: {
    ...rtlText,
    width: "100%",
    color: colors.text,
    marginBottom: 4,
  },
  roundBlock: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  roundTitle: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: "100%",
  },
});
