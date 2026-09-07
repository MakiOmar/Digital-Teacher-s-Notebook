import { memo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DetailCard } from "@/src/components/DetailCard";
import type { PaymentMethod, StudentDueRow } from "@/src/db/types";
import { t } from "@/src/i18n/ar";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { formatMoney } from "@/src/utils/date";
import {
  paymentStatusBorderColor,
  paymentStatusLabel,
} from "@/src/utils/statusLabels";

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: t("cash") },
  { key: "transfer", label: t("transfer") },
  { key: "other", label: t("other") },
];

/** Interactive group round-payment card with icon details + pay switch. */
export const RoundPaymentCard = memo(function RoundPaymentCard({
  item,
  method,
  busy,
  onTogglePaid,
  onChangeMethod,
}: {
  item: StudentDueRow;
  method: PaymentMethod;
  busy: boolean;
  onTogglePaid: (paid: boolean) => void;
  onChangeMethod: (method: PaymentMethod) => void;
}) {
  const colors = useColors();
  const isPaid = item.status === "paid";
  const border = paymentStatusBorderColor(item.status, colors);

  return (
    <DetailCard
      title={item.student_name}
      right={formatMoney(item.remaining)}
      borderColor={border}
      badge={{
        label: paymentStatusLabel(item.status),
        color: border,
        backgroundColor:
          item.status === "paid"
            ? colors.paid
            : item.status === "partial"
              ? colors.partial
              : colors.unpaid,
      }}
      trailing={
        <Switch
          value={isPaid}
          disabled={busy}
          onValueChange={onTogglePaid}
          trackColor={{
            false: colors.border,
            true: colors.primarySoft,
          }}
          thumbColor={isPaid ? colors.primary : colors.textMuted}
        />
      }
      details={[
        {
          icon: "money",
          label: t("payments"),
          value: `${formatMoney(item.paid)} / ${formatMoney(item.due)}`,
        },
        {
          icon: "clock-o",
          label: t("remainingClasses"),
          value: String(item.remaining_classes ?? 0),
        },
        ...(item.status === "partial"
          ? [
              {
                icon: "exclamation-circle" as const,
                label: t("filterByStatus"),
                value: t("partial"),
              },
            ]
          : []),
      ]}
      footer={
        !isPaid ? (
          // Keep payment-method controls beneath the structured details.
          <View style={styles.methodBlock}>
            <Text style={[styles.methodLabel, { color: colors.textMuted }]}>
              {t("method")}
            </Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => {
                const on = method === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => onChangeMethod(m.key)}
                    disabled={busy}
                    style={[
                      styles.methodChip,
                      {
                        borderColor: on ? colors.primary : colors.border,
                        backgroundColor: on
                          ? colors.primarySoft
                          : colors.backgroundAlt,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: on ? colors.primary : colors.textMuted,
                          fontFamily: on ? fonts.bold : fonts.semiBold,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null
      }
    />
  );
});

const styles = StyleSheet.create({
  methodBlock: {
    gap: 6,
  },
  methodLabel: {
    ...rtlText,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  methodRow: {
    ...rtlChipRow(),
    gap: 6,
    flexWrap: "wrap",
  },
  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  methodText: {
    ...rtlText,
    fontSize: 12,
  },
});
