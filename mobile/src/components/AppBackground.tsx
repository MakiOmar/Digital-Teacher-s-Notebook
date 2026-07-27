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

/**
 * Launch splash: image centered with correct aspect ratio (no stretch).
 * Letterbox color fills the rest of the screen.
 */
export function SplashBackground({
  onLoadEnd,
  style,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.splashRoot, style]} pointerEvents="none">
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
 * App pages: white base; brand image centered underneath at 0.3 opacity
 * (contain keeps aspect ratio — no stretch). Content always paints above.
 */
export function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.appRoot}>
      <View style={styles.imageLayer} pointerEvents="none">
        <Image
          source={APP_BACKGROUND}
          style={styles.underImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.content} collapsable={false}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashRoot: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: SPLASH_LETTERBOX,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
  appRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  imageLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    elevation: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  underImage: {
    width: "100%",
    height: "100%",
    opacity: 0.3,
  },
  content: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
    backgroundColor: "transparent",
  },
});
