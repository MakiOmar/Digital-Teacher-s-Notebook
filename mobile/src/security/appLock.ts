import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const SETTINGS_KEY = "tutor.applock.v1";

export type AppLockSettings = {
  enabled: boolean;
};

const DEFAULTS: AppLockSettings = { enabled: false };

export async function loadAppLockSettings(): Promise<AppLockSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppLockSettings>;
    return { enabled: Boolean(parsed.enabled) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAppLockSettings(
  input: Partial<AppLockSettings>
): Promise<AppLockSettings> {
  const current = await loadAppLockSettings();
  const next: AppLockSettings = { ...current, ...input };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/** Device has a PIN/pattern/password and/or biometrics enrolled. */
export async function canUseDeviceAuth(): Promise<boolean> {
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (enrolled) return true;
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/**
 * Prompt the OS lock screen (biometric and/or device PIN/password).
 * Returns true when the user unlocks successfully.
 */
export async function authenticateDeviceLock(
  promptMessage: string
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "إلغاء",
    disableDeviceFallback: false,
    // Allow device PIN/pattern/password when biometrics are unavailable
    biometricsSecurityLevel: "weak",
  });
  return result.success;
}
