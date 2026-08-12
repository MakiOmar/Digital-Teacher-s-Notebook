import React, { useEffect, useRef, useState } from "react";
import {
  I18nManager,
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

const BAR_WIDTH = 180;
const THUMB_WIDTH = 64;
const BAR_HEIGHT = 14;
const MAX_TRAVEL = BAR_WIDTH - THUMB_WIDTH;

/**
 * Indeterminate sliding thumb under the splash logo (original look).
 * Spacer row with RTL flex compensation — Yoga flips `row` under forceRTL,
 * so we use row-reverse when isRTL so [spacer][thumb] still runs left→right.
 */
function SplashProgressBar() {
  const [offset, setOffset] = useState(0);
  const dirRef = useRef(1);
  const posRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const speed = MAX_TRAVEL / 1050;

    const tick = () => {
      const now = Date.now();
      const dt = Math.min(32, now - last);
      last = now;
      let next = posRef.current + dirRef.current * speed * dt;
      if (next >= MAX_TRAVEL) {
        next = MAX_TRAVEL;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      posRef.current = next;
      setOffset(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <View
      collapsable={false}
      style={[
        styles.progressTrack,
        // Undo Yoga's RTL flex flip so the thumb slides left→right physically.
        { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {/* Leading spacer drives the thumb across the track */}
      <View
        collapsable={false}
        style={{ width: offset, height: BAR_HEIGHT, flexShrink: 0 }}
      />
      {/* Sliding thumb — original indeterminate bar (not a spinner). */}
      <View collapsable={false} style={styles.progressThumb} />
    </View>
  );
}

/** Launch / boot splash: full brand centered on a soft brand gradient. */
export function SplashBackground({
  onLoadEnd,
  style,
  /** When false, brand only (matches native windowBackground — no second flash). */
  showLoader = true,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  showLoader?: boolean;
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
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brandBlock}>
        {/* Brand mark + bilingual title (asset is square 1024²) */}
        <Image
          source={SPLASH_BRAND}
          style={styles.splashImage}
          resizeMode="contain"
          onLoadEnd={onLoadEnd}
        />
        {/* Always below the full image — never overlap Arabic/English text */}
        {showLoader ? <SplashProgressBar /> : null}
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
    aspectRatio: 1,
  },
  progressTrack: {
    // Clear gap under the square wordmark (no negative margin — that covered Arabic).
    marginTop: 20,
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: "rgba(15, 118, 110, 0.4)",
    overflow: "hidden",
    alignSelf: "center",
  },
  progressThumb: {
    width: THUMB_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    flexShrink: 0,
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
