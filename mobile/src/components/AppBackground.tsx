import React from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";

export const SPLASH_BRAND = require("../../assets/images/background.png");
export const BLUEPRINT_BG = require("../../assets/images/blueprint-bg.png");
export const SPLASH_LETTERBOX = "#423226";

/** Launch splash: brand portrait, centered, correct aspect ratio. */
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
  },
  splashImage: {
    width: "100%",
    height: "100%",
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
