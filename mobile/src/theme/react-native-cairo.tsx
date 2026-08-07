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
  AppState,
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
} from "react-native";
import { resolveCairoStyle } from "./typography";

export {
  ActivityIndicator,
  AppState,
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
