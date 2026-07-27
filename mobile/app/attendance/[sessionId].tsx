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
} from "@/src/repositories";
import type {
  AttendanceStatus,
  GroupSession,
  Student,
} from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { colors, spacing } from "@/src/theme/colors";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSession(id);
      setSession(s);
      if (!s) return;
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
          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
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
