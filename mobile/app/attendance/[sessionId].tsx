import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
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
import { DateField, TimeField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import {
  getSession,
  getGroup,
  listActiveStudentsInGroup,
  listAttendanceForSession,
  upsertAttendance,
  upsertAttendanceBatch,
  upsertHomeworkDone,
  upsertHomeworkBatch,
  updateSessionStatus,
  updateSessionNotes,
  setSessionStarStudent,
} from "@/src/repositories";
import {
  cancelGroupSession,
  rescheduleGroupSession,
  restoreGroupSession,
  sessionDateAndTime,
} from "@/src/services/sessions";
import { shareLessonPerformanceWhatsApp } from "@/src/services/performanceShare";
import type {
  AttendanceStatus,
  GroupSession,
  Student,
} from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { sessionStatusLabel } from "@/src/components/SessionClassButton";
import { colors, radii, spacing } from "@/src/theme/colors";
import { rtlBlock, rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { attendanceStatusLabel } from "@/src/utils/statusLabels";
import { userFacingErrorMessage } from "@/src/utils/errors";

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

type SessionTab = "attendance" | "homework";

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
  const [homeworkMap, setHomeworkMap] = useState<Record<number, boolean>>({});
  const [tab, setTab] = useState<SessionTab>("attendance");
  const [starId, setStarId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

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
      const hw: Record<number, boolean> = {};
      for (const a of att) {
        next[a.student_id] = a.status;
        hw[a.student_id] = Boolean(a.homework_done);
      }
      setMap(next);
      setHomeworkMap(hw);
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

  const setHomework = useCallback(
    async (studentId: number, done: boolean) => {
      setHomeworkMap((prev) => ({ ...prev, [studentId]: done }));
      await upsertHomeworkDone({
        session_id: id,
        student_id: studentId,
        homework_done: done,
      });
      bump();
    },
    [bump, id]
  );

  const setAllHomework = useCallback(
    async (done: boolean) => {
      const next: Record<number, boolean> = { ...homeworkMap };
      for (const student of students) next[student.id] = done;
      setHomeworkMap(next);
      await upsertHomeworkBatch(
        id,
        students.map((s) => s.id),
        done
      );
      bump();
    },
    [bump, homeworkMap, id, students]
  );

  const shareLessonForStudent = useCallback(
    async (student: Student) => {
      if (!session) return;
      try {
        const result = await shareLessonPerformanceWhatsApp({
          student,
          groupName,
          startsAt: session.starts_at,
          attendance: map[student.id] ?? null,
          homeworkDone:
            homeworkMap[student.id] == null ? null : homeworkMap[student.id],
          isStar: starId === student.id,
          sessionNotes: notes,
        });
        if (!result.ok) {
          await dialog.alert({
            title: t("error"),
            message: t("shareNoPhone"),
          });
          return;
        }
        dialog.toast(t("success"), "success");
      } catch (e) {
        await dialog.alert({
          title: t("error"),
          message: userFacingErrorMessage(e),
        });
      }
    },
    [dialog, groupName, homeworkMap, map, notes, session, starId]
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

  const onMarkAllHomeworkDone = useCallback(() => {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllHomeworkDone"),
        message: t("markAllHomeworkDoneConfirm"),
      });
      if (ok) await setAllHomework(true);
    })();
  }, [dialog, setAllHomework]);

  const onMarkAllHomeworkNotDone = useCallback(() => {
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllHomeworkNotDone"),
        message: t("markAllHomeworkNotDoneConfirm"),
        danger: true,
      });
      if (ok) await setAllHomework(false);
    })();
  }, [dialog, setAllHomework]);

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
        message: t("cancelSessionConfirm"),
        confirmLabel: t("cancelSession"),
        danger: true,
      });
      if (!ok) return;
      try {
        await cancelGroupSession(id);
        dialog.toast(t("sessionCancelled"), "success");
        bump();
        await load();
      } catch (e) {
        await dialog.alert({
          title: t("error"),
          message: userFacingErrorMessage(e),
        });
      }
    })();
  }, [bump, dialog, id, load]);

  const onRestoreSession = useCallback(() => {
    void (async () => {
      try {
        await restoreGroupSession(id);
        dialog.toast(t("sessionRestored"), "success");
        bump();
        await load();
      } catch (e) {
        await dialog.alert({
          title: t("error"),
          message: userFacingErrorMessage(e),
        });
      }
    })();
  }, [bump, dialog, id, load]);

  const openReschedule = useCallback(() => {
    if (!session) return;
    const { date, time } = sessionDateAndTime(session);
    setRescheduleDate(date);
    setRescheduleTime(time);
    setRescheduleOpen(true);
  }, [session]);

  const onSaveReschedule = useCallback(() => {
    void (async () => {
      if (!rescheduleDate || !rescheduleTime) {
        await dialog.alert({
          title: t("error"),
          message: t("rescheduleSessionHint"),
        });
        return;
      }
      setRescheduleBusy(true);
      try {
        await rescheduleGroupSession(id, rescheduleDate, rescheduleTime);
        setRescheduleOpen(false);
        dialog.toast(t("rescheduleSessionSaved"), "success");
        bump();
        await load();
      } catch (e) {
        await dialog.alert({
          title: t("error"),
          message: userFacingErrorMessage(e),
        });
      } finally {
        setRescheduleBusy(false);
      }
    })();
  }, [bump, dialog, id, load, rescheduleDate, rescheduleTime]);

  const sessionActions = useMemo<IconAction[]>(() => {
    if (cancelled) {
      return [
        {
          key: "restore",
          icon: "undo",
          label: t("restoreSession"),
          tone: "accent",
          onPress: onRestoreSession,
        },
        {
          key: "reschedule",
          icon: "calendar",
          label: t("rescheduleSession"),
          onPress: openReschedule,
        },
      ];
    }

    const bulkActions: IconAction[] =
      tab === "homework"
        ? [
            {
              key: "hw-done",
              icon: "check",
              label: t("actionHomeworkDone"),
              tone: "accent",
              onPress: onMarkAllHomeworkDone,
            },
            {
              key: "hw-not",
              icon: "times",
              label: t("actionHomeworkNotDone"),
              onPress: onMarkAllHomeworkNotDone,
            },
          ]
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
          ];

    return [
      ...bulkActions,
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
              key: "reschedule",
              icon: "calendar" as const,
              label: t("rescheduleSession"),
              onPress: openReschedule,
            },
            {
              key: "cancel",
              icon: "ban" as const,
              label: t("cancel"),
              tone: "danger" as const,
              onPress: onCancelSession,
            },
          ]
        : []),
    ];
  }, [
    allAttendanceSet,
    cancelled,
    completed,
    onCancelSession,
    onCompleteSession,
    onMarkAllAbsent,
    onMarkAllHomeworkDone,
    onMarkAllHomeworkNotDone,
    onMarkAllPresent,
    onReopenSession,
    onRestoreSession,
    openReschedule,
    tab,
  ]);

  const renderItem = useCallback<ListRenderItem<Student>>(
    ({ item }) => {
      const current = map[item.id];
      const hwDone = homeworkMap[item.id] === true;
      const isStar = starId === item.id;
      return (
        <View
          style={[
            styles.card,
            isStar && { borderColor: colors.star, borderWidth: 2 },
          ]}
        >
          <View style={[styles.nameRow, rtlRow()]}>
            <Text style={styles.name}>
              {isStar ? "★ " : ""}
              {item.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("shareLesson")}
              hitSlop={8}
              onPress={() => void shareLessonForStudent(item)}
              style={styles.shareBtn}
            >
              <Text style={styles.shareBtnText}>{t("shareLesson")}</Text>
            </Pressable>
          </View>

          {tab === "attendance" ? (
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
          ) : (
            <View style={styles.row}>
              {(
                [
                  { done: true, label: t("homeworkDone") },
                  { done: false, label: t("homeworkNotDone") },
                ] as const
              ).map((opt) => {
                const selected = homeworkMap[item.id] === opt.done;
                return (
                  <Pressable
                    key={String(opt.done)}
                    onPress={() => void setHomework(item.id, opt.done)}
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
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {tab === "attendance" && hwDone ? (
            <Text style={styles.homeworkHint}>✓ {t("homeworkDone")}</Text>
          ) : null}
        </View>
      );
    },
    [
      cancelled,
      homeworkMap,
      map,
      setHomework,
      setStatus,
      shareLessonForStudent,
      starId,
      tab,
    ]
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

        <Pressable onPress={onPickStar} style={styles.starBox} disabled={cancelled}>
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

        {/* Attendance / Homework tabs — each has its own bulk actions in the bar. */}
        <View style={[styles.tabs, rtlRow()]}>
          {(
            [
              { id: "attendance" as const, label: t("tabAttendance") },
              { id: "homework" as const, label: t("tabHomework") },
            ] as const
          ).map((item) => {
            const on = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tabChip, on && styles.tabChipOn]}
              >
                <Text style={[styles.tabChipText, on && styles.tabChipTextOn]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Comment: section label so the per-student list is obvious below. */}
        <Text style={styles.studentsHeading}>
          {tab === "homework" ? t("homework") : t("markAttendance")}
        </Text>
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
    tab,
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

      {/* Comment: reschedule keeps the previous duration; only start date/time change. */}
      <Modal
        visible={rescheduleOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setRescheduleOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("rescheduleSession")}</Text>
            <Muted style={{ marginBottom: spacing.md }}>
              {t("rescheduleSessionHint")}
            </Muted>
            <View style={rtlBlock}>
              <DateField
                label={t("date")}
                value={rescheduleDate}
                onChange={setRescheduleDate}
              />
              <TimeField
                label={t("sessionStartTime")}
                value={rescheduleTime}
                onChange={setRescheduleTime}
              />
            </View>
            <View style={[styles.modalActions, rtlRow()]}>
              <Pressable
                onPress={() => setRescheduleOpen(false)}
                style={styles.modalCancel}
                disabled={rescheduleBusy}
              >
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void onSaveReschedule()}
                style={styles.modalApply}
                disabled={rescheduleBusy}
              >
                <Text style={styles.modalApplyText}>
                  {rescheduleBusy ? t("loading") : t("save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  nameRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  name: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontWeight: "700",
    color: colors.text,
  },
  shareBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: "#25D366",
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
  homeworkHint: {
    ...rtlText,
    marginTop: 6,
    fontSize: 12,
    color: colors.success,
    fontWeight: "600",
  },
  tabs: {
    gap: 8,
    marginTop: spacing.sm,
  },
  tabChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    ...rtlText,
    fontWeight: "700",
    color: colors.text,
  },
  tabChipTextOn: {
    color: "#fff",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...rtlText,
    width: "100%",
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    ...rtlText,
    color: colors.text,
    fontWeight: "700",
  },
  modalApply: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  modalApplyText: {
    ...rtlText,
    color: "#fff",
    fontWeight: "800",
  },
});
