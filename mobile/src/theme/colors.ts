/** الباشمدرس-inspired design tokens — high contrast on light surfaces. */
export const colors = {
  primary: "#2B6CB0",
  primaryDark: "#1A4F8B",
  primarySoft: "#DBEAFE",
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
  /** Session list: all students have attendance */
  sessionFull: "#DBEAFE",
  sessionFullBorder: "#3B82F6",
  /** Session list: some students have attendance */
  sessionPartial: "#FFEDD5",
  sessionPartialBorder: "#F97316",
  unpaid: "#FEF2F2",
  unpaidBorder: "#EF4444",
  partial: "#FFFBEB",
  partialBorder: "#F59E0B",
  paid: "#ECFDF5",
  paidBorder: "#10B981",
  /** Fallback accent borders for groups (cycled by id) */
  groupAccents: [
    "#3B82F6",
    "#0EA5E9",
    "#14B8A6",
    "#8B5CF6",
    "#F59E0B",
    "#EC4899",
    "#6366F1",
  ] as const,
};

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

export function groupAccentColor(groupId: number, accent?: string | null): string {
  if (accent && /^#[0-9A-Fa-f]{6}$/.test(accent)) return accent;
  const palette = colors.groupAccents;
  return palette[Math.abs(groupId) % palette.length];
}
