import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DEVICE_ID_KEY = "ulsp.device_id";

/**
 * Stable ULSP `activation_value` across app reinstalls when the OS allows it.
 *
 * - Android: `Settings.Secure.ANDROID_ID` (survives uninstall; changes on factory reset / signing key).
 * - iOS: Keychain via SecureStore (may survive reinstall); seed with IDFV when available.
 *
 * Do not use a random UUID stored only in app storage — that resets on uninstall and
 * allows a new trial every reinstall.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (Platform.OS === "android") {
    const androidId = Application.getAndroidId()?.trim();
    if (androidId) {
      // Cache for debugging / parity; source of truth is ANDROID_ID
      await SecureStore.setItemAsync(DEVICE_ID_KEY, androidId).catch(
        () => undefined
      );
      return androidId;
    }
  }

  // iOS / fallback: Keychain-backed id (SecureStore) so it can survive reinstall when OS keeps keychain
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();

  let idfv: string | null = null;
  if (Platform.OS === "ios") {
    try {
      idfv = await Application.getIosIdForVendorAsync();
    } catch {
      idfv = null;
    }
  }

  const id = idfv?.trim() || Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Android `Build.MODEL` is often a hardware code (e.g. JDY-LX2), not the
 * retail name. Map known codes → marketing labels for ULSP `device_name`.
 * Keys are uppercased for lookup.
 */
const MARKETING_MODEL_NAMES: Record<string, string> = {
  "JDY-LX2": "Honor X6b",
};

function prettyBrand(brand: string): string {
  const b = brand.trim();
  if (!b) return "";
  // HONOR / honor → Honor
  return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

/**
 * Human-readable device / phone model for ULSP `device_name`
 * (prefer “Honor X6b” over bare “JDY-LX2”).
 */
export function getDeviceDisplayName(): string {
  const model = Device.modelName?.trim() || "";
  const brand = Device.brand?.trim() || "";
  const manufacturer = Device.manufacturer?.trim() || "";

  if (model) {
    const mapped = MARKETING_MODEL_NAMES[model.toUpperCase()];
    if (mapped) return mapped;

    const label = prettyBrand(brand) || prettyBrand(manufacturer);
    if (label && !model.toLowerCase().includes(label.toLowerCase())) {
      return `${label} ${model}`;
    }
    return model;
  }

  if (brand && manufacturer) {
    const same =
      brand.toLowerCase() === manufacturer.toLowerCase() ||
      manufacturer.toLowerCase().includes(brand.toLowerCase());
    return same ? prettyBrand(manufacturer) : `${prettyBrand(manufacturer)} ${prettyBrand(brand)}`;
  }
  return prettyBrand(brand) || prettyBrand(manufacturer) || Platform.OS;
}
