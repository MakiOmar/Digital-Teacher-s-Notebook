import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Chip,
  EmptyState,
  LoadingBlock,
  Muted,
  PrimaryButton,
  Screen,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import {
  createPayment,
  deletePaymentsForBillingRound,
  getGroup,
  getRoundStar,
  listActiveStudentsInGroup,
  setRoundStar,
} from "@/src/repositories";
import {
  getGroupDuesForRoundNumber,
  getGroupRoundSummaries,
  type GroupRoundSummary,
} from "@/src/services/rounds";
import type { PaymentMethod, StudentDueRow } from "@/src/db/types";
import { formatMoney, formatRoundRange, formatRoundTitle, todayDateOnly } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { MonthStarTitle } from "@/src/components/MonthStarTitle";

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: t("cash") },
  { key: "transfer", label: t("transfer") },
  { key: "other", label: t("other") },
];

export default function GroupRoundPaymentsScreen() {
  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const navigation = useNavigation();
  const { bump } = useAppData();

  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [roundSummaries, setRoundSummaries] = useState<GroupRoundSummary[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [rows, setRows] = useState<StudentDueRow[]>([]);
  const [busyStudentId, setBusyStudentId] = useState<number | null>(null);
  const [methodsByStudent, setMethodsByStudent] = useState<
    Record<number, PaymentMethod>
  >({});
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>("cash");
  const [monthStarName, setMonthStarName] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerTitle: "" });
  }, [navigation]);

  const selectedSummary = useMemo(
    () => roundSummaries.find((r) => r.round_number === selectedRound) ?? null,
    [roundSummaries, selectedRound]
  );

  const roundHeading = useMemo(() => {
    if (!selectedSummary) return t("selectRound");
    return formatRoundTitle(
      selectedSummary.round_number,
      selectedSummary.started_at,
      selectedSummary.closed_at,
      t("roundUntilOngoing")
    );
  }, [selectedSummary]);

  const reloadRows = useCallback(
    async (round: number) => {
      setRows(await getGroupDuesForRoundNumber(groupId, round));
      const star = await getRoundStar(groupId, round);
      setMonthStarName(star?.student_name ?? null);
    },
    [groupId]
  );

  function pickMonthStar() {
    if (selectedRound == null) return;
    void (async () => {
      const students = await listActiveStudentsInGroup(groupId);
      Alert.alert(t("pickMonthStar"), undefined, [
        ...students.map((s) => ({
          text: s.name,
          onPress: () => {
            void setRoundStar(groupId, selectedRound, s.id).then(() => {
              bump();
              void reloadRows(selectedRound);
            });
          },
        })),
        {
          text: t("clearStar"),
          style: "destructive" as const,
          onPress: () => {
            void setRoundStar(groupId, selectedRound, null).then(() => {
              bump();
              void reloadRows(selectedRound);
            });
          },
        },
        { text: t("cancel"), style: "cancel" as const },
      ]);
    })();
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await getGroup(groupId);
      setGroupName(g?.name ?? "");
      const summaries = await getGroupRoundSummaries(groupId);
      setRoundSummaries(summaries);
      const round =
        selectedRound != null &&
        summaries.some((s) => s.round_number === selectedRound)
          ? selectedRound
          : summaries[0]?.round_number ?? null;
      setSelectedRound(round);
      if (round != null) {
        await reloadRows(round);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedRound, reloadRows]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function methodFor(studentId: number): PaymentMethod {
    return methodsByStudent[studentId] ?? "cash";
  }

  async function markPaid(
    row: StudentDueRow,
    method: PaymentMethod,
    silent = false
  ) {
    if (!row.round_id) return;
    const amount = row.remaining > 0 ? row.remaining : row.due;
    if (amount <= 0) return;
    if (!silent) setBusyStudentId(row.student_id);
    try {
      await createPayment({
        student_id: row.student_id,
        billing_round_id: row.round_id,
        group_id: groupId,
        amount,
        paid_at: todayDateOnly(),
        method,
        note: formatRoundTitle(
          row.round_number ?? 0,
          row.started_at,
          row.closed_at,
          t("roundUntilOngoing")
        ),
      });
      if (!silent && selectedRound != null) {
        bump();
        await reloadRows(selectedRound);
      }
    } catch (e) {
      if (!silent) {
        Alert.alert(t("error"), e instanceof Error ? e.message : t("error"));
      } else {
        throw e;
      }
    } finally {
      if (!silent) setBusyStudentId(null);
    }
  }

  async function markUnpaid(row: StudentDueRow, silent = false) {
    if (!row.round_id) return;
    if (!silent) setBusyStudentId(row.student_id);
    try {
      await deletePaymentsForBillingRound(row.round_id);
      if (!silent && selectedRound != null) {
        bump();
        await reloadRows(selectedRound);
      }
    } catch (e) {
      if (!silent) {
        Alert.alert(t("error"), e instanceof Error ? e.message : t("error"));
      } else {
        throw e;
      }
    } finally {
      if (!silent) setBusyStudentId(null);
    }
  }

  function onToggle(row: StudentDueRow, nextPaid: boolean) {
    const isPaid = row.status === "paid";
    if (nextPaid === isPaid) return;

    if (nextPaid) {
      void markPaid(row, methodFor(row.student_id));
      return;
    }

    Alert.alert(t("roundPayments"), t("markUnpaidConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("unpaid"),
        style: "destructive",
        onPress: () => void markUnpaid(row),
      },
    ]);
  }

  function onMarkAllPaid() {
    const targets = rows.filter((r) => r.status !== "paid");
    if (!targets.length || selectedRound == null) return;
    Alert.alert(t("markAllPaid"), t("markAllPaidConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: () => {
          void (async () => {
            setBulkBusy(true);
            try {
              for (const row of targets) {
                await markPaid(row, bulkMethod, true);
              }
              bump();
              await reloadRows(selectedRound);
            } catch (e) {
              Alert.alert(
                t("error"),
                e instanceof Error ? e.message : t("error")
              );
            } finally {
              setBulkBusy(false);
            }
          })();
        },
      },
    ]);
  }

  function onMarkAllUnpaid() {
    const targets = rows.filter((r) => r.paid > 0);
    if (!targets.length || selectedRound == null) return;
    Alert.alert(t("markAllUnpaid"), t("markAllUnpaidConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("unpaid"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBulkBusy(true);
            try {
              for (const row of targets) {
                await markUnpaid(row, true);
              }
              bump();
              await reloadRows(selectedRound);
            } catch (e) {
              Alert.alert(
                t("error"),
                e instanceof Error ? e.message : t("error")
              );
            } finally {
              setBulkBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{groupName}</Text>
        <Muted>{t("selectRound")}</Muted>
        {!roundSummaries.length ? (
          <Muted style={{ marginTop: 8 }}>{t("noRoundsYet")}</Muted>
        ) : (
          <View style={styles.rounds}>
            {roundSummaries.map((s) => (
              <Chip
                key={s.round_number}
                label={formatRoundTitle(
                  s.round_number,
                  s.started_at,
                  s.closed_at,
                  t("roundUntilOngoing")
                )}
                selected={selectedRound === s.round_number}
                onPress={() => setSelectedRound(s.round_number)}
              />
            ))}
          </View>
        )}

        {selectedSummary ? (
          <View style={styles.roundBanner}>
            <View style={styles.divider} />
            <MonthStarTitle
              title={roundHeading}
              starName={monthStarName}
              onPressStar={pickMonthStar}
            />
            <Muted>
              {t("roundRange")}:{" "}
              {formatRoundRange(
                selectedSummary.started_at,
                selectedSummary.closed_at,
                t("roundUntilOngoing")
              )}
            </Muted>
            <View style={styles.divider} />
          </View>
        ) : null}

        {rows.length ? (
          <View style={styles.bulkRow}>
            <Muted>{t("method")}</Muted>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setBulkMethod(m.key)}
                  style={[
                    styles.methodChip,
                    bulkMethod === m.key && styles.methodChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      bulkMethod === m.key && styles.methodTextOn,
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={t("markAllPaid")}
              onPress={onMarkAllPaid}
              disabled={bulkBusy}
            />
            <PrimaryButton
              label={t("markAllUnpaid")}
              variant="danger"
              onPress={onMarkAllUnpaid}
              disabled={bulkBusy}
            />
          </View>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={rows}
        keyExtractor={(item) => String(item.round_id ?? item.student_id)}
        ListEmptyComponent={<EmptyState message={t("noStudentsInGroup")} />}
        renderItem={({ item }) => {
          const isPaid = item.status === "paid";
          const busy = bulkBusy || busyStudentId === item.student_id;
          const method = methodFor(item.student_id);
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.student_name}</Text>
                  <Muted>
                    {formatMoney(item.paid)} / {formatMoney(item.due)}
                    {item.status === "partial" ? ` · ${t("partial")}` : ""}
                  </Muted>
                </View>
                <View style={styles.switchBlock}>
                  <Text style={[styles.switchLabel, isPaid && styles.paidLabel]}>
                    {isPaid ? t("paid") : t("unpaid")}
                  </Text>
                  <Switch
                    value={isPaid}
                    disabled={busy}
                    onValueChange={(v) => onToggle(item, v)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primarySoft,
                    }}
                    thumbColor={isPaid ? colors.primary : colors.textMuted}
                  />
                </View>
              </View>
              {!isPaid ? (
                <View style={styles.methodRow}>
                  {METHODS.map((m) => (
                    <Pressable
                      key={m.key}
                      onPress={() =>
                        setMethodsByStudent((prev) => ({
                          ...prev,
                          [item.student_id]: m.key,
                        }))
                      }
                      style={[
                        styles.methodChip,
                        method === m.key && styles.methodChipOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          method === m.key && styles.methodTextOn,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rounds: {
    ...rtlChipRow(),
    marginTop: spacing.sm,
  },
  roundBanner: {
    marginTop: spacing.md,
    gap: 6,
  },
  roundBannerTitle: {
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
    marginVertical: 4,
  },
  bulkRow: {
    marginTop: spacing.md,
    gap: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: {
    ...rtlRow(),
    alignItems: "center",
    gap: 12,
  },
  info: { flex: 1 },
  name: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  switchBlock: {
    alignItems: "center",
    gap: 4,
  },
  switchLabel: {
    ...rtlText,
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  paidLabel: {
    color: colors.success,
  },
  methodRow: {
    ...rtlChipRow(),
    gap: 6,
  },
  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  methodChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodText: {
    ...rtlText,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  methodTextOn: {
    color: "#fff",
  },
});
