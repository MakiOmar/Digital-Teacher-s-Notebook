/**
 * Re-export react-native with Text / TextInput wrapped so every label uses Cairo.
 * Metro redirects app `react-native` imports here (see metro.config.js).
 *
 * Explicit named exports only — NOT `export *` (that enumerates deprecated RN
 * getters and floods LogBox) and NOT a CJS Proxy (Metro named imports then
 * resolve as undefined → FlatList crashes).
 *
 * Theme files must resolve to real RN (not this shim) to avoid a require cycle.
 */
import React from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  DevSettings,
  Easing,
  FlatList,
  I18nManager,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput as RNTextInput,
  View,
  useColorScheme,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { getLanguage } from "@/src/i18n/languageStore";
import { resolveCairoStyle } from "./typography";

export {
  ActivityIndicator,
  Animated,
  AppState,
  DevSettings,
  Easing,
  FlatList,
  I18nManager,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useColorScheme,
  useWindowDimensions,
};

export type {
  AppStateStatus,
  ImageSourcePropType,
  KeyboardEvent,
  StyleProp,
  TextInputProps,
  TextProps,
  TextStyle,
  ViewStyle,
} from "react-native";

function preferredRtl(): boolean {
  return getLanguage() === "ar";
}

/**
 * Physical start for preferred language, compensating for Yoga mirroring
 * when I18nManager.isRTL has not flipped yet.
 */
function preferredTextAlign(): "left" | "right" {
  const wantRtl = preferredRtl();
  if (wantRtl) {
    return I18nManager.isRTL ? "left" : "right";
  }
  return I18nManager.isRTL ? "right" : "left";
}

function preferredWritingDirection(): "rtl" | "ltr" {
  return preferredRtl() ? "rtl" : "ltr";
}

function withReadingDirection(
  style: StyleProp<TextStyle> | undefined
): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const align = flat?.textAlign;
  // Keep intentional center / justify; replace edge-aligned text with language start.
  if (align === "center" || align === "justify") {
    return [
      style,
      { writingDirection: preferredWritingDirection() },
    ];
  }
  return [
    style,
    {
      writingDirection: preferredWritingDirection(),
      textAlign: preferredTextAlign(),
    },
  ];
}

export const Text = React.forwardRef<
  React.ComponentRef<typeof RNText>,
  TextProps
>(function CairoText({ style, ...rest }, ref) {
  return (
    <RNText
      ref={ref}
      {...rest}
      style={resolveCairoStyle(withReadingDirection(style))}
    />
  );
});

export const TextInput = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  TextInputProps
>(function CairoTextInput({ style, textAlign, ...rest }, ref) {
  const wantRtl = preferredRtl();
  const physical = wantRtl ? "right" : "left";
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      textAlign={textAlign ?? physical}
      style={resolveCairoStyle([
        style,
        {
          writingDirection: preferredWritingDirection(),
          textAlign: textAlign ?? physical,
        },
      ])}
    />
  );
});
