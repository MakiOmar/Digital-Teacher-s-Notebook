import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";

export type IconName = ComponentProps<typeof FontAwesome>["name"];

export type DetailItem = {
  icon: IconName;
  label: string;
  value: string;
};

/** A consistent icon, label, and value row for detail-oriented cards. */
export function IconDetailRow({ icon, label, value }: DetailItem) {
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
};

/** Shared surface card for compact, scannable record details. */
export function DetailCard({
  title,
  details,
  borderColor = colors.border,
  right,
  badge,
  trailing,
  footer,
  onPress,
  children,
}: DetailCardProps) {
  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
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
            {right ? <Text style={styles.right}>{right}</Text> : null}
            {trailing}
          </View>
        ) : null}
      </View>

      {children}

      {details.length ? (
        <View style={styles.details}>
          {details.map((detail, index) => (
            <IconDetailRow
              key={`${detail.icon}-${detail.label}-${index}`}
              {...detail}
            />
          ))}
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  const cardStyle = [styles.card, { borderColor }];
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
    backgroundColor: colors.surface,
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
    color: colors.text,
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
