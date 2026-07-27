import React from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

export const APP_BACKGROUND = require("../../assets/images/background.png");
export const SPLASH_LETTERBOX = "#423226";

/** White veil strength (higher = denser white, fainter image). */
export const PAGE_WHITE_OPACITY = 0.92;

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
 * White shell with a centered, barely-visible brand image.
 * Children render ON TOP of the image (ImageBackground), so the UI cannot get covered.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground
      source={APP_BACKGROUND}
      style={styles.shell}
      imageStyle={styles.shellImage}
      resizeMode="contain"
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
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
  shell: {
    flex: 1,
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  shellImage: {
    // Centered by resizeMode="contain"; barely visible under dense white.
    opacity: 1 - PAGE_WHITE_OPACITY,
  },
});
