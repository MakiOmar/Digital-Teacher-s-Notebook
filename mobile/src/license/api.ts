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
      obj.errors?.license_key?.[0] ||
      obj.errors?.activation_hash?.[0] ||
      obj.errors?.activation_value?.[0];
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
