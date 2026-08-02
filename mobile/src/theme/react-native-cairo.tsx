/**
 * Re-export react-native with Text / TextInput wrapped so every label uses Cairo.
 * Metro redirects `react-native` imports here (see metro.config.js).
 */
import React from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { resolveCairoStyle } from "./typography";

export * from "react-native";

export const Text = React.forwardRef<
  React.ComponentRef<typeof RNText>,
  TextProps
>(function CairoText({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={resolveCairoStyle(style)} />;
});

export const TextInput = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  TextInputProps
>(function CairoTextInput({ style, ...rest }, ref) {
  return (
    <RNTextInput ref={ref} {...rest} style={resolveCairoStyle(style)} />
  );
});
