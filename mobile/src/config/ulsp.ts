/** ULSP license API config for this product build. */

export const ULSP_API_BASE =
  process.env.EXPO_PUBLIC_ULSP_API_BASE?.replace(/\/$/, "") ||
  "https://ulsp.gamesspoteg.com/api/v1";

/** Product API key — prefer EXPO_PUBLIC_ULSP_API_KEY in env; fallback for this app. */
export const ULSP_API_KEY =
  process.env.EXPO_PUBLIC_ULSP_API_KEY ||
  "ulsp_KSiq8u8Hv63RP4CBRjtVk5KiWLxdfvS5";

/** Offline unlock window after last successful validate. */
export const ULSP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const ULSP_ACTIVATION_TYPE = "device_id" as const;
