import { Text, TextInput, TextStyle } from "react-native";

/** Cairo font family names from @expo-google-fonts/cairo */
export const fonts = {
  regular: "Cairo_400Regular",
  semiBold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extraBold: "Cairo_800ExtraBold",
} as const;

export const fontRegular: TextStyle = { fontFamily: fonts.regular };
export const fontSemiBold: TextStyle = {
  fontFamily: fonts.semiBold,
  fontWeight: "600",
};
export const fontBold: TextStyle = {
  fontFamily: fonts.bold,
  fontWeight: "700",
};
export const fontExtraBold: TextStyle = {
  fontFamily: fonts.extraBold,
  fontWeight: "800",
};

/** Apply Cairo as the default Text / TextInput face app-wide. */
export function applyCairoDefaults(): void {
  const base: TextStyle = { fontFamily: fonts.regular };

  // defaultProps is the reliable way to set a global face in RN
  const TextComp = Text as typeof Text & {
    defaultProps?: { style?: TextStyle | TextStyle[] };
  };
  const prevText = TextComp.defaultProps?.style;
  TextComp.defaultProps = {
    ...TextComp.defaultProps,
    style: prevText ? [prevText, base].flat() : base,
  };

  const InputComp = TextInput as typeof TextInput & {
    defaultProps?: { style?: TextStyle | TextStyle[] };
  };
  const prevInput = InputComp.defaultProps?.style;
  InputComp.defaultProps = {
    ...InputComp.defaultProps,
    style: prevInput ? [prevInput, base].flat() : base,
  };
}
