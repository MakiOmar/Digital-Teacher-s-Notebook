import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getLanguage,
  loadLanguage,
  saveLanguage,
  subscribeLanguage,
  type AppLanguage,
} from "@/src/i18n/language";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getLanguage());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLanguage().then((lang) => {
      if (!cancelled) {
        setLanguageState(lang);
        setReady(true);
      }
    });
    return subscribeLanguage(() => {
      setLanguageState(getLanguage());
    });
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    await saveLanguage(lang);
    setLanguageState(getLanguage());
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage, ready }),
    [language, setLanguage, ready]
  );

  return (
    <LanguageContext.Provider value={value}>
      {/* Remount on language change so every screen re-runs t() and Cairo text dir */}
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
