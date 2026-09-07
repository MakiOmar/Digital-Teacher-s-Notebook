import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { type ComponentProps } from "react";
import { radii, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { rtlRow, rtlText } from "../theme/rtl";
import { TourAnchor } from "@/src/tour/TourAnchor";
import type { TourTargetId } from "@/src/tour/tourSteps";

export type IconAction = {
  key: string;
  /** FontAwesome glyph name */
  icon: ComponentProps<typeof FontAwesome>["name"];
  label: string;
  onPress: () => void;
  tone?: "default" | "danger" | "accent";
  disabled?: boolean;
  /** Optional spotlight anchor id for onboarding tour */
  tourId?: TourTargetId;
};

/** Compact icon+caption action row for page-top toolbars. */
export function IconActionBar({ actions }: { actions: IconAction[] }) {
  const colors = useColors();
  if (!actions.length) return null;
  return (
    <View style={styles.row}>
      {actions.map((a) => {
        const tone = a.tone ?? "default";
        const iconColor =
          tone === "danger"
            ? colors.danger
            : tone === "accent"
              ? colors.primary
              : colors.text;
        const btn = (
          <Pressable
            onPress={a.onPress}
            disabled={a.disabled}
            accessibilityLabel={a.label}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor:
                  tone === "danger"
                    ? colors.unpaid
                    : tone === "accent"
                      ? colors.primarySoft
                      : colors.surface,
                borderColor:
                  tone === "danger"
                    ? colors.unpaidBorder
                    : tone === "accent"
                      ? colors.primary
                      : colors.border,
              },
              (a.disabled || pressed) && { opacity: 0.55 },
            ]}
          >
            <FontAwesome name={a.icon} size={18} color={iconColor} />
            <Text
              style={[
                styles.caption,
                {
                  color:
                    tone === "danger"
                      ? colors.danger
                      : tone === "accent"
                        ? colors.primary
                        : colors.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {a.label}
            </Text>
          </Pressable>
        );
        if (a.tourId) {
          return (
            <TourAnchor
              key={a.key}
              id={a.tourId}
              style={styles.tourWrap}
            >
              {btn}
            </TourAnchor>
          );
        }
        return <React.Fragment key={a.key}>{btn}</React.Fragment>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...rtlRow(),
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
    width: "100%",
  },
  /** Keep TourAnchor sized to the button (no stretch in the action row). */
  tourWrap: {
    alignSelf: "flex-start",
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  caption: {
    ...rtlText,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: "700",
    maxWidth: 72,
  },
});
