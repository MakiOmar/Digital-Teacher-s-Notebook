import { Platform } from "react-native";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DEVICE_ID_KEY = "ulsp.device_id";

/** Stable per-install UUID for ULSP activation_value. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Human-readable device / phone model for ULSP `device_name`
 * (e.g. "Honor 6xb"), not the OS platform string.
 */
export function getDeviceDisplayName(): string {
  const model = Device.modelName?.trim();
  if (model) return model;

  const brand = Device.brand?.trim();
  const manufacturer = Device.manufacturer?.trim();
  if (brand && manufacturer) {
    const same =
      brand.toLowerCase() === manufacturer.toLowerCase() ||
      manufacturer.toLowerCase().includes(brand.toLowerCase());
    return same ? manufacturer : `${manufacturer} ${brand}`;
  }
  return brand || manufacturer || Platform.OS;
}
