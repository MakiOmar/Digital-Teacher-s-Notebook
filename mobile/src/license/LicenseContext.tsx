import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ULSP_GRACE_MS } from "../config/ulsp";
import { t } from "../i18n/ar";
import {
  activateLicense,
  classifyTrialError,
  deactivateLicense,
  isNetworkFailure,
  startTrialLicense,
  UlspApiError,
  validateLicense,
} from "./api";
import { getOrCreateDeviceId } from "./deviceId";
import {
  clearLicenseState,
  loadLicenseState,
  maskLicenseKey,
  saveLicenseActivation,
  touchLastValidated,
  type LicenseLocalState,
} from "./storage";

export type LicenseStatus = "loading" | "locked" | "unlocked";

type LicenseContextValue = {
  status: LicenseStatus;
  ready: boolean;
  licenseKeyMasked: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lockReason: string | null;
  activate: (licenseKey: string) => Promise<void>;
  startTrial: () => Promise<void>;
  refresh: () => Promise<void>;
  removeLicense: () => Promise<void>;
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

function reasonMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "license_not_found":
      return t("licenseReasonNotFound");
    case "license_suspended":
      return t("licenseReasonSuspended");
    case "license_cancelled":
      return t("licenseReasonCancelled");
    case "license_expired":
      return t("licenseReasonExpired");
    default:
      return t("licenseInvalid");
  }
}

function withinGrace(lastValidatedAt: string | null): boolean {
  if (!lastValidatedAt) return false;
  const ts = Date.parse(lastValidatedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= ULSP_GRACE_MS;
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>("loading");
  const [local, setLocal] = useState<LicenseLocalState>({
    licenseKey: null,
    activationHash: null,
    lastValidatedAt: null,
    expiresAt: null,
  });
  const [lockReason, setLockReason] = useState<string | null>(null);

  const applyUnlocked = useCallback(async (state: LicenseLocalState) => {
    setLocal(state);
    setLockReason(null);
    setStatus("unlocked");
  }, []);

  const applyLocked = useCallback(
    (state: LicenseLocalState, reason: string | null) => {
      setLocal(state);
      setLockReason(reason);
      setStatus("locked");
    },
    []
  );

  const refresh = useCallback(async () => {
    const state = await loadLicenseState();
    setLocal(state);

    if (!state.licenseKey) {
      applyLocked(state, null);
      return;
    }

    const deviceId = await getOrCreateDeviceId();

    try {
      const result = await validateLicense(state.licenseKey, deviceId);
      const ok =
        result.valid === true &&
        (result.activation_valid === undefined ||
          result.activation_valid === true);

      if (ok) {
        await touchLastValidated(result.expires_at ?? null);
        const next = await loadLicenseState();
        await applyUnlocked(next);
        return;
      }

      // Device not registered — try re-activate then re-check
      if (result.valid && result.activation_valid === false) {
        try {
          const act = await activateLicense(state.licenseKey, deviceId);
          await saveLicenseActivation({
            licenseKey: state.licenseKey,
            activationHash: act.data.activation_hash,
            expiresAt: result.expires_at ?? state.expiresAt,
          });
          const next = await loadLicenseState();
          await applyUnlocked(next);
          return;
        } catch {
          applyLocked(state, t("licenseDeviceNotRegistered"));
          return;
        }
      }

      applyLocked(state, reasonMessage(result.reason));
    } catch (e) {
      if (isNetworkFailure(e) && withinGrace(state.lastValidatedAt)) {
        await applyUnlocked(state);
        return;
      }
      if (isNetworkFailure(e)) {
        applyLocked(state, t("licenseGraceExpired"));
        return;
      }
      if (e instanceof UlspApiError) {
        applyLocked(state, e.message || reasonMessage(e.reason));
        return;
      }
      applyLocked(
        state,
        e instanceof Error ? e.message : t("licenseInvalid")
      );
    }
  }, [applyLocked, applyUnlocked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activate = useCallback(
    async (licenseKey: string) => {
      const key = licenseKey.trim();
      if (!key) throw new Error(t("licenseKeyRequired"));

      const deviceId = await getOrCreateDeviceId();
      try {
        const act = await activateLicense(key, deviceId);
        let expiresAt: string | null = null;
        try {
          const v = await validateLicense(key, deviceId);
          expiresAt = v.expires_at ?? null;
        } catch {
          // activation succeeded; validate optional for expires_at
        }
        await saveLicenseActivation({
          licenseKey: key,
          activationHash: act.data.activation_hash,
          expiresAt,
        });
        const next = await loadLicenseState();
        await applyUnlocked(next);
      } catch (e) {
        if (e instanceof UlspApiError) {
          throw new Error(e.message || reasonMessage(e.reason));
        }
        if (isNetworkFailure(e)) {
          throw new Error(t("licenseNetworkError"));
        }
        throw e instanceof Error ? e : new Error(t("licenseInvalid"));
      }
    },
    [applyUnlocked]
  );

  const startTrial = useCallback(async () => {
    const deviceId = await getOrCreateDeviceId();
    try {
      const res = await startTrialLicense(deviceId);
      const licenseKey = res.license?.license_key?.trim();
      const activationHash = res.activation?.activation_hash?.trim();
      if (!licenseKey || !activationHash) {
        throw new Error(t("licenseInvalid"));
      }

      let expiresAt =
        res.expires_at ?? res.license.expires_at ?? null;
      try {
        const v = await validateLicense(licenseKey, deviceId);
        expiresAt = v.expires_at ?? expiresAt;
      } catch {
        // Trial issued; validate optional for freshest expires_at
      }

      await saveLicenseActivation({
        licenseKey,
        activationHash,
        expiresAt,
      });
      const next = await loadLicenseState();
      await applyUnlocked(next);
    } catch (e) {
      if (isNetworkFailure(e)) {
        throw new Error(t("licenseNetworkError"));
      }
      if (e instanceof UlspApiError) {
        switch (classifyTrialError(e)) {
          case "api_key":
            throw new Error(t("licenseTrialApiKey"));
          case "already_used":
            throw new Error(t("licenseTrialAlreadyUsed"));
          case "disabled":
            throw new Error(t("licenseTrialDisabled"));
          case "no_product":
            throw new Error(t("licenseTrialNoProduct"));
          default:
            throw new Error(e.message || t("licenseInvalid"));
        }
      }
      throw e instanceof Error ? e : new Error(t("licenseInvalid"));
    }
  }, [applyUnlocked]);

  const removeLicense = useCallback(async () => {
    const state = await loadLicenseState();
    if (state.licenseKey && state.activationHash) {
      try {
        await deactivateLicense(state.licenseKey, state.activationHash);
      } catch {
        // Still clear locally if API fails (e.g. already deactivated)
      }
    }
    await clearLicenseState();
    const next = await loadLicenseState();
    applyLocked(next, null);
  }, [applyLocked]);

  const value = useMemo<LicenseContextValue>(
    () => ({
      status,
      ready: status !== "loading",
      licenseKeyMasked: local.licenseKey
        ? maskLicenseKey(local.licenseKey)
        : null,
      expiresAt: local.expiresAt,
      lastValidatedAt: local.lastValidatedAt,
      lockReason,
      activate,
      startTrial,
      refresh,
      removeLicense,
    }),
    [
      status,
      local.licenseKey,
      local.expiresAt,
      local.lastValidatedAt,
      lockReason,
      activate,
      startTrial,
      refresh,
      removeLicense,
    ]
  );

  return (
    <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error("useLicense must be used within LicenseProvider");
  }
  return ctx;
}
