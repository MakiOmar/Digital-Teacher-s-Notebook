import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { StudentDueRow } from "@/src/db/types";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import {
  paymentStatusBorderColor,
  paymentStatusLabel,
} from "@/src/utils/statusLabels";

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

/** Payment dues card: status border, amount highlight, icon detail list. */
export const PaymentDueCard = memo(function PaymentDueCard({
  item,
  onPress,
  onPayPress,
}: {
  item: StudentDueRow;
  onPress: () => void;
  onPayPress?: () => void;
}) {
  const border = paymentStatusBorderColor(item.status);
  const roundLabel =
    item.round_number != null
      ? formatRoundTitle(
          item.round_number,
          item.started_at,
          item.closed_at,
          t("roundUntilOngoing")
        )
      : t("currentRound");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: border },
        pressed && { opacity: 0.88 },
      ]}
    >
      {/* Comment: header — name + remaining amount + optional pay shortcut. */}
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
        <View style={styles.amountBlock}>
          <Text style={styles.amount}>{formatMoney(item.remaining)}</Text>
          {item.status !== "paid" && onPayPress ? (
            <Pressable
              onPress={onPayPress}
              hitSlop={10}
              style={styles.payBtn}
              accessibilityLabel={t("payments")}
            >
              <FontAwesome name="money" size={16} color={colors.warning} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Comment: structured details instead of one dense subtitle string. */}
      <View style={styles.details}>
        <DetailRow icon="users" label={t("group")} value={item.group_name} />
        <DetailRow icon="calendar" label={t("selectMonth")} value={roundLabel} />
        <DetailRow
          icon="clock-o"
          label={t("remainingClasses")}
          value={String(item.remaining_classes ?? 0)}
        />
        <DetailRow
          icon="money"
          label={t("payments")}
          value={`${formatMoney(item.paid)} / ${formatMoney(item.due)}`}
        />
      </View>
    </Pressable>
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
  amountBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  amount: {
    ...rtlText,
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  payBtn: {
    padding: 4,
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
});
