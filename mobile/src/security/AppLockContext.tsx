import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  authenticateDeviceLock,
  canUseDeviceAuth,
  loadAppLockSettings,
  saveAppLockSettings,
} from "./appLock";

type AppLockContextValue = {
  ready: boolean;
  enabled: boolean;
  locked: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

/** Relock shortly after leaving the app so quick switches don't flash the UI. */
const BACKGROUND_LOCK_MS = 800;

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const bgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const settings = await loadAppLockSettings();
    setEnabledState(settings.enabled);
    setLocked(settings.enabled);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (!enabled) return;
      if (state === "active") {
        if (bgTimer.current) {
          clearTimeout(bgTimer.current);
          bgTimer.current = null;
        }
        return;
      }
      // background / inactive → schedule lock
      if (bgTimer.current) clearTimeout(bgTimer.current);
      bgTimer.current = setTimeout(() => {
        setLocked(true);
        bgTimer.current = null;
      }, BACKGROUND_LOCK_MS);
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
      if (bgTimer.current) clearTimeout(bgTimer.current);
    };
  }, [enabled]);

  const setEnabled = useCallback(async (next: boolean) => {
    if (next) {
      const okDevice = await canUseDeviceAuth();
      if (!okDevice) {
        throw new Error("no_device_auth");
      }
      const ok = await authenticateDeviceLock("تفعيل قفل التطبيق");
      if (!ok) throw new Error("auth_cancelled");
      await saveAppLockSettings({ enabled: true });
      setEnabledState(true);
      setLocked(false);
      return;
    }
    // Turning off also requires device auth so someone else can't disable it
    const ok = await authenticateDeviceLock("إيقاف قفل التطبيق");
    if (!ok) throw new Error("auth_cancelled");
    await saveAppLockSettings({ enabled: false });
    setEnabledState(false);
    setLocked(false);
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticateDeviceLock("فتح التطبيق");
    if (ok) setLocked(false);
    return ok;
  }, []);

  const value = useMemo<AppLockContextValue>(
    () => ({
      ready,
      enabled,
      locked: enabled && locked,
      setEnabled,
      unlock,
      refresh,
    }),
    [ready, enabled, locked, setEnabled, unlock, refresh]
  );

  return (
    <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) {
    throw new Error("useAppLock must be used within AppLockProvider");
  }
  return ctx;
}
