import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "tutor.tour.v1";

export type TourStatus = "pending" | "skipped" | "completed";

export type TourState = {
  status: TourStatus;
  stepId: string;
};

export const TOUR_FIRST_STEP_ID = "welcomeHome";

const DEFAULTS: TourState = {
  status: "pending",
  stepId: TOUR_FIRST_STEP_ID,
};

export async function loadTourState(): Promise<TourState> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      status:
        parsed.status === "skipped" ||
        parsed.status === "completed" ||
        parsed.status === "pending"
          ? parsed.status
          : "pending",
      stepId:
        typeof parsed.stepId === "string" && parsed.stepId.length
          ? parsed.stepId
          : TOUR_FIRST_STEP_ID,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveTourState(
  input: Partial<TourState>
): Promise<TourState> {
  const current = await loadTourState();
  const next: TourState = {
    status: input.status ?? current.status,
    stepId: input.stepId ?? current.stepId,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
