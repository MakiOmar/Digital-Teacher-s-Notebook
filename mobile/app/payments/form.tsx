import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  FormField,
  Screen,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { DateField } from "@/src/components/DateFields";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { t } from "@/src/i18n/ar";
import {
  createPayment,
  deletePayment,
  getActiveEnrollment,
  getPayment,
  listActiveStudentsInGroup,
  listGroups,
  updatePayment,
} from "@/src/repositories";
import { listPayableRoundsForStudent } from "@/src/services/rounds";
import type { PaymentMethod, Student, StudyGroup } from "@/src/db/types";
import { formatMoney, formatRoundTitle, todayDateOnly } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { userFacingErrorMessage } from "@/src/utils/errors";

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: t("cash") },
  { key: "transfer", label: t("transfer") },
  { key: "other", label: t("other") },
];

type PayableRound = Awaited<
  ReturnType<typeof listPayableRoundsForStudent>
>[number];

export default function PaymentFormScreen() {
  const {
    id,
    studentId: studentIdParam,
    groupId: groupIdParam,
  } = useLocalSearchParams<{
    id?: string;
    studentId?: string;
    groupId?: string;
  }>();
  const editId = id ? Number(id) : null;
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rounds, setRounds] = useState<PayableRound[]>([]);
  const [groupId, setGroupId] = useState<number | null>(
    groupIdParam ? Number(groupIdParam) : null
  );
  const [studentId, setStudentId] = useState<number | null>(
    studentIdParam ? Number(studentIdParam) : null
  );
  const [roundId, setRoundId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayDateOnly());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: editId ? t("edit") : t("addPayment"),
    });
  }, [editId, navigation]);

  useEffect(() => {
    void (async () => {
      setGroups(await listGroups());
      if (!editId) return;
      const p = await getPayment(editId);
      if (!p) return;
      setStudentId(p.student_id);
      setRoundId(p.billing_round_id);
      setGroupId(p.group_id);
      setAmount(String(p.amount));
      setPaidAt(p.paid_at);
      setMethod(p.method);
      setNote(p.note ?? "");
      if (!p.group_id) {
        const en = await getActiveEnrollment(p.student_id);
        if (en) setGroupId(en.group_id);
      }
    })();
  }, [editId]);

  // When opened with studentId only, resolve their group
  useEffect(() => {
    if (editId || groupId || !studentId) return;
    void (async () => {
      const en = await getActiveEnrollment(studentId);
      if (en) setGroupId(en.group_id);
    })();
  }, [editId, groupId, studentId]);

  useEffect(() => {
    if (!groupId || editId) return;
    void (async () => {
      const list = await listActiveStudentsInGroup(groupId);
      setStudents(list);
      setStudentId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return null;
      });
      setRounds([]);
      setRoundId(null);
    })();
  }, [groupId, editId]);

  useEffect(() => {
    if (!studentId || !groupId || editId) return;
    void (async () => {
      const list = (await listPayableRoundsForStudent(studentId)).filter(
        (r) => r.group_id === groupId
      );
      setRounds(list);
      const preferred =
        list.find((r) => r.status === "open") ?? list[0] ?? null;
      setRoundId(preferred?.id ?? null);
      if (preferred && preferred.remaining > 0) {
        setAmount(String(preferred.remaining));
      } else if (preferred) {
        setAmount(String(preferred.due));
      } else {
        setAmount("");
      }
    })();
  }, [studentId, groupId, editId]);

  function onSelectGroup(nextGroupId: number) {
    setGroupId(nextGroupId);
    setStudentId(null);
    setRoundId(null);
    setRounds([]);
    setAmount("");
  }

  const roundOptions = useMemo(
    () =>
      rounds.map((r) => ({
        value: String(r.id),
        label: `${formatRoundTitle(
          r.round_number,
          r.started_at,
          r.closed_at,
          t("roundUntilOngoing")
        )} · ${formatMoney(r.remaining)}${
          r.status === "closed" ? ` (${t("unpaid")})` : ""
        }`,
      })),
    [rounds]
  );

  const monthFilterFields = useMemo(
    () => [
      {
        key: "round",
        label: t("selectMonth"),
        value: roundId != null ? String(roundId) : "",
        options: roundOptions,
      },
    ],
    [roundId, roundOptions]
  );

  function onApplyRound(values: Record<string, string>) {
    const nextId = Number(values.round);
    if (!Number.isFinite(nextId)) return;
    const r = rounds.find((row) => row.id === nextId);
    setRoundId(nextId);
    if (!r) return;
    if (r.remaining > 0) setAmount(String(r.remaining));
    else setAmount(String(r.due));
  }

  async function onSave() {
    if (!studentId || (!editId && !roundId)) {
      await dialog.alert({ title: t("error"), message: t("required") });
      return;
    }
    const amountNum = Number(amount.replace(",", "."));
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      await dialog.alert({ title: t("error"), message: t("amount") });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updatePayment(editId, {
          amount: amountNum,
          paid_at: paidAt,
          method,
          note: note.trim() || null,
        });
      } else {
        const round = rounds.find((r) => r.id === roundId);
        await createPayment({
          student_id: studentId,
          billing_round_id: roundId!,
          group_id: round?.group_id ?? groupId,
          amount: amountNum,
          paid_at: paidAt,
          method,
          note: note.trim() || null,
        });
      }
      bump();
      router.back();
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <IconActionBar
            actions={[
              {
                key: "save",
                icon: "save",
                label: t("actionSave"),
                tone: "accent",
                disabled: saving,
                onPress: () => void onSave(),
              },
              ...(editId
                ? [
                    {
                      key: "delete",
                      icon: "trash" as const,
                      label: t("delete"),
                      tone: "danger" as const,
                      onPress: () => {
                        void (async () => {
                          const ok = await dialog.confirm({
                            title: t("delete"),
                            message: t("deleteConfirm"),
                            confirmLabel: t("delete"),
                            danger: true,
                          });
                          if (!ok) return;
                          await deletePayment(editId);
                          bump();
                          router.back();
                        })();
                      },
                    },
                  ]
                : []),
            ]}
          />
          {!editId ? (
            <>
              {/* Step 1: group */}
              <Text style={styles.label}>{t("selectGroup")}</Text>
              <View style={styles.wrap}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => onSelectGroup(g.id)}
                    style={[styles.chip, groupId === g.id && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        groupId === g.id && styles.chipTextOn,
                      ]}
                    >
                      {g.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Step 2: students of selected group */}
              <Text style={styles.label}>{t("students")}</Text>
              {!groupId ? (
                <Text style={styles.hint}>{t("selectGroup")}</Text>
              ) : !students.length ? (
                <Text style={styles.hint}>{t("noStudentsInGroup")}</Text>
              ) : (
                <View style={styles.wrap}>
                  {students.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setStudentId(s.id)}
                      style={[styles.chip, studentId === s.id && styles.chipOn]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          studentId === s.id && styles.chipTextOn,
                        ]}
                      >
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Step 3: month/round via Apply modal */}
              <Text style={styles.label}>{t("selectRound")}</Text>
              {!studentId ? (
                <Text style={styles.hint}>{t("required")}</Text>
              ) : !rounds.length ? (
                <Text style={styles.hint}>{t("noOpenRound")}</Text>
              ) : (
                <FiltersSheet
                  triggerLabel={t("selectRound")}
                  title={t("selectMonth")}
                  icon="calendar"
                  showBadge={false}
                  fields={monthFilterFields}
                  onApply={onApplyRound}
                />
              )}
            </>
          ) : null}

          <FormField
            label={t("amount")}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <DateField
            label={t("paidAt")}
            value={paidAt}
            onChange={setPaidAt}
          />

          <Text style={styles.label}>{t("method")}</Text>
          <View style={styles.wrap}>
            {METHODS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMethod(m.key)}
                style={[styles.chip, method === m.key && styles.chipOn]}
              >
                <Text
                  style={[
                    styles.chipText,
                    method === m.key && styles.chipTextOn,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <FormField
            label={t("notes")}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...rtlText,
    width: "100%",
    fontWeight: "600",
    marginBottom: 8,
    color: colors.text,
  },
  hint: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  wrap: {
    ...rtlChipRow(),
    gap: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    color: colors.text,
    fontWeight: "600",
    ...rtlText,
  },
  chipTextOn: { color: "#fff" },
});
