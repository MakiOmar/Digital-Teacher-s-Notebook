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
import { radii, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
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
  const colors = useColors();

  return (
    <View
      style={[
        styles.screen,
        {
          // Opaque so stack/tab transitions don't show the previous page's text.
          backgroundColor: colors.background,
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
  const colors = useColors();
  return <Text style={[styles.title, { color: colors.text }]}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text style={[styles.muted, { color: colors.textMuted }, style]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>
  );
}

export function LoadingBlock() {
  const colors = useColors();
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
  const colors = useColors();
  const button =
    actionLabel && onAction ? (
      <View style={{ marginTop: spacing.md, width: "100%", maxWidth: 280 }}>
        <PrimaryButton label={actionLabel} onPress={onAction} />
      </View>
    ) : null;

  return (
    <View style={styles.center}>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{message}</Text>
      {tourAnchorId && button ? (
        <TourAnchor id={tourAnchorId}>{button}</TourAnchor>
      ) : (
        button
      )}
    </View>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const colors = useColors();
  return (
    <View style={{ padding: spacing.lg, gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[styles.skeletonRow, { backgroundColor: colors.primarySoft }]}
        />
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
  const colors = useColors();
  return (
    <View style={[styles.field, rtlBlock, { marginBottom: spacing.sm }]}>
      <View style={inputShell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? "بحث..."}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
            },
          ]}
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
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && { backgroundColor: colors.primary },
        variant === "danger" && { backgroundColor: colors.danger },
        variant === "ghost" && {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: colors.primary,
        },
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
  const colors = useColors();
  return (
    <View style={[styles.field, rtlBlock, !label ? { marginBottom: 0 } : null]}>
      {label ? (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      ) : null}
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
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
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
  const colors = useColors();
  const body = (
    <View
      style={[
        styles.row,
        rtlRow(),
        {
          backgroundColor: colors.surface,
          borderColor: borderColor ?? colors.border,
          borderWidth: borderColor ? 2 : 1.5,
          flex: 1,
          marginBottom: 0,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text style={[styles.rowRight, { color: colors.primary }]}>{right}</Text>
      ) : null}
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
  const colors = useColors();
  // Keep margin outside TourAnchor so the spotlight measures the card only
  const body = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuCard,
        rtlRow(),
        {
          backgroundColor: colors.surface,
          borderColor: borderColor ?? colors.primary,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon != null ? (
        <Image source={icon} style={styles.menuIcon} />
      ) : (
        <View
          style={[styles.menuIconFallback, { backgroundColor: colors.primarySoft }]}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
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
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        rtlBlock,
        {
          backgroundColor: colors.surface,
          borderColor: borderColor ?? colors.border,
          borderWidth: 2,
        },
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
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        rtlBlock,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
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
  const colors = useColors();
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
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
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
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? "#fff" : colors.text },
        ]}
      >
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
    opacity: 0.55,
  },
  title: {
    fontSize: 22,
    ...fontBold,
    ...rtlText,
    fontFamily: fonts.bold,
    width: "100%",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    ...fontBold,
    ...rtlText,
    fontFamily: fonts.bold,
    width: "100%",
    marginBottom: 6,
  },
  muted: {
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
    ...fontSemiBold,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    width: "100%",
  },
  row: {
    alignItems: "center",
    gap: 12,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowTitle: {
    fontSize: 16,
    ...fontBold,
    ...rtlText,
    fontFamily: fonts.bold,
  },
  rowRight: {
    ...fontBold,
    ...rtlText,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
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
    ...rtlText,
    fontFamily: fonts.extraBold,
  },
  stat: {
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  statLabel: {
    ...rtlText,
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    ...rtlText,
    fontSize: 16,
    ...fontBold,
    fontFamily: fonts.bold,
  },
  chipRow: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  chipText: {
    ...fontSemiBold,
    ...rtlText,
    fontFamily: fonts.semiBold,
  },
});
