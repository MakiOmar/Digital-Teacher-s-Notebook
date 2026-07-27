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

/** Full-bleed brand image — used only for the launch/splash phase. */
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
 * App pages: white is the main background; brand image sits underneath at 0.3 opacity.
 */
export function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.appRoot}>
      <Image
        source={APP_BACKGROUND}
        style={styles.underImage}
        resizeMode="cover"
        pointerEvents="none"
      />
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
  appRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  underImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  content: {
    flex: 1,
  },
});
