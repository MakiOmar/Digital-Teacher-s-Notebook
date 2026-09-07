import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "tutor.theme.v1";

export type ThemeMode = "light" | "dark";

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  return "light";
}

export async function saveThemeMode(mode: ThemeMode): Promise<ThemeMode> {
  await AsyncStorage.setItem(THEME_KEY, mode);
  return mode;
}
