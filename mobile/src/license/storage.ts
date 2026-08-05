import * as SecureStore from "expo-secure-store";

const KEYS = {
  licenseKey: "ulsp.license_key",
  activationHash: "ulsp.activation_hash",
  lastValidatedAt: "ulsp.last_validated_at",
  expiresAt: "ulsp.expires_at",
  isTrial: "ulsp.is_trial",
  daysRemaining: "ulsp.days_remaining",
} as const;

export type LicenseLocalState = {
  licenseKey: string | null;
  activationHash: string | null;
  lastValidatedAt: string | null;
  expiresAt: string | null;
  isTrial: boolean;
  daysRemaining: number | null;
};

function parseDaysRemaining(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export async function loadLicenseState(): Promise<LicenseLocalState> {
  const [
    licenseKey,
    activationHash,
    lastValidatedAt,
    expiresAt,
    isTrialRaw,
    daysRemainingRaw,
  ] = await Promise.all([
    SecureStore.getItemAsync(KEYS.licenseKey),
    SecureStore.getItemAsync(KEYS.activationHash),
    SecureStore.getItemAsync(KEYS.lastValidatedAt),
    SecureStore.getItemAsync(KEYS.expiresAt),
    SecureStore.getItemAsync(KEYS.isTrial),
    SecureStore.getItemAsync(KEYS.daysRemaining),
  ]);
  return {
    licenseKey,
    activationHash,
    lastValidatedAt,
    expiresAt,
    isTrial: isTrialRaw === "1",
    daysRemaining: parseDaysRemaining(daysRemainingRaw),
  };
}

async function persistTrialMeta(input: {
  isTrial?: boolean | null;
  daysRemaining?: number | null;
}): Promise<void> {
  if (input.isTrial === true) {
    await SecureStore.setItemAsync(KEYS.isTrial, "1");
  } else if (input.isTrial === false) {
    await SecureStore.deleteItemAsync(KEYS.isTrial).catch(() => undefined);
  }

  if (input.daysRemaining != null && Number.isFinite(input.daysRemaining)) {
    await SecureStore.setItemAsync(
      KEYS.daysRemaining,
      String(Math.max(0, Math.floor(input.daysRemaining)))
    );
  } else if (input.daysRemaining === null) {
    await SecureStore.deleteItemAsync(KEYS.daysRemaining).catch(
      () => undefined
    );
  }
}

export async function saveLicenseActivation(input: {
  licenseKey: string;
  activationHash: string;
  expiresAt?: string | null;
  isTrial?: boolean | null;
  daysRemaining?: number | null;
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
  await persistTrialMeta({
    isTrial: input.isTrial,
    daysRemaining: input.daysRemaining,
  });
}

export async function touchLastValidated(
  expiresAt?: string | null,
  trialMeta?: { isTrial?: boolean | null; daysRemaining?: number | null }
): Promise<void> {
  await SecureStore.setItemAsync(
    KEYS.lastValidatedAt,
    new Date().toISOString()
  );
  if (expiresAt) {
    await SecureStore.setItemAsync(KEYS.expiresAt, expiresAt);
  }
  if (trialMeta) {
    await persistTrialMeta(trialMeta);
  }
}

export async function clearLicenseState(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.licenseKey).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.activationHash).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.lastValidatedAt).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.expiresAt).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.isTrial).catch(() => undefined),
    SecureStore.deleteItemAsync(KEYS.daysRemaining).catch(() => undefined),
  ]);
}

export function maskLicenseKey(key: string): string {
  const cleaned = key.trim();
  if (cleaned.length <= 8) return "••••••••";
  return `${cleaned.slice(0, 4)}…${cleaned.slice(-4)}`;
}
