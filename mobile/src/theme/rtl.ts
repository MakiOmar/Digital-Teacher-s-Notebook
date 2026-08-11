import { I18nManager, TextStyle, ViewStyle } from "react-native";
import { getLanguage } from "@/src/i18n/languageStore";
import { fonts } from "./typography";

/** Preferred UI direction from saved language (source of truth for text). */
export function appIsRtl(): boolean {
  return getLanguage() === "ar";
}

/** Native Yoga / chrome direction (may lag until forceRTL + reload). */
export function nativeIsRtl(): boolean {
  return I18nManager.isRTL;
}

/**
 * Physical reading-start edge for the preferred language.
 * Compensates when I18nManager.isRTL has not caught up yet.
 */
export function visualTextAlign(): "left" | "right" {
  const wantRtl = appIsRtl();
  if (wantRtl) {
    // Arabic → physical right
    return nativeIsRtl() ? "left" : "right";
  }
  // English → physical left
  return nativeIsRtl() ? "right" : "left";
}

/** TextInput ignores Yoga mirroring — always use physical start. */
export function inputTextAlign(): "left" | "right" {
  return appIsRtl() ? "right" : "left";
}

export function writingDirection(): "rtl" | "ltr" {
  return appIsRtl() ? "rtl" : "ltr";
}

/** Isolate TextInput from Yoga RTL so textAlign stays on the physical start. */
export const inputShell: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};

/**
 * Horizontal row in reading order.
 * If native RTL lags the preferred language, reverse so items still start correctly.
 */
export function rtlRow(): ViewStyle {
  return {
    flexDirection: appIsRtl() === nativeIsRtl() ? "row" : "row-reverse",
  };
}

/** Chip/tag wrap from the reading-start edge. */
export function rtlChipRow(): ViewStyle {
  return {
    flexDirection: appIsRtl() === nativeIsRtl() ? "row" : "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  };
}

/**
 * Body/label reading direction. Prefer applying via Cairo Text at render,
 * but keep getters for StyleSheet spreads that resolve at access time.
 */
export const rtlText: TextStyle = {
  get textAlign() {
    return visualTextAlign();
  },
  get writingDirection() {
    return writingDirection();
  },
  fontFamily: fonts.regular,
};

/** Full-width block so textAlign is visible. */
export const rtlBlock: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};

/** @deprecated Prefer appIsRtl(). */
export const APP_RTL = true;
