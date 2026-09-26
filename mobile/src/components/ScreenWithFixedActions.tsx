import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Screen } from "./ui";
import { IconActionBar, type IconAction } from "./IconActionBar";
import { spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/**
 * Detail/session shell: fixed top ⋮ actions menu + flex body.
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
  const colors = useColors();

  return (
    <Screen padded={false} style={[{ flex: 1 }, style]} safeTop={false}>
      {actions.length ? (
        <View
          style={[
            styles.fixedActions,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
});
