import React from "react";
import {
  Image,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

export const APP_BACKGROUND = require("../../assets/images/background.png");
export const SPLASH_LETTERBOX = "#423226";

/** White veil strength over the brand image (0.8 = barely visible image). */
export const PAGE_WHITE_OPACITY = 0.8;

/**
 * Launch splash: image centered with correct aspect ratio (no stretch).
 */
export function SplashBackground({
  onLoadEnd,
  style,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.splashRoot, style]}>
      <Image
        source={APP_BACKGROUND}
        style={styles.splashImage}
        resizeMode="contain"
        onLoadEnd={onLoadEnd}
      />
    </View>
  );
}

/**
 * White page background with the brand image barely visible underneath.
 * Image opacity = 1 - white veil (0.8) so only 20% of the image shows through.
 */
export function BrandWatermark() {
  return (
    <View style={styles.watermark} pointerEvents="none">
      <Image
        source={APP_BACKGROUND}
        resizeMode="contain"
        style={styles.watermarkImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    backgroundColor: SPLASH_LETTERBOX,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
  watermark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    zIndex: 0,
  },
  watermarkImage: {
    ...StyleSheet.absoluteFillObject,
    // Barely visible under white: equivalent to white overlay at 0.8
    opacity: 1 - PAGE_WHITE_OPACITY,
  },
});
