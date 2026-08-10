import { I18nManager, TextStyle, ViewStyle } from "react-native";
import { fonts } from "./typography";

/** Prefer layout direction from I18nManager (kept in sync with preferred language). */
export function appIsRtl(): boolean {
  return I18nManager.isRTL;
}

/** True when native layout direction is already RTL. */
export function nativeIsRtl(): boolean {
  return I18nManager.isRTL;
}

/**
 * Align to the reading-start edge.
 * Under forceRTL, Yoga mirrors textAlign so "left" is the physical right (start).
 * Under LTR, "left" is the physical left (start).
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

/** Isolate TextInput from Yoga RTL so textAlign stays on the physical start. */
export const inputShell: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};

/**
 * Horizontal row that follows native layout direction (RTL → starts on the right).
 */
export function rtlRow(): ViewStyle {
  return {
    flexDirection: "row",
  };
}

/** Chip/tag row scrolling / wrapping from the reading-start edge. */
export function rtlChipRow(): ViewStyle {
  return {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  };
}

/** Standard body/label text aligned to reading start. */
export const rtlText: TextStyle = {
  textAlign: visualTextAlign(),
  writingDirection: nativeIsRtl() ? "rtl" : "ltr",
  fontFamily: fonts.regular,
};

/** Full-width block so textAlign is visible. */
export const rtlBlock: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};

/** @deprecated Use appIsRtl(); kept for older imports. */
export const APP_RTL = true;
