import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadGeneralSettings,
  saveGeneralSettings,
  type GeneralSettings,
  type PageSizeOption,
} from "./generalSettings";

type GeneralSettingsContextValue = {
  ready: boolean;
  pageSize: PageSizeOption;
  settings: GeneralSettings;
  setPageSize: (pageSize: PageSizeOption) => Promise<void>;
  refresh: () => Promise<void>;
};

const GeneralSettingsContext = createContext<GeneralSettingsContextValue | null>(
  null
);

export function GeneralSettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings>({ pageSize: 25 });

  const refresh = useCallback(async () => {
    const next = await loadGeneralSettings();
    setSettings(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPageSize = useCallback(async (pageSize: PageSizeOption) => {
    const next = await saveGeneralSettings({ pageSize });
    setSettings(next);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      pageSize: settings.pageSize,
      settings,
      setPageSize,
      refresh,
    }),
    [ready, settings, setPageSize, refresh]
  );

  return (
    <GeneralSettingsContext.Provider value={value}>
      {children}
    </GeneralSettingsContext.Provider>
  );
}

export function useGeneralSettings(): GeneralSettingsContextValue {
  const ctx = useContext(GeneralSettingsContext);
  if (!ctx) {
    throw new Error("useGeneralSettings must be used within GeneralSettingsProvider");
  }
  return ctx;
}
