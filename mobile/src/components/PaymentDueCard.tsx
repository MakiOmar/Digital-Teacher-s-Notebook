import { memo } from "react";
import { Pressable } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DetailCard } from "@/src/components/DetailCard";
import type { StudentDueRow } from "@/src/db/types";
import { t } from "@/src/i18n/ar";
import { useColors } from "@/src/theme/ThemeContext";
import { formatMoney, formatRoundTitle } from "@/src/utils/date";
import {
  paymentStatusBorderColor,
  paymentStatusLabel,
} from "@/src/utils/statusLabels";

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
  const colors = useColors();
  const border = paymentStatusBorderColor(item.status, colors);
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
    <DetailCard
      title={item.student_name}
      right={formatMoney(item.remaining)}
      borderColor={border}
      onPress={onPress}
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
        item.status !== "paid" && onPayPress ? (
          <Pressable
            onPress={onPayPress}
            hitSlop={10}
            style={{ padding: 4 }}
            accessibilityLabel={t("payments")}
          >
            <FontAwesome name="money" size={16} color={colors.warning} />
          </Pressable>
        ) : null
      }
      details={[
        { icon: "users", label: t("group"), value: item.group_name },
        { icon: "calendar", label: t("selectMonth"), value: roundLabel },
        {
          icon: "clock-o",
          label: t("remainingClasses"),
          value: String(item.remaining_classes ?? 0),
        },
        {
          icon: "money",
          label: t("payments"),
          value: `${formatMoney(item.paid)} / ${formatMoney(item.due)}`,
        },
      ]}
    />
  );
});
