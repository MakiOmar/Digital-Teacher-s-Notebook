import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import type { GroupSession, SessionStatus } from "@/src/db/types";
import { formatDateTimeAr } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";
import { t } from "@/src/i18n/ar";

export type AttendanceCoverage = { marked: number; total: number };

export function sessionStatusLabel(status: SessionStatus | string): string {
  if (status === "completed") return t("sessionCompleted");
  if (status === "cancelled") return t("sessionCancelled");
  if (status === "rescheduled") return t("sessionScheduled");
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
  const fill = attendanceFill(coverage);
  const cancelled = session.status === "cancelled";
  const completed = session.status === "completed";

  const toneStyle: ViewStyle = cancelled
    ? styles.cancelled
    : completed || fill === "full"
      ? styles.full
      : fill === "partial"
        ? styles.partial
        : styles.idle;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        toneStyle,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={styles.title}>{formatDateTimeAr(session.starts_at)}</Text>
      <Text style={styles.meta}>
        {sessionStatusLabel(session.status)}
        {coverage && coverage.total > 0
          ? ` · ${coverage.marked}/${coverage.total}`
          : ""}
      </Text>
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
  idle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  partial: {
    backgroundColor: colors.sessionPartial,
    borderColor: colors.sessionPartialBorder,
  },
  full: {
    backgroundColor: colors.sessionFull,
    borderColor: colors.sessionFullBorder,
  },
  cancelled: {
    backgroundColor: colors.unpaid,
    borderColor: colors.danger,
    opacity: 0.85,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  meta: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
});
