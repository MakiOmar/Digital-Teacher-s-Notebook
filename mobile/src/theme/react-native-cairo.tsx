/**
 * Re-export react-native with Text / TextInput wrapped so every label uses Cairo.
 * Metro redirects app `react-native` imports here (see metro.config.js).
 *
 * Do NOT `export * from "react-native"` — that eagerly reads deprecated getters
 * (Clipboard, ProgressBarAndroid, SafeAreaView, …) and floods yellow boxes.
 */
import React from "react";
import * as ReactNative from "react-native";
import type { TextInputProps, TextProps } from "react-native";
import { resolveCairoStyle } from "./typography";

type RN = typeof ReactNative;

const RNText = ReactNative.Text;
const RNTextInput = ReactNative.TextInput;

const Text = React.forwardRef<
  React.ComponentRef<typeof RNText>,
  TextProps
>(function CairoText({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={resolveCairoStyle(style)} />;
});

const TextInput = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  TextInputProps
>(function CairoTextInput({ style, ...rest }, ref) {
  return (
    <RNTextInput ref={ref} {...rest} style={resolveCairoStyle(style)} />
  );
});

const cairoNative: RN = new Proxy(ReactNative, {
  get(target, prop, receiver) {
    if (prop === "Text") return Text;
    if (prop === "TextInput") return TextInput;
    if (prop === "default") return receiver;
    return Reflect.get(target, prop, receiver);
  },
}) as RN;

// CommonJS-shaped export so `import { View } from "react-native"` only reads
// the properties that are actually used (via Proxy get).
module.exports = cairoNative;
export default cairoNative;
