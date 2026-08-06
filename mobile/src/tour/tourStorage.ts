import AsyncStorage from "@react-native-async-storage/async-storage";
import { isKnownTourStepId } from "./tourSteps";

/** Bumped when step IDs / flow change so stale step pointers reset. */
const SETTINGS_KEY = "tutor.tour.v2";

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
    const stepId =
      typeof parsed.stepId === "string" && isKnownTourStepId(parsed.stepId)
        ? parsed.stepId
        : TOUR_FIRST_STEP_ID;
    return {
      status:
        parsed.status === "skipped" ||
        parsed.status === "completed" ||
        parsed.status === "pending"
          ? parsed.status
          : "pending",
      stepId,
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
