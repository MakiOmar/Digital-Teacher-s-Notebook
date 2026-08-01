import React from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

/** Brand wordmark for launch splash (transparent PNG on white). */
export const SPLASH_BRAND = require("../../assets/images/splash-icon.png");
export const BLUEPRINT_BG = require("../../assets/images/blueprint-bg.png");
export const SPLASH_LETTERBOX = "#FFFFFF";

/** Launch splash: brand logo centered on white. */
export function SplashBackground({
  onLoadEnd,
  style,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.splashRoot, style]}>
      {/* Logo only — no full-bleed background.png on entrance */}
      <Image
        source={SPLASH_BRAND}
        style={styles.splashImage}
        resizeMode="contain"
        onLoadEnd={onLoadEnd}
      />
    </View>
  );
}

/**
 * In-app shell: soft blueprint wash. Children always paint above the image.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground
      source={BLUEPRINT_BG}
      style={styles.shell}
      imageStyle={styles.shellImage}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    backgroundColor: SPLASH_LETTERBOX,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  splashImage: {
    width: "88%",
    maxWidth: 360,
    height: 120,
  },
  shell: {
    flex: 1,
    width: "100%",
    backgroundColor: "#E8F1F8",
  },
  shellImage: {
    opacity: 0.35,
  },
});
