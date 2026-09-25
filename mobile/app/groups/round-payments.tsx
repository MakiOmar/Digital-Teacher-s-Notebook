import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RoundPaymentCard } from "@/src/components/RoundPaymentCard";
import { RoundAccordion } from "@/src/components/RoundAccordion";
import { MonthStarTitle } from "@/src/components/MonthStarTitle";
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
  formatRoundTitle,
  todayDateOnly,
} from "@/src/utils/date";
import { radii, spacing, type AppColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlBlock, rtlRow, rtlText } from "@/src/theme/rtl";
import { fonts } from "@/src/theme/typography";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { userFacingErrorMessage } from "@/src/utils/errors";

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: t("cash") },
  { key: "transfer", label: t("transfer") },
  { key: "other", label: t("other") },
];

export default function GroupRoundPaymentsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();

  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [roundSummaries, setRoundSummaries] = useState<GroupRoundSummary[]>([]);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [rowsByRound, setRowsByRound] = useState<
    Record<number, StudentDueRow[]>
  >({});
  const [starByRound, setStarByRound] = useState<Record<number, string | null>>(
    {}
  );
  const [busyStudentId, setBusyStudentId] = useState<number | null>(null);
  const [methodsByStudent, setMethodsByStudent] = useState<
    Record<number, PaymentMethod>
  >({});
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPayDraft, setBulkPayDraft] = useState<PaymentMethod>("cash");

  useEffect(() => {
    navigation.setOptions({
      headerTitle: groupName || t("roundPayments"),
    });
  }, [navigation, groupName]);

  const expandedRows = useMemo(
    () => (expandedRound != null ? rowsByRound[expandedRound] ?? [] : []),
    [expandedRound, rowsByRound]
  );

  const reloadRound = useCallback(
    async (round: number) => {
      const [dues, star] = await Promise.all([
        getGroupDuesForRoundNumber(groupId, round),
        getRoundStar(groupId, round),
      ]);
      setRowsByRound((prev) => ({ ...prev, [round]: dues }));
      setStarByRound((prev) => ({
        ...prev,
        [round]: star?.student_name ?? null,
      }));
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
      const preferred =
        summaries.find((s) => s.has_open)?.round_number ??
        summaries[0]?.round_number ??
        null;
      setExpandedRound(preferred);
      setRowsByRound({});
      setStarByRound({});
      if (preferred != null) {
        await reloadRound(preferred);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, reloadRound]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function toggleRound(roundNumber: number) {
    if (expandedRound === roundNumber) {
      setExpandedRound(null);
      return;
    }
    setExpandedRound(roundNumber);
    if (!rowsByRound[roundNumber]) {
      await reloadRound(roundNumber);
    }
  }

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
      if (!silent && row.round_number != null) {
        bump();
        await reloadRound(row.round_number);
      }
    } catch (e) {
      if (!silent) {
        dialog.toast(userFacingErrorMessage(e), "error");
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
      if (!silent && row.round_number != null) {
        bump();
        await reloadRound(row.round_number);
      }
    } catch (e) {
      if (!silent) {
        dialog.toast(userFacingErrorMessage(e), "error");
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
    const targets = expandedRows.filter((r) => r.status !== "paid");
    if (!targets.length || expandedRound == null) return;
    setBulkPayDraft("cash");
    setBulkPayOpen(true);
  }

  async function confirmBulkPay(method: PaymentMethod) {
    const targets = expandedRows.filter((r) => r.status !== "paid");
    if (!targets.length || expandedRound == null) return;
    setBulkPayOpen(false);
    setBulkBusy(true);
    try {
      for (const row of targets) {
        await markPaid(row, method, true);
      }
      bump();
      await reloadRound(expandedRound);
      dialog.toast(t("switchedPaid"), "success");
    } catch (e) {
      dialog.toast(userFacingErrorMessage(e), "error");
    } finally {
      setBulkBusy(false);
    }
  }

  function onMarkAllUnpaid() {
    const targets = expandedRows.filter((r) => r.paid > 0);
    if (!targets.length || expandedRound == null) return;
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
        await reloadRound(expandedRound);
        dialog.toast(t("switchedUnpaid"), "success");
      } catch (e) {
        dialog.toast(userFacingErrorMessage(e), "error");
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

  return (
    <ScreenWithFixedActions
      actions={
        expandedRows.length
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
          paddingTop: spacing.md,
          paddingBottom: 40,
          flexGrow: 1,
        }}
        data={roundSummaries}
        keyExtractor={(item) => String(item.round_number)}
        ListEmptyComponent={<EmptyState message={t("noRoundsYet")} />}
        renderItem={({ item: summary }) => {
          const open = expandedRound === summary.round_number;
          const rows = rowsByRound[summary.round_number] ?? [];
          const starName = starByRound[summary.round_number];
          return (
            <RoundAccordion
              roundNumber={summary.round_number}
              startedAt={summary.started_at}
              closedAt={summary.closed_at}
              expanded={open}
              onToggle={() => void toggleRound(summary.round_number)}
            >
              <MonthStarTitle starName={starName} />
              {!rows.length ? (
                <Muted>{t("noStudentsInGroup")}</Muted>
              ) : (
                rows.map((row) => {
                  const busy =
                    bulkBusy || busyStudentId === row.student_id;
                  return (
                    <RoundPaymentCard
                      key={String(row.round_id ?? row.student_id)}
                      item={row}
                      method={methodFor(row.student_id)}
                      busy={busy}
                      onTogglePaid={(v) => onToggle(row, v)}
                      onChangeMethod={(next) =>
                        setMethodsByStudent((prev) => ({
                          ...prev,
                          [row.student_id]: next,
                        }))
                      }
                    />
                  );
                })
              )}
            </RoundAccordion>
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
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
    alignItems: "stretch",
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: colors.border,
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
}
