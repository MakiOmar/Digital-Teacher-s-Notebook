import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subscribeLanguage } from "@/src/i18n/languageStore";
import {
  getCurrencyId,
  getCustomCurrencySymbol,
  getCurrencySymbol,
  loadCurrency,
  saveCurrency,
  subscribeCurrency,
  type CurrencyId,
} from "@/src/settings/currency";

type CurrencyContextValue = {
  ready: boolean;
  currencyId: CurrencyId;
  customSymbol: string;
  symbol: string;
  setCurrency: (
    id: CurrencyId,
    customSymbol?: string
  ) => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [currencyId, setCurrencyId] = useState<CurrencyId>(getCurrencyId());
  const [customSymbol, setCustomSymbol] = useState(getCustomCurrencySymbol());
  const [symbol, setSymbol] = useState(getCurrencySymbol());

  const syncFromStore = useCallback(() => {
    setCurrencyId(getCurrencyId());
    setCustomSymbol(getCustomCurrencySymbol());
    setSymbol(getCurrencySymbol());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCurrency().then(() => {
      if (!cancelled) {
        syncFromStore();
        setReady(true);
      }
    });
    const unsubCurrency = subscribeCurrency(syncFromStore);
    // Bilingual symbols (ج.م / EGP) refresh when preferred language changes.
    const unsubLanguage = subscribeLanguage(syncFromStore);
    return () => {
      cancelled = true;
      unsubCurrency();
      unsubLanguage();
    };
  }, [syncFromStore]);

  const setCurrency = useCallback(
    async (id: CurrencyId, nextCustom?: string) => {
      await saveCurrency({
        id,
        customSymbol: nextCustom !== undefined ? nextCustom : customSymbol,
      });
      syncFromStore();
    },
    [customSymbol, syncFromStore]
  );

  const value = useMemo(
    () => ({
      ready,
      currencyId,
      customSymbol,
      symbol,
      setCurrency,
    }),
    [ready, currencyId, customSymbol, symbol, setCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      ready: false,
      currencyId: getCurrencyId(),
      customSymbol: getCustomCurrencySymbol(),
      symbol: getCurrencySymbol(),
      setCurrency: async () => undefined,
    };
  }
  return ctx;
}
