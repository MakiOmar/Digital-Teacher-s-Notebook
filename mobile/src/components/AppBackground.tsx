import React from "react";
import {
  ImageBackground,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

export const APP_BACKGROUND = require("../../assets/images/background.png");

/** Full-bleed brand image (no white veil) — splash / root shell. */
export function BrandBackground({
  children,
  onLoadEnd,
  style,
}: {
  children?: React.ReactNode;
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ImageBackground
      source={APP_BACKGROUND}
      style={[styles.fill, style]}
      resizeMode="cover"
      onLoadEnd={onLoadEnd}
    >
      {children}
    </ImageBackground>
  );
}

/**
 * App pages: white overlay at 30% opacity over the root brand image.
 * (Root `_layout` already paints BrandBackground — do not nest another image.)
 */
export function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <View style={styles.whiteVeil} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  whiteVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  content: {
    flex: 1,
  },
});
