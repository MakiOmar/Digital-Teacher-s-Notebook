import { t } from "../i18n/ar";

/**
 * Detect transport / DNS / offline failures (including messages that leak a host/URL).
 * Safe to use from any feature — never show those raw strings in the UI.
 */
export function isNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (!(e instanceof Error)) return false;

  const msg = e.message.toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("unable to resolve host") ||
    msg.includes("unknownhost") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("socket") ||
    msg.includes("offline") ||
    msg.includes("unreachable") ||
    msg.includes("cleartext") ||
    msg.includes("ssl") ||
    msg.includes("certificate") ||
    /https?:\/\//i.test(e.message) ||
    /ulsp\./i.test(e.message)
  );
}

/**
 * Map any thrown value to a short Arabic string for alerts/toasts.
 * Network/URL leaks → offline copy; intentional Arabic business errors pass through.
 */
export function userFacingErrorMessage(
  e: unknown,
  fallback: string = t("error")
): string {
  if (isNetworkFailure(e)) return t("networkOffline");
  if (e instanceof Error) {
    const msg = e.message.trim();
    if (!msg) return fallback;
    if (/https?:\/\//i.test(msg) || /ulsp\./i.test(msg)) {
      return t("networkOffline");
    }
    return msg;
  }
  return fallback;
}
