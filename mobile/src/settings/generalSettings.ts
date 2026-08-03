import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "tutor.general.v1";

/** Allowed page sizes for list pagination across the app. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type GeneralSettings = {
  /** Rows per page for all paginated lists. */
  pageSize: PageSizeOption;
};

const DEFAULTS: GeneralSettings = {
  pageSize: 25,
};

function normalizePageSize(value: unknown): PageSizeOption {
  const n = Number(value);
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n as PageSizeOption;
  }
  return DEFAULTS.pageSize;
}

export async function loadGeneralSettings(): Promise<GeneralSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GeneralSettings>;
    return {
      pageSize: normalizePageSize(parsed.pageSize),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveGeneralSettings(
  input: Partial<GeneralSettings>
): Promise<GeneralSettings> {
  const current = await loadGeneralSettings();
  const next: GeneralSettings = {
    pageSize:
      input.pageSize !== undefined
        ? normalizePageSize(input.pageSize)
        : current.pageSize,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
