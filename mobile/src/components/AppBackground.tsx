import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/src/theme/colors";

/** Launch / boot splash: full brand (mark + title). */
export const SPLASH_BRAND = require("../../assets/images/logo-full.webp");
/** In-app transparent mark only — Home header. */
export const APP_LOGO_MARK = require("../../assets/images/logo-mark.png");
export const BLUEPRINT_BG = require("../../assets/images/blueprint-bg.webp");
/** Fallback / letterbox under gradient while splash paints. */
export const SPLASH_LETTERBOX = "#BFE4F0";

/** Soft brand wash — mint into sky blue (clearly visible around the logo). */
const SPLASH_GRADIENT = ["#DFF7F2", "#B5E2F0", "#7ECAE6"] as const;

const BAR_WIDTH = 160;
const THUMB_WIDTH = 58;

/** Indeterminate sliding thumb under the splash logo. */
function SplashProgressBar() {
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Default easing only — avoids Easing.* shim gaps that crash boot.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(travel, {
          toValue: 1,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(travel, {
          toValue: 0,
          duration: 1050,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  const translateX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH - THUMB_WIDTH],
  });

  return (
    <View
      // Android can collapse views that only host Animated children.
      collapsable={false}
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.View
        collapsable={false}
        style={[styles.progressThumb, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

/** Launch / boot splash: full brand centered on a soft brand gradient. */
export function SplashBackground({
  onLoadEnd,
  style,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={[...SPLASH_GRADIENT]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.splashRoot, style]}
    >
      <View style={styles.brandBlock}>
        {/* Brand mark + bilingual title (asset may include its own padding) */}
        <Image
          source={SPLASH_BRAND}
          style={styles.splashImage}
          resizeMode="contain"
          onLoadEnd={onLoadEnd}
        />
        {/* Indeterminate boot progress under the logo */}
        <SplashProgressBar />
      </View>
    </LinearGradient>
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
    // Fallback under the gradient while LinearGradient mounts
    backgroundColor: SPLASH_LETTERBOX,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  brandBlock: {
    width: "100%",
    alignItems: "center",
  },
  splashImage: {
    width: "72%",
    maxWidth: 280,
    height: 220,
  },
  progressTrack: {
    marginTop: 28,
    width: BAR_WIDTH,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15, 118, 110, 0.28)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 118, 110, 0.45)",
    overflow: "hidden",
  },
  progressThumb: {
    width: THUMB_WIDTH,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
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
