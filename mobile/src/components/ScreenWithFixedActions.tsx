import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { Screen } from "./ui";
import type { IconAction } from "./IconActionBar";
import {
  useHeaderToolbar,
  type HeaderFilterConfig,
} from "./useHeaderToolbar";

/**
 * Detail/session shell: ⋮ (+ optional filter) in the nav header next to the title.
 */
export function ScreenWithFixedActions({
  actions,
  filter,
  children,
  floating,
  style,
}: {
  actions: IconAction[];
  filter?: HeaderFilterConfig | null;
  children: React.ReactNode;
  /** Optional overlays (FABs) above the body. */
  floating?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useHeaderToolbar({ actions, filter });

  return (
    <Screen padded={false} style={[{ flex: 1 }, style]} safeTop={false}>
      {children}
      {floating}
    </Screen>
  );
}
