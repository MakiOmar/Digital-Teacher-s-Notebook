import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  EmptyState,
  LoadingBlock,
  Muted,
} from "@/src/components/ui";
import { ScreenWithFixedActions } from "@/src/components/ScreenWithFixedActions";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { RoundPaymentCard } from "@/src/components/RoundPaymentCard";
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
  formatRoundRange,
  formatRoundTitle,
  todayDateOnly,
} from "@/src/utils/date";
import { colors, radii, spacing } from "@/src/theme/colors";
import { rtlBlock, rtlRow, rtlText } from "@/src/theme/rtl";
import { fonts } from "@/src/theme/typography";
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
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPayDraft, setBulkPayDraft] = useState<PaymentMethod>("cash");
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
    setBulkPayDraft("cash");
    setBulkPayOpen(true);
  }

  async function confirmBulkPay(method: PaymentMethod) {
    const targets = rows.filter((r) => r.status !== "paid");
    if (!targets.length || selectedRound == null) return;
    setBulkPayOpen(false);
    setBulkBusy(true);
    try {
      for (const row of targets) {
        await markPaid(row, method, true);
      }
      bump();
      await reloadRows(selectedRound);
      dialog.toast(t("switchedPaid"), "success");
    } catch (e) {
      dialog.toast(e instanceof Error ? e.message : t("error"), "error");
    } finally {
      setBulkBusy(false);
    }
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
          const busy = bulkBusy || busyStudentId === item.student_id;
          return (
            <RoundPaymentCard
              item={item}
              method={methodFor(item.student_id)}
              busy={busy}
              onTogglePaid={(v) => onToggle(item, v)}
              onChangeMethod={(next) =>
                setMethodsByStudent((prev) => ({
                  ...prev,
                  [item.student_id]: next,
                }))
              }
            />
          );
        }}
      />

      {/* Comment: bulk pay picks method here instead of a permanent top chip row. */}
      <Modal
        visible={bulkPayOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkPayOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBulkPayOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("bulkPayMethodTitle")}</Text>
            <Muted style={{ marginBottom: spacing.md }}>
              {t("markAllPaidConfirm")}
            </Muted>
            <View style={[styles.modalOptions, rtlBlock]}>
              {METHODS.map((m) => {
                const on = bulkPayDraft === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setBulkPayDraft(m.key)}
                    style={[styles.modalOption, on && styles.modalOptionOn]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        on && styles.modalOptionTextOn,
                      ]}
                    >
                      {m.label}
                    </Text>
                    {on ? (
                      <FontAwesome
                        name="check"
                        size={14}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.modalActions, rtlRow()]}>
              <Pressable
                onPress={() => setBulkPayOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmBulkPay(bulkPayDraft)}
                style={styles.modalApply}
                disabled={bulkBusy}
              >
                <Text style={styles.modalApplyText}>{t("applyFilter")}</Text>
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
    gap: 6,
  },
  roundBanner: {
    marginTop: 4,
    gap: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...rtlText,
    width: "100%",
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalOptions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalOption: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  modalOptionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modalOptionText: {
    ...rtlText,
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  modalOptionTextOn: {
    color: colors.primary,
  },
  modalActions: {
    width: "100%",
    gap: spacing.sm,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  modalApply: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  modalApplyText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: "#fff",
    fontSize: 15,
  },
});
