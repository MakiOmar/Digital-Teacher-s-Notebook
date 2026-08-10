import { I18nManager, TextStyle, ViewStyle } from "react-native";
import { fonts } from "./typography";

/** True when native layout direction is RTL (persisted via I18nManager.forceRTL). */
export function nativeIsRtl(): boolean {
  return I18nManager.isRTL;
}

/** App content should follow native direction (kept in sync with preferred language). */
export function appIsRtl(): boolean {
  return I18nManager.isRTL;
}

/**
 * Align to the reading-start edge.
 * Under forceRTL, Yoga mirrors textAlign so "left" is physical right (start).
 * Under LTR, "left" is physical left (start).
 */
export function visualTextAlign(): "left" | "right" {
  return "left";
}

/**
 * TextInput does not mirror textAlign under forceRTL — use physical start.
 */
export function inputTextAlign(): "left" | "right" {
  return nativeIsRtl() ? "right" : "left";
}

export function writingDirection(): "rtl" | "ltr" {
  return nativeIsRtl() ? "rtl" : "ltr";
}

/** Isolate TextInput from Yoga RTL so textAlign stays on the physical start. */
export const inputShell: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};

/** Horizontal row following native layout direction. */
export function rtlRow(): ViewStyle {
  return {
    flexDirection: "row",
  };
}

/** Chip/tag row wrapping from the reading-start edge. */
export function rtlChipRow(): ViewStyle {
  return {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  };
}

/**
 * Body/label text aligned to reading start.
 * Resolved at access time so spreads pick up the current I18nManager direction
 * after a language-change reload (StyleSheet.create still freezes values).
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
