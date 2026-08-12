import React, { useEffect, useRef, useState } from "react";
import {
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
const THUMB_WIDTH = 58;
const BAR_HEIGHT = 12;
const MAX_TRAVEL = BAR_WIDTH - THUMB_WIDTH;

/**
 * Indeterminate sliding fill inside the solid track parent.
 */
function SplashProgressBar() {
  const [offset, setOffset] = useState(THUMB_WIDTH);
  const dirRef = useRef(1);
  const posRef = useRef(THUMB_WIDTH);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const speed = (BAR_WIDTH - THUMB_WIDTH) / 900;

    const tick = () => {
      const now = Date.now();
      const dt = Math.min(32, now - last);
      last = now;
      let next = posRef.current + dirRef.current * speed * dt;
      if (next >= BAR_WIDTH) {
        next = BAR_WIDTH;
        dirRef.current = -1;
      } else if (next <= THUMB_WIDTH) {
        next = THUMB_WIDTH;
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
      style={{
        width: offset,
        height: 14,
        backgroundColor: "#0F766E",
        borderRadius: 999,
      }}
    />
  );
}

/** Launch / boot splash: full brand centered on a soft brand gradient. */
export function SplashBackground({
  onLoadEnd,
  style,
  showLoader = true,
}: {
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  showLoader?: boolean;
}) {
  return (
    <View style={[styles.splashRoot, style]}>
      <LinearGradient
        colors={[...SPLASH_GRADIENT]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brandBlock}>
        {/* Brand mark + bilingual title (square 1024² asset) */}
        <Image
          source={SPLASH_BRAND}
          style={styles.splashImage}
          resizeMode="contain"
          onLoadEnd={onLoadEnd}
        />
        {/* Sliding progress bar under wordmark */}
        {showLoader ? (
          <View
            collapsable={false}
            style={styles.progressOuter}
            accessibilityRole="progressbar"
            accessibilityLabel="Loading"
          >
            <View collapsable={false} style={styles.progressTrack}>
              <SplashProgressBar />
            </View>
          </View>
        ) : null}
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
    width: "68%",
    maxWidth: 240,
    aspectRatio: 1,
  },
  progressOuter: {
    marginTop: 18,
    width: BAR_WIDTH,
    alignSelf: "center",
  },
  progressFill: {
    height: BAR_HEIGHT,
    borderRadius: 999,
    // Hardcoded — avoid theme StyleSheet edge cases on cold boot.
    backgroundColor: "#115E59",
  },
  progressTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: "rgba(15, 118, 110, 0.28)",
    borderWidth: 1.5,
    borderColor: "#115E59",
    overflow: "hidden",
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
