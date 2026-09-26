import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { radii, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { rtlRow, rtlText } from "../theme/rtl";
import { TourAnchor } from "@/src/tour/TourAnchor";
import type { TourTargetId } from "@/src/tour/tourSteps";
import { t } from "@/src/i18n/ar";

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

/**
 * Compact ⋮ trigger + actions modal. Use in nav headerRight or inline toolbars.
 */
export function OverflowMenuButton({
  actions,
  style,
}: {
  actions: IconAction[];
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  // Keep latest actions so headerRight closures stay fresh on press.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const tourId = useMemo(
    () => actions.find((a) => a.tourId)?.tourId,
    [actions]
  );

  if (!actions.length) return null;

  const close = () => setOpen(false);

  const trigger = (
    <Pressable
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={t("actionsMenu")}
      style={({ pressed }) => [
        styles.trigger,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <FontAwesome name="ellipsis-v" size={18} color={colors.primary} />
    </Pressable>
  );

  return (
    <View style={[styles.compactWrap, style]}>
      {tourId ? (
        <TourAnchor id={tourId} style={styles.tourWrap}>
          {trigger}
        </TourAnchor>
      ) : (
        trigger
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {t("actionsMenu")}
            </Text>
            <View style={styles.menuList}>
              {actionsRef.current.map((a) => {
                const tone = a.tone ?? "default";
                const iconColor =
                  tone === "danger"
                    ? colors.danger
                    : tone === "accent"
                      ? colors.primary
                      : colors.text;
                const labelColor =
                  tone === "danger"
                    ? colors.danger
                    : tone === "accent"
                      ? colors.primary
                      : colors.text;
                return (
                  <Pressable
                    key={a.key}
                    disabled={a.disabled}
                    onPress={() => {
                      close();
                      // Defer so the modal can dismiss before navigation/alerts.
                      requestAnimationFrame(() => a.onPress());
                    }}
                    accessibilityLabel={a.label}
                    style={({ pressed }) => [
                      styles.menuItem,
                      rtlRow(),
                      {
                        borderColor:
                          tone === "danger"
                            ? colors.unpaidBorder
                            : tone === "accent"
                              ? colors.primary
                              : colors.border,
                        backgroundColor:
                          tone === "danger"
                            ? colors.unpaid
                            : tone === "accent"
                              ? colors.primarySoft
                              : colors.backgroundAlt,
                      },
                      (a.disabled || pressed) && { opacity: 0.55 },
                    ]}
                  >
                    <FontAwesome name={a.icon} size={16} color={iconColor} />
                    <Text
                      style={[styles.menuLabel, { color: labelColor }]}
                      numberOfLines={2}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                {t("cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Mid-content overflow (e.g. save-notes). Page chrome should use useHeaderToolbar / PageToolbar.
 */
export function IconActionBar({ actions }: { actions: IconAction[] }) {
  if (!actions.length) return null;
  return <OverflowMenuButton actions={actions} />;
}

const styles = StyleSheet.create({
  compactWrap: {
    alignSelf: "center",
  },
  tourWrap: {
    alignSelf: "center",
  },
  trigger: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    maxHeight: "80%",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheetTitle: {
    ...rtlText,
    width: "100%",
    fontSize: 17,
    fontFamily: fonts.extraBold,
    marginBottom: spacing.md,
  },
  menuList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  menuItem: {
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  menuLabel: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    ...rtlText,
    fontFamily: fonts.bold,
  },
});
