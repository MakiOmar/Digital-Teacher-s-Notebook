import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import { reloadAppAsync } from "expo";

export type AppLanguage = "ar" | "en";

const STORAGE_KEY = "tutor.language.v1";
const LAYOUT_RELOAD_KEY = "tutoring.lang.layout.reload.v2";

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

function applyLayoutDirection(wantRtl: boolean): void {
  // Keep allowRTL true so we can switch Arabic ↔ English later.
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);
}

/**
 * Persist language and align native RTL/LTR.
 * Reloads once when layout direction must change (production).
 */
export async function saveLanguage(
  lang: AppLanguage,
  options?: { reloadIfNeeded?: boolean }
): Promise<{ reloaded: boolean }> {
  const next = lang === "en" ? "en" : "ar";
  await AsyncStorage.setItem(STORAGE_KEY, next);
  setLanguageInMemory(next);

  const wantRtl = isRtlLanguage(next);
  const needsFlip = I18nManager.isRTL !== wantRtl;
  applyLayoutDirection(wantRtl);

  if (!needsFlip) {
    return { reloaded: false };
  }

  if (options?.reloadIfNeeded === false || __DEV__) {
    // Dev: avoid ANR from full reload; strings still update via t().
    return { reloaded: false };
  }

  const token = `${next}:${wantRtl ? "rtl" : "ltr"}`;
  await AsyncStorage.setItem(LAYOUT_RELOAD_KEY, token);
  await reloadAppAsync();
  return { reloaded: true };
}

/** Boot: load preference and force matching layout direction. */
export async function bootstrapLanguageLayout(): Promise<{
  language: AppLanguage;
  rtlReady: boolean;
}> {
  const language = await loadLanguage();
  const wantRtl = isRtlLanguage(language);
  applyLayoutDirection(wantRtl);

  if (I18nManager.isRTL === wantRtl) {
    return { language, rtlReady: true };
  }

  if (__DEV__) {
    return { language, rtlReady: true };
  }

  const token = `${language}:${wantRtl ? "rtl" : "ltr"}`;
  const already = await AsyncStorage.getItem(LAYOUT_RELOAD_KEY);
  // Avoid infinite reload if native still forces RTL (misconfigured APK).
  if (already === token) {
    return { language, rtlReady: true };
  }
  await AsyncStorage.setItem(LAYOUT_RELOAD_KEY, token);
  await reloadAppAsync();
  return { language, rtlReady: false };
}
