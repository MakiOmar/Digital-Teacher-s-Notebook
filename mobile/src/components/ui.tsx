import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../theme/colors";
import { fonts, fontBold, fontExtraBold, fontSemiBold } from "../theme/typography";
import { rtlRow, rtlText, rtlBlock, rtlChipRow, inputShell, inputTextAlign, writingDirection } from "../theme/rtl";
import { TourAnchor } from "@/src/tour/TourAnchor";
import type { TourTargetId } from "@/src/tour/tourSteps";

export function Screen({
  children,
  style,
  padded = true,
  /**
   * Extra top inset for the status bar.
   * Default false — stack routes already clear the status bar via the header.
   * Tab roots (no stack header) must pass safeTop.
   */
  safeTop = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: (safeTop ? insets.top : 0) + spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: padded ? spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function LoadingBlock() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
  tourAnchorId,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional spotlight anchor around the CTA */
  tourAnchorId?: TourTargetId;
}) {
  const button =
    actionLabel && onAction ? (
      <View style={{ marginTop: spacing.md, width: "100%", maxWidth: 280 }}>
        <PrimaryButton label={actionLabel} onPress={onAction} />
      </View>
    ) : null;

  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{message}</Text>
      {tourAnchorId && button ? (
        <TourAnchor id={tourAnchorId}>{button}</TourAnchor>
      ) : (
        button
      )}
    </View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ padding: spacing.lg, gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={[styles.field, rtlBlock, { marginBottom: spacing.sm }]}>
      <View style={inputShell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? "بحث..."}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign={inputTextAlign()}
        />
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "ghost";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "danger" && styles.btnDanger,
        variant === "ghost" && styles.btnGhost,
        (disabled || pressed) && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === "ghost" && { color: colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  multiline?: boolean;
  onFocus?: () => void;
}) {
  return (
    <View style={[styles.field, rtlBlock]}>
      <Text style={styles.label}>{label}</Text>
      <View style={inputShell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={onFocus}
          style={[
            styles.input,
            {
              writingDirection: writingDirection(),
              textAlign: inputTextAlign(),
            },
            multiline && { minHeight: 80, textAlignVertical: "top" },
          ]}
          textAlign={inputTextAlign()}
        />
      </View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  borderColor,
  trailing,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  borderColor?: string;
  /** Optional icon/actions rendered outside the main press target. */
  trailing?: React.ReactNode;
}) {
  const body = (
    <View
      style={[
        styles.row,
        rtlRow(),
        borderColor ? { borderColor, borderWidth: 2 } : null,
        { flex: 1, marginBottom: 0 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
    </View>
  );

  return (
    <View style={[rtlRow(), { alignItems: "center", marginBottom: spacing.sm, gap: 6 }]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.75 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
      {trailing}
    </View>
  );
}

/** Home / hub menu card with optional icon image and colored border. */
export function MenuCard({
  title,
  subtitle,
  icon,
  borderColor,
  onPress,
  tourId,
}: {
  title: string;
  subtitle?: string;
  icon?: number;
  borderColor?: string;
  onPress: () => void;
  /** Optional spotlight target for the onboarding tour */
  tourId?: TourTargetId;
}) {
  // Keep margin outside TourAnchor so the spotlight measures the card only
  const body = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuCard,
        rtlRow(),
        { borderColor: borderColor ?? colors.primary },
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon != null ? (
        <Image source={icon} style={styles.menuIcon} />
      ) : (
        <View style={[styles.menuIconFallback, { backgroundColor: colors.primarySoft }]} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );

  const card = tourId ? <TourAnchor id={tourId}>{body}</TourAnchor> : body;
  return <View style={styles.menuCardWrap}>{card}</View>;
}

export function BorderedCard({
  children,
  borderColor,
  style,
}: {
  children: React.ReactNode;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        rtlBlock,
        { borderColor: borderColor ?? colors.border, borderWidth: 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, rtlBlock, style]}>{children}</View>;
}

export function StatCard({
  label,
  value,
  tone = "default",
  style,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "warning";
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    tone === "success"
      ? colors.paid
      : tone === "danger"
        ? colors.unpaid
        : tone === "warning"
          ? colors.partial
          : colors.primarySoft;
  const border =
    tone === "success"
      ? colors.paidBorder
      : tone === "danger"
        ? colors.unpaidBorder
        : tone === "warning"
          ? colors.partialBorder
          : colors.primary;
  return (
    <View
      style={[
        styles.stat,
        rtlBlock,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={[styles.chipRow, rtlChipRow()]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Opaque so stack/tab transitions don't show the previous page's text.
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  skeletonRow: {
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    opacity: 0.55,
  },
  title: {
    fontSize: 22,
    ...fontBold,
    color: colors.text,
    ...rtlText,
    fontFamily: fonts.bold,
    width: "100%",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    ...fontBold,
    color: colors.text,
    ...rtlText,
    fontFamily: fonts.bold,
    width: "100%",
    marginBottom: 6,
  },
  muted: {
    color: colors.textMuted,
    ...rtlText,
    width: "100%",
    fontSize: 13,
  } as TextStyle,
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  btnText: {
    color: "#fff",
    ...fontBold,
    fontSize: 15,
    textAlign: "center",
  },
  field: { marginBottom: spacing.md },
  label: {
    ...rtlText,
    width: "100%",
    marginBottom: 6,
    color: colors.text,
    ...fontSemiBold,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    width: "100%",
  },
  row: {
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowTitle: {
    fontSize: 16,
    ...fontBold,
    color: colors.text,
    ...rtlText,
    fontFamily: fonts.bold,
  },
  rowRight: {
    color: colors.primary,
    ...fontBold,
    ...rtlText,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuCardWrap: {
    marginBottom: spacing.sm,
  },
  menuCard: {
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  menuIconFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  menuTitle: {
    fontSize: 15,
    ...fontExtraBold,
    color: colors.text,
    ...rtlText,
    fontFamily: fonts.extraBold,
  },
  stat: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    ...rtlText,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    ...rtlText,
    fontSize: 16,
    ...fontBold,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  chipRow: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    ...fontSemiBold,
    ...rtlText,
    fontFamily: fonts.semiBold,
  },
  chipTextSelected: { color: "#fff" },
});
