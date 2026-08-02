import { I18nManager, TextStyle, ViewStyle } from "react-native";
import { fonts } from "./typography";

/** App is Arabic-only. Prefer explicit visual RTL that works with forceRTL. */
export const APP_RTL = true;

/** True when native layout direction is already RTL. */
export function nativeIsRtl(): boolean {
  return I18nManager.isRTL;
}

/**
 * Under I18nManager.forceRTL, Yoga swaps left/right for Text textAlign.
 * We always want glyphs pinned to the physical right edge of Arabic UI.
 */
export function visualTextAlign(): "left" | "right" {
  return nativeIsRtl() ? "left" : "right";
}

/**
 * TextInput does not flip textAlign the same way as Text under forceRTL.
 * Always use physical right. Prefer wrapping the input in `inputShell`.
 */
export function inputTextAlign(): "left" | "right" {
  return "right";
}

/** Isolate TextInput from Yoga RTL so textAlign:'right' stays on the right. */
export const inputShell: ViewStyle = {
  width: "100%",
  direction: "ltr",
};

/**
 * Horizontal row that lays out children starting from the physical right.
 * When native RTL is on, plain `row` already starts on the right;
 * when off, we use `row-reverse`.
 */
export function rtlRow(): ViewStyle {
  return {
    flexDirection: nativeIsRtl() ? "row" : "row-reverse",
  };
}

/** Chip/tag row scrolling / wrapping from the physical right. */
export function rtlChipRow(): ViewStyle {
  return {
    flexDirection: nativeIsRtl() ? "row" : "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  };
}

/** Standard Arabic body/label text — always visual right. */
export const rtlText: TextStyle = {
  textAlign: visualTextAlign(),
  writingDirection: "rtl",
  fontFamily: fonts.regular,
};

/** Full-width block so textAlign is visible. */
export const rtlBlock: ViewStyle = {
  width: "100%",
  alignSelf: "stretch",
};
