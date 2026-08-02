import * as SecureStore from "expo-secure-store";

const KEYS = {
  licenseKey: "ulsp.license_key",
  activationHash: "ulsp.activation_hash",
  lastValidatedAt: "ulsp.last_validated_at",
  expiresAt: "ulsp.expires_at",
} as const;

export type LicenseLocalState = {
  licenseKey: string | null;
  activationHash: string | null;
  lastValidatedAt: string | null;
  expiresAt: string | null;
};

export async function loadLicenseState(): Promise<LicenseLocalState> {
  const [licenseKey, activationHash, lastValidatedAt, expiresAt] =
    await Promise.all([
      SecureStore.getItemAsync(KEYS.licenseKey),
      SecureStore.getItemAsync(KEYS.activationHash),
      SecureStore.getItemAsync(KEYS.lastValidatedAt),
      SecureStore.getItemAsync(KEYS.expiresAt),
    ]);
  return { licenseKey, activationHash, lastValidatedAt, expiresAt };
}

export async function saveLicenseActivation(input: {
  licenseKey: string;
  activationHash: string;
  expiresAt?: string | null;
}): Promise<void> {
  await SecureStore.setItemAsync(KEYS.licenseKey, input.licenseKey.trim());
  await SecureStore.setItemAsync(KEYS.activationHash, input.activationHash);
  await SecureStore.setItemAsync(
    KEYS.lastValidatedAt,
    new Date().toISOString()
  );
  if (input.expiresAt) {
    await SecureStore.setItemAsync(KEYS.expiresAt, input.expiresAt);
  } else {
    await SecureStore.deleteItemAsync(KEYS.expiresAt).catch(() => undefined);
  }
}

export async function touchLastValidated(
  expiresAt?: string | null
): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.lastValidatedAt,
    new Date().toISOString()
  );
  if (expiresAt) {
    await SecureStore.setItemAsync(KEYS.expiresAt, expiresAt);
  }
}

export async function clearLicenseState(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.licenseKey).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.activationHash).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.lastValidatedAt).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.expiresAt).catch(() => undefined),
  ]);
}

export function maskLicenseKey(key: string): string {
  const cleaned = key.trim();
  if (cleaned.length <= 8) return "••••••••";
  return `${cleaned.slice(0, 4)}…${cleaned.slice(-4)}`;
}
