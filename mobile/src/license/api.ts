import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  ULSP_ACTIVATION_TYPE,
  ULSP_API_BASE,
  ULSP_API_KEY,
} from "../config/ulsp";

export type ActivateResponse = {
  data: {
    id: number;
    activation_type: string;
    activation_value: string;
    activation_hash: string;
    status: string;
    activated_at?: string;
    last_check_at?: string;
  };
};

export type ValidateResponse = {
  valid: boolean;
  reason?: string | null;
  activation_valid?: boolean;
  activations_used?: number;
  max_activations?: number;
  expires_at?: string | null;
  license?: Record<string, unknown>;
};

export type StartTrialResponse = {
  license: {
    id?: number;
    license_key: string;
    status?: string;
    is_trial?: boolean;
    max_activations?: number;
    activations_used?: number;
    purchased_at?: string | null;
    expires_at?: string | null;
    support_expires_at?: string | null;
    product?: Record<string, unknown>;
  };
  activation: {
    id?: number;
    activation_type?: string;
    activation_value?: string;
    activation_hash: string;
    device_name?: string | null;
    platform?: string | null;
    app_version?: string | null;
    status?: string;
    activated_at?: string;
    last_check_at?: string;
  };
  expires_at?: string | null;
};

export type StartTrialMeta = {
  device_name: string;
  platform: string;
  app_version: string;
};

export class UlspApiError extends Error {
  status: number;
  reason: string | null;

  constructor(message: string, status: number, reason: string | null = null) {
    super(message);
    this.name = "UlspApiError";
    this.status = status;
    this.reason = reason;
  }
}

async function postJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${ULSP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": ULSP_API_KEY,
    },
    body: JSON.stringify(body),
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const obj = (json ?? {}) as {
      message?: string;
      errors?: Record<string, string[]>;
      reason?: string;
    };
    const fieldError =
      obj.errors?.trial?.[0] ||
      obj.errors?.license_key?.[0] ||
      obj.errors?.activation_hash?.[0] ||
      obj.errors?.activation_value?.[0] ||
      obj.errors?.activation_type?.[0];
    throw new UlspApiError(
      fieldError || obj.message || `HTTP ${res.status}`,
      res.status,
      obj.reason ?? null
    );
  }

  return json as T;
}

export async function activateLicense(
  licenseKey: string,
  deviceId: string
): Promise<ActivateResponse> {
  return postJson<ActivateResponse>("/licenses/activate", {
    license_key: licenseKey.trim(),
    activation_type: ULSP_ACTIVATION_TYPE,
    activation_value: deviceId,
  });
}

export async function validateLicense(
  licenseKey: string,
  deviceId: string
): Promise<ValidateResponse> {
  return postJson<ValidateResponse>("/licenses/validate", {
    license_key: licenseKey.trim(),
    activation_type: ULSP_ACTIVATION_TYPE,
    activation_value: deviceId,
  });
}

export async function deactivateLicense(
  licenseKey: string,
  activationHash: string
): Promise<void> {
  await postJson<{ message?: string }>("/licenses/deactivate", {
    license_key: licenseKey.trim(),
    activation_hash: activationHash,
  });
}

/** Issue a product trial for this device (201) and return license + activation. */
export async function startTrialLicense(
  deviceId: string,
  meta?: Partial<StartTrialMeta>
): Promise<StartTrialResponse> {
  const platform = meta?.platform ?? Platform.OS;
  const appVersion =
    meta?.app_version ??
    Constants.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    "1.0.0";
  const deviceName = meta?.device_name ?? platform;

  return postJson<StartTrialResponse>("/licenses/start-trial", {
    activation_type: ULSP_ACTIVATION_TYPE,
    activation_value: deviceId,
    device_name: deviceName,
    platform,
    app_version: appVersion,
  });
}

export function isNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return (
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("network request failed")
    );
  }
  return false;
}

/**
 * Classify trial API errors for i18n mapping in LicenseContext.
 * Returns a code consumed by mapTrialUserMessage.
 */
export function classifyTrialError(e: UlspApiError):
  | "api_key"
  | "already_used"
  | "disabled"
  | "no_product"
  | "other" {
  const raw = (e.message || "").toLowerCase();
  if (e.status === 401) return "api_key";
  if (e.status === 422) {
    if (
      raw.includes("already been used") ||
      raw.includes("already used") ||
      raw.includes("trial has already")
    ) {
      return "already_used";
    }
    if (
      raw.includes("not enabled") ||
      raw.includes("trials are not") ||
      raw.includes("trial_days")
    ) {
      return "disabled";
    }
    if (
      raw.includes("scoped to a product") ||
      raw.includes("must be scoped")
    ) {
      return "no_product";
    }
  }
  return "other";
}
