/** الباشمدرس-inspired design tokens — light + dark palettes. */

export type AppColors = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  warning: string;
  success: string;
  star: string;
  sessionFull: string;
  sessionFullBorder: string;
  sessionPartial: string;
  sessionPartialBorder: string;
  unpaid: string;
  unpaidBorder: string;
  partial: string;
  partialBorder: string;
  paid: string;
  paidBorder: string;
  groupAccents: readonly string[];
  /** Floating theme toggle / elevated chrome */
  fab: string;
  fabIcon: string;
};

export const lightColors: AppColors = {
  primary: "#0F766E",
  primaryDark: "#115E59",
  primarySoft: "#CCFBF1",
  accent: "#0EA5E9",
  background: "#E8F1F8",
  backgroundAlt: "#F0F6FA",
  surface: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  border: "#CBD5E1",
  danger: "#DC2626",
  warning: "#D97706",
  success: "#059669",
  star: "#EAB308",
  sessionFull: "#DBEAFE",
  sessionFullBorder: "#3B82F6",
  sessionPartial: "#FFEDD5",
  sessionPartialBorder: "#F97316",
  unpaid: "#FEF2F2",
  unpaidBorder: "#EF4444",
  partial: "#FFFBEB",
  partialBorder: "#F59E0B",
  paid: "#ECFDF5",
  paidBorder: "#10B981",
  groupAccents: [
    "#3B82F6",
    "#0EA5E9",
    "#14B8A6",
    "#8B5CF6",
    "#F59E0B",
    "#EC4899",
    "#6366F1",
  ],
  fab: "#0F766E",
  fabIcon: "#FFFFFF",
};

/** Dark surfaces keep teal brand accents with readable contrast. */
export const darkColors: AppColors = {
  primary: "#2DD4BF",
  primaryDark: "#14B8A6",
  primarySoft: "#134E4A",
  accent: "#38BDF8",
  background: "#0B1220",
  backgroundAlt: "#111827",
  surface: "#1E293B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
  danger: "#F87171",
  warning: "#FBBF24",
  success: "#34D399",
  star: "#FACC15",
  sessionFull: "#1E3A5F",
  sessionFullBorder: "#60A5FA",
  sessionPartial: "#4A2F1A",
  sessionPartialBorder: "#FB923C",
  unpaid: "#3F1D1D",
  unpaidBorder: "#F87171",
  partial: "#3F2E12",
  partialBorder: "#FBBF24",
  paid: "#14532D",
  paidBorder: "#34D399",
  groupAccents: [
    "#60A5FA",
    "#38BDF8",
    "#2DD4BF",
    "#A78BFA",
    "#FBBF24",
    "#F472B6",
    "#818CF8",
  ],
  fab: "#2DD4BF",
  fabIcon: "#0B1220",
};

/**
 * Default / splash-safe light tokens.
 * Prefer `useColors()` in React trees so dark mode updates paint correctly.
 */
export const colors: AppColors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
};

export function groupAccentColor(
  groupId: number,
  accent?: string | null,
  palette: AppColors = colors
): string {
  if (accent && /^#[0-9A-Fa-f]{6}$/.test(accent)) return accent;
  const accents = palette.groupAccents;
  return accents[Math.abs(groupId) % accents.length];
}

export function paletteForMode(mode: "light" | "dark"): AppColors {
  return mode === "dark" ? darkColors : lightColors;
}
