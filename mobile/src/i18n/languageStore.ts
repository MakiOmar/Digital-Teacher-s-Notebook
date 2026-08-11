import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "ar" | "en";

const STORAGE_KEY = "tutor.language.v1";

let currentLanguage: AppLanguage = "ar";
const listeners = new Set<() => void>();

export function getLanguage(): AppLanguage {
  return currentLanguage;
}

export function isRtlLanguage(lang: AppLanguage = currentLanguage): boolean {
  return lang === "ar";
}

function notify() {
  for (const l of listeners) l();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Apply in-memory language without persisting (used after load). */
export function setLanguageInMemory(lang: AppLanguage): void {
  currentLanguage = lang === "en" ? "en" : "ar";
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
