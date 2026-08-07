/**
 * Re-export react-native with Text / TextInput wrapped so every label uses Cairo.
 * Metro redirects app `react-native` imports here (see metro.config.js).
 *
 * Why a Proxy (not `export *`):
 * React Refresh enumerates exports and touches every key. RN's deprecated getters
 * (ProgressBarAndroid, SafeAreaView, Clipboard, …) call warnOnce on access —
 * `export *` floods LogBox. The Proxy still forwards real APIs (FlatList, …)
 * but omits those keys from enumeration and never invokes their getters.
 *
 * Theme files must resolve to real RN (not this shim) to avoid a require cycle.
 */
import React from "react";
import type { TextInputProps, TextProps } from "react-native";
import { resolveCairoStyle } from "./typography";

// Real package — Metro does not redirect because this file lives under src/theme/
const RN = require("react-native") as typeof import("react-native") &
  Record<string | symbol, unknown>;

const RNText = RN.Text;
const RNTextInput = RN.TextInput;

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

/** Keys whose RN getters warn or throw — never touch them via this shim. */
const SKIP_KEYS = new Set<string | symbol>([
  "ProgressBarAndroid",
  "SafeAreaView",
  "Clipboard",
  "InteractionManager",
  "PushNotificationIOS",
  // DEV getters that `invariant(false)` if touched:
  "AsyncStorage",
  "ImagePickerIOS",
  "ProgressViewIOS",
  "DatePickerIOS",
  "Slider",
]);

const shim = new Proxy(RN, {
  get(target, prop, receiver) {
    if (prop === "Text") return Text;
    if (prop === "TextInput") return TextInput;
    if (prop === "__esModule") return true;
    if (prop === "default") return receiver;
    if (SKIP_KEYS.has(prop)) return undefined;
    return Reflect.get(target, prop, receiver);
  },
  has(target, prop) {
    if (prop === "Text" || prop === "TextInput" || prop === "__esModule") {
      return true;
    }
    if (SKIP_KEYS.has(prop)) return false;
    return Reflect.has(target, prop);
  },
  ownKeys(target) {
    return Reflect.ownKeys(target).filter((k) => !SKIP_KEYS.has(k));
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === "Text") {
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Text,
      };
    }
    if (prop === "TextInput") {
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: TextInput,
      };
    }
    if (prop === "__esModule") {
      return {
        configurable: true,
        enumerable: false,
        writable: false,
        value: true,
      };
    }
    if (SKIP_KEYS.has(prop)) return undefined;
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
});

// CJS-only export — avoids `export *` reifying every deprecated RN getter.
module.exports = shim;
