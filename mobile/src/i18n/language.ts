import AsyncStorage from "@react-native-async-storage/async-storage";
import { DevSettings, I18nManager } from "react-native";
import { reloadAppAsync } from "expo";
import {
  isRtlLanguage,
  loadLanguage,
  persistLanguage,
  type AppLanguage,
} from "@/src/i18n/languageStore";

export type { AppLanguage } from "@/src/i18n/languageStore";
export {
  getLanguage,
  isRtlLanguage,
  loadLanguage,
  setLanguageInMemory,
  subscribeLanguage,
} from "@/src/i18n/languageStore";

const LAYOUT_RELOAD_KEY = "tutoring.lang.layout.reload.v3";
const LAYOUT_RETRY_KEY = "tutoring.lang.layout.retry.v3";

function applyLayoutDirection(wantRtl: boolean): void {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);
}

async function reloadForLayout(): Promise<void> {
  // DevSettings.reload is safer with Metro than expo reloadAppAsync (avoids ANR).
  if (__DEV__ && typeof DevSettings?.reload === "function") {
    DevSettings.reload();
    return;
  }
  await reloadAppAsync();
}

/**
 * Persist language and align native RTL/LTR.
 * Reloads when layout direction must change so tabs / Yoga mirror correctly.
 */
export async function saveLanguage(
  lang: AppLanguage,
  options?: { reloadIfNeeded?: boolean }
): Promise<{ reloaded: boolean }> {
  const next = await persistLanguage(lang);

  const wantRtl = isRtlLanguage(next);
  const needsFlip = I18nManager.isRTL !== wantRtl;
  applyLayoutDirection(wantRtl);

  if (!needsFlip) {
    await AsyncStorage.multiRemove([LAYOUT_RETRY_KEY]).catch(() => undefined);
    return { reloaded: false };
  }

  if (options?.reloadIfNeeded === false) {
    return { reloaded: false };
  }

  await AsyncStorage.setItem(LAYOUT_RETRY_KEY, "0");
  const token = `${next}:${wantRtl ? "rtl" : "ltr"}`;
  await AsyncStorage.setItem(LAYOUT_RELOAD_KEY, token);
  await reloadForLayout();
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
    await AsyncStorage.multiRemove([LAYOUT_RETRY_KEY]).catch(() => undefined);
    return { language, rtlReady: true };
  }

  // Retry reload up to twice if native direction still mismatches.
  let attempts = 0;
  try {
    attempts = Number((await AsyncStorage.getItem(LAYOUT_RETRY_KEY)) ?? "0");
  } catch {
    attempts = 0;
  }
  if (attempts >= 2) {
    // Prefer continuing over an infinite reload loop; CairoText still
    // aligns to the preferred language edge without native RTL.
    return { language, rtlReady: true };
  }

  await AsyncStorage.setItem(LAYOUT_RETRY_KEY, String(attempts + 1));
  const token = `${language}:${wantRtl ? "rtl" : "ltr"}`;
  await AsyncStorage.setItem(LAYOUT_RELOAD_KEY, token);
  await reloadForLayout();
  return { language, rtlReady: false };
}
