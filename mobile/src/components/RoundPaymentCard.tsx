import { memo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { PaymentMethod, StudentDueRow } from "@/src/db/types";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
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

type DetailIcon = React.ComponentProps<typeof FontAwesome>["name"];

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: DetailIcon;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <FontAwesome name={icon} size={13} color={colors.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

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
  const isPaid = item.status === "paid";
  const border = paymentStatusBorderColor(item.status);

  return (
    <View style={[styles.card, { borderColor: border }]}>
      {/* Comment: header — name, status, remaining, paid switch. */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {item.student_name}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  item.status === "paid"
                    ? colors.paid
                    : item.status === "partial"
                      ? colors.partial
                      : colors.unpaid,
                borderColor: border,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: border }]}>
              {paymentStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <View style={styles.switchBlock}>
          <Text style={styles.amount}>{formatMoney(item.remaining)}</Text>
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
        </View>
      </View>

      {/* Comment: structured financial / class details. */}
      <View style={styles.details}>
        <DetailRow
          icon="money"
          label={t("payments")}
          value={`${formatMoney(item.paid)} / ${formatMoney(item.due)}`}
        />
        <DetailRow
          icon="clock-o"
          label={t("remainingClasses")}
          value={String(item.remaining_classes ?? 0)}
        />
        {item.status === "partial" ? (
          <DetailRow
            icon="exclamation-circle"
            label={t("filterByStatus")}
            value={t("partial")}
          />
        ) : null}
      </View>

      {/* Comment: pick method before flipping unpaid → paid. */}
      {!isPaid ? (
        <View style={styles.methodBlock}>
          <Text style={styles.methodLabel}>{t("method")}</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const on = method === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => onChangeMethod(m.key)}
                  disabled={busy}
                  style={[styles.methodChip, on && styles.methodChipOn]}
                >
                  <Text style={[styles.methodText, on && styles.methodTextOn]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    ...rtlRow(),
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    ...rtlText,
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    ...rtlText,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  switchBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    ...rtlText,
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  details: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 8,
  },
  detailIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    ...rtlText,
    width: 96,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  detailValue: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  methodBlock: {
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  methodLabel: {
    ...rtlText,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
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
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  methodChipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  methodText: {
    ...rtlText,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  methodTextOn: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
