import React from "react";
import {
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

export const APP_BACKGROUND = require("../../assets/images/background.png");
export const SPLASH_LETTERBOX = "#423226";

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
 * Decorative brand watermark behind page content (does not wrap children).
 * Place once behind a navigator; keep Screen content free of image layers.
 */
export function BrandWatermark() {
  const { width, height } = useWindowDimensions();
  return (
    <Image
      source={APP_BACKGROUND}
      pointerEvents="none"
      resizeMode="contain"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        opacity: 0.3,
        zIndex: 0,
        elevation: 0,
      }}
    />
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
});
