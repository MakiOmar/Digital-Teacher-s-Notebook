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
  lightColors,
  paletteForMode,
  type AppColors,
} from "@/src/theme/colors";
import {
  loadThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "@/src/theme/themeStorage";

type ThemeContextValue = {
  ready: boolean;
  mode: ThemeMode;
  colors: AppColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    let cancelled = false;
    void loadThemeMode().then((next) => {
      if (!cancelled) {
        setModeState(next);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await saveThemeMode(next);
  }, []);

  const toggleMode = useCallback(async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setModeState(next);
    await saveThemeMode(next);
  }, [mode]);

  const colors = useMemo(() => paletteForMode(mode), [mode]);

  const value = useMemo(
    () => ({
      ready,
      mode,
      colors,
      isDark: mode === "dark",
      setMode,
      toggleMode,
    }),
    [ready, mode, colors, setMode, toggleMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      ready: false,
      mode: "light",
      colors: lightColors,
      isDark: false,
      setMode: async () => undefined,
      toggleMode: async () => undefined,
    };
  }
  return ctx;
}

/** Active palette for the current theme (light fallback outside provider). */
export function useColors(): AppColors {
  return useTheme().colors;
}
