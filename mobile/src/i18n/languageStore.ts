import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "ar" | "en";

const STORAGE_KEY = "tutor.language.v1";

/**
 * Keep preference on globalThis so Metro / Fast Refresh never create a second
 * in-memory store (that bug showed English selected while t() still returned Arabic).
 */
type LangGlobal = {
  current: AppLanguage;
  listeners: Set<() => void>;
};

const g = globalThis as typeof globalThis & { __tutorLangStore?: LangGlobal };

function store(): LangGlobal {
  if (!g.__tutorLangStore) {
    g.__tutorLangStore = {
      current: "ar",
      listeners: new Set(),
    };
  }
  return g.__tutorLangStore;
}

export function getLanguage(): AppLanguage {
  return store().current;
}

export function isRtlLanguage(lang: AppLanguage = getLanguage()): boolean {
  return lang === "ar";
}

function notify() {
  for (const l of store().listeners) l();
}

export function subscribeLanguage(listener: () => void): () => void {
  store().listeners.add(listener);
  return () => {
    store().listeners.delete(listener);
  };
}

/** Apply in-memory language without persisting (used after load). */
export function setLanguageInMemory(lang: AppLanguage): void {
  store().current = lang === "en" ? "en" : "ar";
  notify();
}

export async function loadLanguage(): Promise<AppLanguage> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "ar") {
      setLanguageInMemory(raw);
      return raw;
    }
  } catch {
    // keep default
  }
  setLanguageInMemory("ar");
  return "ar";
}

export async function persistLanguage(lang: AppLanguage): Promise<AppLanguage> {
  const next = lang === "en" ? "en" : "ar";
  await AsyncStorage.setItem(STORAGE_KEY, next);
  setLanguageInMemory(next);
  return next;
}
