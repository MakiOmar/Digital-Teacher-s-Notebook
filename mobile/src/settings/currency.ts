import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLanguage } from "@/src/i18n/languageStore";

export type CurrencyId = "EGP" | "SAR" | "AED" | "USD" | "EUR" | "custom";

export type CurrencyPreset = {
  id: Exclude<CurrencyId, "custom">;
  /** Short Arabic label / symbol */
  ar: string;
  /** Short English label / symbol */
  en: string;
};

/** Built-in currencies; user can also pick custom. */
export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { id: "EGP", ar: "ج.م", en: "EGP" },
  { id: "SAR", ar: "ر.س", en: "SAR" },
  { id: "AED", ar: "د.إ", en: "AED" },
  { id: "USD", ar: "$", en: "USD" },
  { id: "EUR", ar: "€", en: "EUR" },
];

const STORAGE_KEY = "tutor.currency.v1";

type CurrencyState = {
  id: CurrencyId;
  customSymbol: string;
};

type CurrencyGlobal = {
  state: CurrencyState;
  listeners: Set<() => void>;
};

const g = globalThis as typeof globalThis & {
  __tutorCurrencyStore?: CurrencyGlobal;
};

const DEFAULT_STATE: CurrencyState = {
  id: "EGP",
  customSymbol: "",
};

function store(): CurrencyGlobal {
  if (!g.__tutorCurrencyStore) {
    g.__tutorCurrencyStore = {
      state: { ...DEFAULT_STATE },
      listeners: new Set(),
    };
  }
  return g.__tutorCurrencyStore;
}

function notify() {
  for (const l of store().listeners) l();
}

export function getCurrencyId(): CurrencyId {
  return store().state.id;
}

export function getCustomCurrencySymbol(): string {
  return store().state.customSymbol;
}

/** Display symbol for the active language. */
export function getCurrencySymbol(): string {
  const { id, customSymbol } = store().state;
  if (id === "custom") {
    const trimmed = customSymbol.trim();
    return trimmed || (getLanguage() === "en" ? "EGP" : "ج.م");
  }
  const preset = CURRENCY_PRESETS.find((p) => p.id === id);
  if (!preset) return getLanguage() === "en" ? "EGP" : "ج.م";
  return getLanguage() === "en" ? preset.en : preset.ar;
}

export function subscribeCurrency(listener: () => void): () => void {
  store().listeners.add(listener);
  return () => {
    store().listeners.delete(listener);
  };
}

export function setCurrencyInMemory(next: CurrencyState): void {
  store().state = {
    id: next.id,
    customSymbol: next.customSymbol ?? "",
  };
  notify();
}

function normalizeId(value: unknown): CurrencyId {
  if (
    value === "EGP" ||
    value === "SAR" ||
    value === "AED" ||
    value === "USD" ||
    value === "EUR" ||
    value === "custom"
  ) {
    return value;
  }
  return DEFAULT_STATE.id;
}

export async function loadCurrency(): Promise<CurrencyState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setCurrencyInMemory(DEFAULT_STATE);
      return { ...DEFAULT_STATE };
    }
    const parsed = JSON.parse(raw) as Partial<CurrencyState>;
    const next: CurrencyState = {
      id: normalizeId(parsed.id),
      customSymbol:
        typeof parsed.customSymbol === "string" ? parsed.customSymbol : "",
    };
    setCurrencyInMemory(next);
    return next;
  } catch {
    setCurrencyInMemory(DEFAULT_STATE);
    return { ...DEFAULT_STATE };
  }
}

export async function saveCurrency(
  input: Partial<CurrencyState>
): Promise<CurrencyState> {
  const current = await loadCurrency();
  const next: CurrencyState = {
    id: input.id !== undefined ? normalizeId(input.id) : current.id,
    customSymbol:
      input.customSymbol !== undefined
        ? String(input.customSymbol)
        : current.customSymbol,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setCurrencyInMemory(next);
  return next;
}
