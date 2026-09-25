import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { t } from "@/src/i18n/ar";
import { formatRoundRange } from "@/src/utils/date";
import { radii, spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { fonts } from "@/src/theme/typography";

/**
 * Expandable round block: blue pill label + date range title, then children.
 */
export function RoundAccordion({
  roundNumber,
  startedAt,
  closedAt,
  expanded,
  onToggle,
  children,
}: {
  roundNumber: number;
  startedAt?: string | null;
  closedAt?: string | null;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const range = formatRoundRange(
    startedAt,
    closedAt,
    t("roundUntilOngoing")
  );
  const label = t("roundNumberLabel", { n: roundNumber });

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label} ${range}`}
        style={({ pressed }) => [
          styles.header,
          rtlRow(),
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <Text
          style={[styles.range, { color: colors.text }]}
          numberOfLines={2}
        >
          {range}
        </Text>
        <FontAwesome
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.primary}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1.5,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  badge: {
    borderRadius: radii.md,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  badgeText: {
    ...rtlText,
    color: "#fff",
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  range: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
