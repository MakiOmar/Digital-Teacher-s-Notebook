/**
 * Force Cairo on shared text styles.
 * Weight ladder: Regular / SemiBold / Bold only (ExtraBold removed to shrink the APK).
 */
import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";

/** Cairo font family names from @expo-google-fonts/cairo (3 faces). */
export const fonts = {
  regular: "Cairo_400Regular",
  semiBold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  /** @deprecated Maps to bold — ExtraBold font file is no longer bundled. */
  extraBold: "Cairo_700Bold",
} as const;

export const fontRegular: TextStyle = { fontFamily: fonts.regular };
export const fontSemiBold: TextStyle = {
  fontFamily: fonts.semiBold,
  // Guard: during Metro resolve edge-cases Platform can be briefly undefined.
  fontWeight: Platform?.OS === "android" ? "normal" : "600",
};
export const fontBold: TextStyle = {
  fontFamily: fonts.bold,
  fontWeight: Platform?.OS === "android" ? "normal" : "700",
};
export const fontExtraBold: TextStyle = {
  fontFamily: fonts.bold,
  fontWeight: Platform?.OS === "android" ? "normal" : "700",
};

const CAIRO_FAMILIES = new Set<string>([
  fonts.regular,
  fonts.semiBold,
  fonts.bold,
]);

/** Map RN fontWeight → the matching Cairo face file. */
export function cairoFamilyForWeight(
  weight?: TextStyle["fontWeight"]
): string {
  const w = String(weight ?? "400").toLowerCase();
  if (w === "bold" || w === "700" || w === "800" || w === "900") {
    return fonts.bold;
  }
  if (w === "600" || w === "500" || w === "semibold" || w === "medium") {
    return fonts.semiBold;
  }
  return fonts.regular;
}

/**
 * Force Cairo on any text style.
 * On Android, pairing a custom fontFamily with fontWeight often falls back to
 * Roboto — so we pick the bold face file and reset weight to normal.
 */
export function resolveCairoStyle(
  style: StyleProp<TextStyle> | undefined
): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? ({} as TextStyle);
  const existingFamily =
    typeof flat.fontFamily === "string" ? flat.fontFamily : undefined;

  // Honor an explicit non-Cairo family (e.g. icon fonts) if one was set
  if (existingFamily && !CAIRO_FAMILIES.has(existingFamily)) {
    const looksSystem =
      /^(system|sans-serif|roboto|arial|helvetica)/i.test(existingFamily);
    if (!looksSystem) {
      return style;
    }
  }

  let family = cairoFamilyForWeight(flat.fontWeight);
  if (
    existingFamily &&
    CAIRO_FAMILIES.has(existingFamily) &&
    (!flat.fontWeight ||
      flat.fontWeight === "normal" ||
      flat.fontWeight === "400")
  ) {
    family = existingFamily;
  }

  if (Platform?.OS === "android") {
    return [style, { fontFamily: family, fontWeight: "normal" }];
  }
  return [style, { fontFamily: family }];
}
