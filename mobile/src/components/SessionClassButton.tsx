import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { IconDetailRow } from "@/src/components/DetailCard";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlText } from "@/src/theme/rtl";
import { t } from "@/src/i18n/ar";

export type AttendanceCoverage = { marked: number; total: number };

export function sessionStatusLabel(status: SessionStatus | string): string {
  if (status === "completed") return t("sessionCompleted");
  if (status === "cancelled") return t("sessionCancelled");
  if (status === "rescheduled") return t("sessionRescheduled");
  return t("sessionScheduled");
}

export function attendanceFill(
  coverage?: AttendanceCoverage
): "none" | "partial" | "full" {
  if (!coverage || coverage.total <= 0 || coverage.marked <= 0) return "none";
  if (coverage.marked >= coverage.total) return "full";
  return "partial";
}

export function SessionClassButton({
  session,
  coverage,
  onPress,
}: {
  session: GroupSession;
  coverage?: AttendanceCoverage;
  onPress: () => void;
}) {
  const colors = useColors();
  const fill = attendanceFill(coverage);
  const cancelled = session.status === "cancelled";
  const completed = session.status === "completed";

  const toneStyle: ViewStyle = cancelled
    ? {
        backgroundColor: colors.unpaid,
        borderColor: colors.danger,
        opacity: 0.85,
      }
    : completed || fill === "full"
      ? {
          backgroundColor: colors.sessionFull,
          borderColor: colors.sessionFullBorder,
        }
      : fill === "partial"
        ? {
            backgroundColor: colors.sessionPartial,
            borderColor: colors.sessionPartialBorder,
          }
        : {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        toneStyle,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {formatDateTimeAr(session.starts_at)}
      </Text>
      <View style={[styles.details, { borderTopColor: colors.border }]}>
        <IconDetailRow
          icon={cancelled ? "flag" : "info-circle"}
          label={t("filterByStatus")}
          value={sessionStatusLabel(session.status)}
        />
        {coverage && coverage.total > 0 ? (
          <IconDetailRow
            icon="check-square-o"
          label={t("sessionRosterAttendance")}
          value={`${coverage.marked}/${coverage.total}`}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
  },
  details: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
});
