import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Muted,
} from "@/src/components/ui";
import { ScreenWithFixedActions } from "@/src/components/ScreenWithFixedActions";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { t } from "@/src/i18n/ar";
import {
  createPayment,
  deletePaymentsForBillingRound,
  getGroup,
  getRoundStar,
} from "@/src/repositories";
import {
  getGroupDuesForRoundNumber,
  getGroupRoundSummaries,
  type GroupRoundSummary,
} from "@/src/services/rounds";
import type { PaymentMethod, StudentDueRow } from "@/src/db/types";
import {
  formatMoney,
  formatRoundRange,
  formatRoundTitle,
  todayDateOnly,
} from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { MonthStarTitle } from "@/src/components/MonthStarTitle";
import { useDialog } from "@/src/components/DialogProvider";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";

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
  const { pageSize } = useGeneralSettings();
  const dialog = useDialog();

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
  const initialRoundReloadRef = useRef<number | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: groupName || t("roundPayments"),
    });
  }, [navigation, groupName]);

  const selectedSummary = useMemo(
    () => roundSummaries.find((r) => r.round_number === selectedRound) ?? null,
    [roundSummaries, selectedRound]
  );

  const paging = useClientPagination(
    rows,
    pageSize,
    `${groupId}:${selectedRound ?? 0}`
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

  const roundOptions = useMemo(
    () =>
      roundSummaries.map((s) => ({
        value: String(s.round_number),
        label: formatRoundTitle(
          s.round_number,
          s.started_at,
          s.closed_at,
          t("roundUntilOngoing")
        ),
      })),
    [roundSummaries]
  );

  const monthFilterFields = useMemo(
    () => [
      {
        key: "round",
        label: t("selectMonth"),
        value: selectedRound != null ? String(selectedRound) : "",
        options: roundOptions,
      },
    ],
    [roundOptions, selectedRound]
  );

  const reloadRows = useCallback(
    async (round: number) => {
      setRows(await getGroupDuesForRoundNumber(groupId, round));
      const star = await getRoundStar(groupId, round);
      setMonthStarName(star?.student_name ?? null);
    },
    [groupId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, summaries] = await Promise.all([
        getGroup(groupId),
        getGroupRoundSummaries(groupId),
      ]);
      setGroupName(g?.name ?? "");
      setRoundSummaries(summaries);
      const round = summaries[0]?.round_number ?? null;
      initialRoundReloadRef.current = round;
      setSelectedRound(round);
      if (round != null) {
        await reloadRows(round);
      } else {
        setRows([]);
        setMonthStarName(null);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, reloadRows]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (selectedRound == null) return;
    if (initialRoundReloadRef.current === selectedRound) {
      initialRoundReloadRef.current = null;
      return;
    }
    initialRoundReloadRef.current = null;
    void reloadRows(selectedRound);
  }, [reloadRows, selectedRound]);

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
        dialog.toast(e instanceof Error ? e.message : t("error"), "error");
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
        dialog.toast(e instanceof Error ? e.message : t("error"), "error");
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

    void (async () => {
      const ok = await dialog.confirm({
        title: t("roundPayments"),
        message: t("markUnpaidConfirm"),
        confirmLabel: t("unpaid"),
        danger: true,
      });
      if (ok) await markUnpaid(row);
    })();
  }

  function onMarkAllPaid() {
    const targets = rows.filter((r) => r.status !== "paid");
    if (!targets.length || selectedRound == null) return;
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllPaid"),
        message: t("markAllPaidConfirm"),
      });
      if (!ok) return;
      setBulkBusy(true);
      try {
        for (const row of targets) {
          await markPaid(row, bulkMethod, true);
        }
        bump();
        await reloadRows(selectedRound);
        dialog.toast(t("switchedPaid"), "success");
      } catch (e) {
        dialog.toast(e instanceof Error ? e.message : t("error"), "error");
      } finally {
        setBulkBusy(false);
      }
    })();
  }

  function onMarkAllUnpaid() {
    const targets = rows.filter((r) => r.paid > 0);
    if (!targets.length || selectedRound == null) return;
    void (async () => {
      const ok = await dialog.confirm({
        title: t("markAllUnpaid"),
        message: t("markAllUnpaidConfirm"),
        confirmLabel: t("unpaid"),
        danger: true,
      });
      if (!ok) return;
      setBulkBusy(true);
      try {
        for (const row of targets) {
          await markUnpaid(row, true);
        }
        bump();
        await reloadRows(selectedRound);
        dialog.toast(t("switchedUnpaid"), "success");
      } catch (e) {
        dialog.toast(e instanceof Error ? e.message : t("error"), "error");
      } finally {
        setBulkBusy(false);
      }
    })();
  }

  if (loading) {
    return (
      <ScreenWithFixedActions actions={[]}>
        <LoadingBlock />
      </ScreenWithFixedActions>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Comment: pick month in Apply modal, then show that month’s results. */}
      {!roundSummaries.length ? (
        <Muted>{t("noRoundsYet")}</Muted>
      ) : (
        <FiltersSheet
          triggerLabel={t("selectRound")}
          title={t("selectMonth")}
          icon="calendar"
          showBadge={false}
          fields={monthFilterFields}
          onApply={(values) => {
            const next = Number(values.round);
            if (!Number.isFinite(next)) return;
            setSelectedRound(next);
          }}
        />
      )}

      {selectedSummary ? (
        <View style={styles.roundBanner}>
          <MonthStarTitle title={roundHeading} starName={monthStarName} />
          <Muted>
            {formatRoundRange(
              selectedSummary.started_at,
              selectedSummary.closed_at,
              t("roundUntilOngoing")
            )}
          </Muted>
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
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenWithFixedActions
      actions={
        rows.length
          ? [
              {
                key: "paid",
                icon: "check-circle",
                label: t("actionPaidAll"),
                tone: "accent",
                disabled: bulkBusy,
                onPress: onMarkAllPaid,
              },
              {
                key: "unpaid",
                icon: "times-circle",
                label: t("actionUnpaidAll"),
                tone: "danger",
                disabled: bulkBusy,
                onPress: onMarkAllUnpaid,
              },
            ]
          : []
      }
    >
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
          flexGrow: 1,
        }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.round_id ?? item.student_id)}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyState message={t("noStudentsInGroup")} />}
        ListFooterComponent={
          <PaginationBar {...pagingBarProps(paging)} />
        }
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
    </ScreenWithFixedActions>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  roundBanner: {
    marginTop: 4,
    gap: 4,
  },
  bulkRow: {
    marginTop: 4,
    gap: 6,
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
