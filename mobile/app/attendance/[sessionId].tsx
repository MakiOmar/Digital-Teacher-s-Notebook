import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import {
  FormField,
  LoadingBlock,
  Muted,
} from "@/src/components/ui";
import { ScreenWithFixedActions } from "@/src/components/ScreenWithFixedActions";
import { IconActionBar } from "@/src/components/IconActionBar";
import type { IconAction } from "@/src/components/IconActionBar";
import { DetailCard } from "@/src/components/DetailCard";
import { t } from "@/src/i18n/ar";
import {
  getSession,
  getGroup,
  listActiveStudentsInGroup,
  listAttendanceForSession,
  upsertAttendance,
  upsertAttendanceBatch,
  updateSessionStatus,
  updateSessionNotes,
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
import { useDialog } from "@/src/components/DialogProvider";
import { attendanceStatusLabel } from "@/src/utils/statusLabels";

const STATUSES: { key: AttendanceStatus; label: string }[] = [
  { key: "present", label: attendanceStatusLabel("present") },
  {
    key: "absent_excused",
    label: attendanceStatusLabel("absent_excused"),
  },
  {
    key: "absent_unexcused",
    label: attendanceStatusLabel("absent_unexcused"),
  },
];

export default function AttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Number(sessionId);
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<GroupSession | null>(null);
  const [groupName, setGroupName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [map, setMap] = useState<Record<number, AttendanceStatus>>({});
  const [starId, setStarId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerTitle: groupName || t("attendance"),
    });
  }, [navigation, groupName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSession(id);
      setSession(s);
      if (!s) return;
      setStarId(s.star_student_id ?? null);
      setNotes(s.notes ?? "");
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

  const setStatus = useCallback(
    async (studentId: number, status: AttendanceStatus) => {
      setMap((prev) => ({ ...prev, [studentId]: status }));
      await upsertAttendance({
        session_id: id,
        student_id: studentId,
        status,
      });
      bump();
    },
    [bump, id]
  );

  const setAllStatus = useCallback(
    async (status: AttendanceStatus) => {
      const next: Record<number, AttendanceStatus> = { ...map };
      for (const student of students) next[student.id] = status;
      setMap(next);
      await upsertAttendanceBatch(
        id,
        students.map((student) => student.id),
        status
      );
      bump();
    },
    [bump, id, map, students]
  );

  const pickStar = useCallback(
    async (studentId: number | null) => {
      setStarId(studentId);
      await setSessionStarStudent(id, studentId);
      bump();
    },
    [bump, id]
  );

  const onPickStar = useCallback(() => {
    void (async () => {
      const choice = await dialog.pick({
        title: t("pickStarStudent"),
        options: [
          ...students.map((s) => ({ id: String(s.id), label: s.name })),
          { id: "clear", label: t("clearStar"), destructive: true },
        ],
      });
      if (choice == null) return;
      if (choice === "clear") {
        await pickStar(null);
        return;
      }
      await pickStar(Number(choice));
    })();
  }, [dialog, pickStar, students]);

  const onMarkAllPresent = useCallback(() => {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllPresent"),
        message: t("markAllPresentConfirm"),
      });
      if (ok) await setAllStatus("present");
    })();
  }, [dialog, setAllStatus]);

  const onMarkAllAbsent = useCallback(() => {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllAbsent"),
        message: t("markAllAbsentConfirm"),
        danger: true,
      });
      if (ok) await setAllStatus("absent_unexcused");
    })();
  }, [dialog, setAllStatus]);

  const onCompleteSession = useCallback(() => {
    void (async () => {
      if (!allAttendanceSet) {
        await dialog.alert({
          title: t("error"),
          message: t("completeSessionBlocked"),
        });
        return;
      }
      const ok = await dialog.confirm({
        title: t("completeSession"),
        message: t("completeSessionConfirm"),
      });
      if (!ok) return;
      await updateSessionStatus(id, "completed");
      bump();
      await load();
    })();
  }, [allAttendanceSet, bump, dialog, id, load]);

  const onReopenSession = useCallback(() => {
    void updateSessionStatus(id, "scheduled").then(() => {
      bump();
      void load();
    });
  }, [bump, id, load]);

  const cancelled = session?.status === "cancelled";
  const completed = session?.status === "completed";

  const onCancelSession = useCallback(() => {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("cancelSession"),
        message: t("deleteConfirm"),
        confirmLabel: t("confirm"),
        danger: true,
      });
      if (!ok) return;
      await updateSessionStatus(id, "cancelled");
      bump();
      await load();
    })();
  }, [bump, dialog, id, load]);

  const sessionActions = useMemo<IconAction[]>(
    () =>
      cancelled
        ? []
        : [
            {
              key: "present",
              icon: "check",
              label: t("actionPresent"),
              tone: "accent",
              onPress: onMarkAllPresent,
            },
            {
              key: "absent",
              icon: "times",
              label: t("actionAbsent"),
              onPress: onMarkAllAbsent,
            },
            completed
              ? {
                  key: "reopen",
                  icon: "undo",
                  label: t("actionReopen"),
                  onPress: onReopenSession,
                }
              : {
                  key: "complete",
                  icon: "flag-checkered",
                  label: t("actionComplete"),
                  disabled: !allAttendanceSet,
                  onPress: onCompleteSession,
                },
            ...(!completed
              ? [
                  {
                    key: "cancel",
                    icon: "ban" as const,
                    label: t("cancel"),
                    tone: "danger" as const,
                    onPress: onCancelSession,
                  },
                ]
              : []),
          ],
    [
      allAttendanceSet,
      cancelled,
      completed,
      onCancelSession,
      onCompleteSession,
      onMarkAllAbsent,
      onMarkAllPresent,
      onReopenSession,
    ]
  );

  const renderItem = useCallback<ListRenderItem<Student>>(
    ({ item }) => {
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
          {/* Per-student attendance: حاضر / غياب بعذر / غياب بدون عذر */}
          <View style={styles.row}>
            {STATUSES.map((status) => {
              const selected = current === status.key;
              return (
                <Pressable
                  key={status.key}
                  onPress={() => void setStatus(item.id, status.key)}
                  disabled={cancelled}
                  style={[
                    styles.chip,
                    selected && styles.chipOn,
                    cancelled && { opacity: 0.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextOn,
                    ]}
                  >
                    {status.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    },
    [cancelled, map, setStatus, starId]
  );

  const listHeader = useMemo(() => {
    if (!session) return null;
    return (
      <View style={styles.listHeader}>
        <DetailCard
          title={formatDateTimeAr(session.starts_at)}
          borderColor={colors.border}
          details={[
            {
              icon: "info-circle",
              label: t("status"),
              value: sessionStatusLabel(session.status),
            },
            {
              icon: "check-square-o",
              label: t("markAttendance"),
              value: `${markedCount}/${students.length}`,
            },
          ]}
        />

        <Pressable onPress={onPickStar} style={styles.starBox}>
          <Text style={styles.starLabel}>{t("starOfClass")}</Text>
          <Text style={styles.starValue} numberOfLines={1}>
            {starStudent ? `★ ${starStudent.name}` : t("pickStarStudent")}
          </Text>
        </Pressable>

        <FormField
          label={t("sessionNotes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("sessionNotesHint")}
          multiline
        />
        <IconActionBar
          actions={[
            {
              key: "save-notes",
              icon: "save",
              label: t("save"),
              tone: "accent",
              onPress: () => {
                void (async () => {
                  await updateSessionNotes(id, notes.trim() || null);
                  dialog.toast(t("success"), "success");
                  bump();
                })();
              },
            },
          ]}
        />

        {/* Comment: section label so the per-student list is obvious below. */}
        <Text style={styles.studentsHeading}>{t("markAttendance")}</Text>
        {cancelled ? <Muted>{t("sessionCancelled")}</Muted> : null}
      </View>
    );
  }, [
    session,
    markedCount,
    students.length,
    onPickStar,
    starStudent,
    notes,
    id,
    dialog,
    bump,
    cancelled,
  ]);

  if (loading || !session) {
    return (
      <ScreenWithFixedActions actions={[]}>
        <LoadingBlock />
      </ScreenWithFixedActions>
    );
  }

  return (
    <ScreenWithFixedActions actions={sessionActions}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
          flexGrow: 1,
        }}
        data={students}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        renderItem={renderItem}
      />
    </ScreenWithFixedActions>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  studentsHeading: {
    ...rtlText,
    width: "100%",
    marginTop: spacing.sm,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  starBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.star,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  starLabel: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  starValue: {
    ...rtlText,
    width: "100%",
    fontWeight: "800",
    fontSize: 14,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
