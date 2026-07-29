import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  LoadingBlock,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import {
  getSession,
  getGroup,
  listActiveStudentsInGroup,
  listAttendanceForSession,
  upsertAttendance,
  updateSessionStatus,
  setSessionStarStudent,
} from "@/src/repositories";
import type {
  AttendanceStatus,
  GroupSession,
  Student,
} from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { colors, radii, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";

const STATUSES: { key: AttendanceStatus; label: string }[] = [
  { key: "present", label: t("present") },
  { key: "absent_excused", label: t("absentExcused") },
  { key: "absent_unexcused", label: t("absentUnexcused") },
];

export default function AttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const { bump } = useAppData();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GroupSession | null>(null);
  const [groupName, setGroupName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [map, setMap] = useState<Record<number, AttendanceStatus>>({});
  const [starId, setStarId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSession(id);
      setSession(s);
      if (!s) return;
      setStarId(s.star_student_id ?? null);
      const g = await getGroup(s.group_id);
      setGroupName(g?.name ?? "");
      const list = await listActiveStudentsInGroup(s.group_id);
      setStudents(list);
      const att = await listAttendanceForSession(id);
      const next: Record<number, AttendanceStatus> = {};
      for (const a of att) next[a.student_id] = a.status;
      setMap(next);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const allAttendanceSet = useMemo(() => {
    if (!students.length) return false;
    return students.every((s) => map[s.id] != null);
  }, [students, map]);

  const markedCount = useMemo(
    () => students.filter((s) => map[s.id] != null).length,
    [students, map]
  );

  const starStudent = useMemo(
    () => students.find((s) => s.id === starId) ?? null,
    [students, starId]
  );

  async function setStatus(studentId: number, status: AttendanceStatus) {
    setMap((prev) => ({ ...prev, [studentId]: status }));
    await upsertAttendance({
      session_id: id,
      student_id: studentId,
      status,
    });
    bump();
  }

  async function setAllStatus(status: AttendanceStatus) {
    const next: Record<number, AttendanceStatus> = { ...map };
    for (const s of students) {
      next[s.id] = status;
      await upsertAttendance({
        session_id: id,
        student_id: s.id,
        status,
      });
    }
    setMap(next);
    bump();
  }

  async function pickStar(studentId: number | null) {
    setStarId(studentId);
    await setSessionStarStudent(id, studentId);
    bump();
  }

  function onPickStar() {
    const options = [
      ...students.map((s) => ({
        text: s.name,
        onPress: () => void pickStar(s.id),
      })),
      {
        text: t("clearStar"),
        style: "destructive" as const,
        onPress: () => void pickStar(null),
      },
      { text: t("cancel"), style: "cancel" as const },
    ];
    Alert.alert(t("pickStarStudent"), undefined, options);
  }

  function onMarkAllPresent() {
    Alert.alert(t("markAllPresent"), t("markAllPresentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => void setAllStatus("present"),
      },
    ]);
  }

  function onMarkAllAbsent() {
    Alert.alert(t("markAllAbsent"), t("markAllAbsentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: () => void setAllStatus("absent_unexcused"),
      },
    ]);
  }

  function onCompleteSession() {
    if (!allAttendanceSet) {
      Alert.alert(t("error"), t("completeSessionBlocked"));
      return;
    }
    Alert.alert(t("completeSession"), t("completeSessionConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => {
          void updateSessionStatus(id, "completed").then(() => {
            bump();
            void load();
          });
        },
      },
    ]);
  }

  function onReopenSession() {
    void updateSessionStatus(id, "scheduled").then(() => {
      bump();
      void load();
    });
  }

  if (loading || !session) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  const cancelled = session.status === "cancelled";
  const completed = session.status === "completed";

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, gap: 10 }}>
        <Title>{groupName}</Title>
        <Muted>{formatDateTimeAr(session.starts_at)}</Muted>
        <Muted>
          {sessionStatusLabel(session.status)} · {markedCount}/{students.length}
        </Muted>

        <Pressable onPress={onPickStar} style={styles.starBox}>
          <Text style={styles.starLabel}>{t("starOfClass")}</Text>
          <Text style={styles.starValue}>
            {starStudent ? `★ ${starStudent.name}` : t("pickStarStudent")}
          </Text>
        </Pressable>
        <View style={styles.starChips}>
          {students.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => void pickStar(starId === s.id ? null : s.id)}
              style={[
                styles.starChip,
                starId === s.id && styles.starChipOn,
              ]}
            >
              <Text
                style={[
                  styles.starChipText,
                  starId === s.id && styles.starChipTextOn,
                ]}
              >
                {starId === s.id ? "★ " : ""}
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {!cancelled ? (
          <>
            <PrimaryButton
              label={t("markAllPresent")}
              onPress={onMarkAllPresent}
            />
            <PrimaryButton
              label={t("markAllAbsent")}
              variant="ghost"
              onPress={onMarkAllAbsent}
            />
            {completed ? (
              <PrimaryButton
                label={t("reopenSession")}
                variant="ghost"
                onPress={onReopenSession}
              />
            ) : (
              <PrimaryButton
                label={t("completeSession")}
                onPress={onCompleteSession}
                disabled={!allAttendanceSet}
              />
            )}
            {!completed ? (
              <PrimaryButton
                label={t("cancelSession")}
                variant="danger"
                onPress={() => {
                  Alert.alert(t("cancelSession"), t("deleteConfirm"), [
                    { text: t("cancel"), style: "cancel" },
                    {
                      text: t("confirm"),
                      style: "destructive",
                      onPress: () => {
                        void updateSessionStatus(id, "cancelled").then(() => {
                          bump();
                          void load();
                        });
                      },
                    },
                  ]);
                }}
              />
            ) : null}
          </>
        ) : (
          <Muted>{t("sessionCancelled")}</Muted>
        )}
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={students}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const current = map[item.id];
          const isStar = starId === item.id;
          return (
            <View
              style={[
                styles.card,
                isStar && { borderColor: colors.star, borderWidth: 2 },
              ]}
            >
              <Text style={styles.name}>
                {isStar ? "★ " : ""}
                {item.name}
              </Text>
              <View style={styles.row}>
                {STATUSES.map((s) => {
                  const selected = current === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => void setStatus(item.id, s.key)}
                      style={[styles.chip, selected && styles.chipOn]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextOn,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  starBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.star,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  starLabel: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 4,
  },
  starValue: {
    ...rtlText,
    width: "100%",
    fontWeight: "800",
    fontSize: 16,
    color: colors.text,
  },
  starChips: {
    ...rtlChipRow(),
    gap: 6,
    marginBottom: spacing.sm,
  },
  starChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  starChipOn: {
    borderColor: colors.star,
    backgroundColor: "#FEF9C3",
  },
  starChipText: {
    ...rtlText,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  starChipTextOn: {
    color: colors.text,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  name: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    marginBottom: 8,
    color: colors.text,
  },
  row: { ...rtlChipRow(), gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    ...rtlText,
  },
  chipTextOn: { color: "#fff" },
});
