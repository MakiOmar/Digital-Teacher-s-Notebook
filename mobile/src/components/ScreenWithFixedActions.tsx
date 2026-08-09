import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Screen } from "./ui";
import { IconActionBar, type IconAction } from "./IconActionBar";
import { colors, spacing } from "../theme/colors";

/**
 * Detail/session shell: fixed top IconActionBar + flex body.
 * Keeps list/scroll content from fighting a tall static header.
 */
export function ScreenWithFixedActions({
  actions,
  children,
  floating,
  style,
}: {
  actions: IconAction[];
  children: React.ReactNode;
  /** Optional overlays (FABs) above the body. */
  floating?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Screen padded={false} style={[{ flex: 1 }, style]} safeTop={false}>
      {actions.length ? (
        <View style={styles.fixedActions}>
          <IconActionBar actions={actions} />
        </View>
      ) : null}
      {children}
      {floating}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixedActions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 0,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 2,
  },
});
