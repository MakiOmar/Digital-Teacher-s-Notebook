import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { radii, spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { physicalPadEdge, rtlRow, rtlText } from "@/src/theme/rtl";

export type IconName = ComponentProps<typeof FontAwesome>["name"];

export type DetailItem = {
  icon: IconName;
  label: string;
  value: string;
};

/** A consistent icon, label, and value row for detail-oriented cards. */
export function IconDetailRow({ icon, label, value }: DetailItem) {
  const colors = useColors();
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconWrap, { backgroundColor: colors.primarySoft }]}>
        <FontAwesome name={icon} size={13} color={colors.primary} />
      </View>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

type DetailCardProps = {
  title: string;
  details: DetailItem[];
  borderColor?: string;
  right?: string;
  badge?: {
    label: string;
    color: string;
    backgroundColor?: string;
  };
  trailing?: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
  /**
   * Keep the card full-width; only pad the title/header content away from
   * overlapping edge chips (physical left/right).
   */
  contactEdge?: "left" | "right";
};

/** Shared surface card for compact, scannable record details. */
export function DetailCard({
  title,
  details,
  borderColor,
  right,
  badge,
  trailing,
  footer,
  onPress,
  children,
  contactEdge,
}: DetailCardProps) {
  const colors = useColors();
  const resolvedBorder = borderColor ?? colors.border;
  const headerPad: ViewStyle | null = contactEdge
    ? physicalPadEdge(contactEdge, 76)
    : null;

  const content = (
    <>
      <View style={[styles.header, headerPad]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {badge ? (
            <View
              style={[
                styles.badge,
                {
                  borderColor: badge.color,
                  backgroundColor: badge.backgroundColor ?? colors.backgroundAlt,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
        {right || trailing ? (
          <View style={styles.headerEnd}>
            {right ? (
              <Text style={[styles.right, { color: colors.text }]}>{right}</Text>
            ) : null}
            {trailing}
          </View>
        ) : null}
      </View>

      {children}

      {details.length ? (
        <View
          style={[
            styles.details,
            { borderTopColor: colors.border },
          ]}
        >
          {details.map((detail, index) => (
            <IconDetailRow
              key={`${detail.icon}-${detail.label}-${index}`}
              {...detail}
            />
          ))}
        </View>
      ) : null}

      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {footer}
        </View>
      ) : null}
    </>
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: resolvedBorder },
  ];
  if (!onPress) {
    return <View style={cardStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
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
  title: {
    ...rtlText,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    ...rtlText,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  headerEnd: {
    alignItems: "flex-end",
    gap: 6,
  },
  right: {
    ...rtlText,
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  details: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    ...rtlText,
    width: 96,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  detailValue: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
});
