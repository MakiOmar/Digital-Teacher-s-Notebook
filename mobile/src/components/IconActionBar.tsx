import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors, radii, spacing } from "../theme/colors";
import { rtlRow, rtlText } from "../theme/rtl";

export type IconAction = {
  key: string;
  /** FontAwesome glyph name */
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  onPress: () => void;
  tone?: "default" | "danger" | "accent";
};

/** Compact icon+caption action row for group header toolbars. */
export function IconActionBar({ actions }: { actions: IconAction[] }) {
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
        return (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            accessibilityLabel={a.label}
            style={({ pressed }) => [
              styles.btn,
              tone === "danger" && styles.btnDanger,
              tone === "accent" && styles.btnAccent,
              pressed && { opacity: 0.75 },
            ]}
          >
            <FontAwesome name={a.icon} size={18} color={iconColor} />
            <Text
              style={[
                styles.caption,
                tone === "danger" && { color: colors.danger },
                tone === "accent" && { color: colors.primary },
              ]}
              numberOfLines={1}
            >
              {a.label}
            </Text>
          </Pressable>
        );
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
  btn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  btnAccent: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  btnDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  caption: {
    ...rtlText,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    maxWidth: 72,
  },
});
