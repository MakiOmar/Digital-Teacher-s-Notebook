import React from "react";
import {
  ActivityIndicator,
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

const BAR_WIDTH = 200;

/** Always-visible splash loader (spinner + solid bar). RTL-safe. */
function SplashProgressBar() {
  return (
    <View collapsable={false} style={styles.progressWrap}>
      <ActivityIndicator size="large" color={colors.primaryDark} />
      <View collapsable={false} style={styles.progressTrack}>
        <View collapsable={false} style={styles.progressFill} />
      </View>
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
    // Outer View owns layout — LinearGradient is background-only so loaders
    // are not clipped by the native gradient surface under RTL/Fabric.
    <View style={[styles.splashRoot, style]}>
      <LinearGradient
        colors={[...SPLASH_GRADIENT]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.brandBlock}>
        {/* Brand mark + bilingual title */}
        <Image
          source={SPLASH_BRAND}
          style={styles.splashImage}
          resizeMode="contain"
          onLoadEnd={onLoadEnd}
        />
        {/* Indeterminate boot progress under the logo */}
        <SplashProgressBar />
      </View>
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
    direction: "ltr",
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
    width: "68%",
    maxWidth: 260,
    height: 190,
  },
  progressWrap: {
    marginTop: 24,
    width: "100%",
    alignItems: "center",
  },
  progressTrack: {
    marginTop: 14,
    width: BAR_WIDTH,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(15, 118, 110, 0.28)",
    borderWidth: 2,
    borderColor: colors.primaryDark,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: 16,
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
