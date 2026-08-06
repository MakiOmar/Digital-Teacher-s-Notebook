import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useLicense } from "@/src/license/LicenseContext";
import { useTutorProfile } from "@/src/profile/TutorProfileContext";
import {
  getNextTourStepId,
  getTourStep,
  TOUR_STEPS,
  type TourTargetId,
} from "./tourSteps";
import {
  loadTourState,
  saveTourState,
  TOUR_FIRST_STEP_ID,
  type TourStatus,
} from "./tourStorage";

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TourContextValue = {
  ready: boolean;
  /** Tour is eligible and currently driving the UI */
  active: boolean;
  /** Current step target id (anchors only measure this one) */
  activeTargetId: TourTargetId | undefined;
  status: TourStatus;
  stepId: string;
  stepIndex: number;
  stepCount: number;
  targets: Partial<Record<TourTargetId, TargetRect>>;
  registerTarget: (id: TourTargetId, rect: TargetRect) => void;
  unregisterTarget: (id: TourTargetId) => void;
  start: () => Promise<void>;
  skip: () => Promise<void>;
  next: () => Promise<void>;
  goCreate: () => void;
  finish: () => Promise<void>;
};

const TourContext = createContext<TourContextValue | null>(null);

function sameRect(a: TargetRect, b: TargetRect): boolean {
  return (
    Math.round(a.x) === Math.round(b.x) &&
    Math.round(a.y) === Math.round(b.y) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setupComplete } = useTutorProfile();
  const { status: licenseStatus } = useLicense();
  const { activeYear, revision, ready: dataReady } = useAppData();

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<TourStatus>("pending");
  const [stepId, setStepId] = useState(TOUR_FIRST_STEP_ID);
  const [targets, setTargets] = useState<Partial<Record<TourTargetId, TargetRect>>>(
    {}
  );
  /** Overlay only while app is foreground — avoids resume thrash / freeze */
  const [foreground, setForeground] = useState(
    AppState.currentState === "active"
  );
  const advancingRef = useRef(false);
  const bootNavRef = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerTarget = useCallback((id: TourTargetId, rect: TargetRect) => {
    const nextRect: TargetRect = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    setTargets((prev) => {
      const cur = prev[id];
      if (cur && sameRect(cur, nextRect)) return prev;
      return { ...prev, [id]: nextRect };
    });
  }, []);

  const unregisterTarget = useCallback((id: TourTargetId) => {
    setTargets((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const persist = useCallback(async (partial: {
    status?: TourStatus;
    stepId?: string;
  }) => {
    const next = await saveTourState(partial);
    setStatus(next.status);
    setStepId(next.stepId);
  }, []);

  const navigateForStep = useCallback(
    (id: string) => {
      const step = getTourStep(id);
      if (step?.tabHref) {
        router.push(step.tabHref as never);
      }
    },
    [router]
  );

  const applyStep = useCallback(
    async (id: string, opts?: { navigate?: boolean }) => {
      setTargets({});
      await persist({ status: "pending", stepId: id });
      if (opts?.navigate !== false) {
        navigateForStep(id);
      }
    },
    [navigateForStep, persist]
  );

  useEffect(() => {
    void (async () => {
      const stored = await loadTourState();
      setStatus(stored.status);
      setStepId(stored.stepId);
      setReady(true);
    })();
  }, []);

  /**
   * Leaving mid-tour used to keep status=pending and re-open a Modal + measure
   * storm on next launch (stuck splash / blinking status bar).
   * Dismiss the unfinished tour when the app is backgrounded so cold start is clean.
   */
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
      if (state === "active") {
        setForeground(true);
        return;
      }
      // Hide overlay immediately
      setForeground(false);
      // After a short leave, drop unfinished tour so reopen doesn't hang
      leaveTimer.current = setTimeout(() => {
        leaveTimer.current = null;
        void (async () => {
          const stored = await loadTourState();
          if (stored.status === "pending") {
            await saveTourState({ status: "skipped" });
            setStatus("skipped");
          }
        })();
      }, 400);
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  // Navigate to the current step only after license unlocked + data ready
  useEffect(() => {
    if (!ready || !setupComplete || !dataReady) return;
    if (licenseStatus !== "unlocked") return;
    if (status !== "pending") {
      bootNavRef.current = false;
      return;
    }
    if (!foreground) return;
    if (bootNavRef.current) return;
    bootNavRef.current = true;
    // Defer past first paint so splash can hide before Modal + router push
    const t = setTimeout(() => {
      navigateForStep(stepId || TOUR_FIRST_STEP_ID);
    }, 600);
    return () => clearTimeout(t);
  }, [
    ready,
    setupComplete,
    dataReady,
    status,
    licenseStatus,
    foreground,
    navigateForStep,
    stepId,
  ]);

  const stepIdRef = useRef(stepId);
  stepIdRef.current = stepId;

  useEffect(() => {
    if (!ready || status !== "pending" || !setupComplete) return;
    if (licenseStatus !== "unlocked") return;
    if (advancingRef.current) return;
    void (async () => {
      const id = stepIdRef.current;
      const step = getTourStep(id);
      if (!step?.requirement || !step.createRoute) return;
      const met = await step.requirement();
      if (!met) return;
      const nextId = getNextTourStepId(id);
      if (!nextId) {
        await persist({ status: "completed", stepId: "done" });
        return;
      }
      advancingRef.current = true;
      try {
        await applyStep(nextId);
      } finally {
        advancingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only data changes
  }, [revision, activeYear?.id]);

  const start = useCallback(async () => {
    bootNavRef.current = true;
    setForeground(true);
    await applyStep(TOUR_FIRST_STEP_ID);
  }, [applyStep]);

  const skip = useCallback(async () => {
    await persist({ status: "skipped" });
  }, [persist]);

  const finish = useCallback(async () => {
    await persist({ status: "completed", stepId: "done" });
  }, [persist]);

  const next = useCallback(async () => {
    if (stepId === "done" || !getNextTourStepId(stepId)) {
      await finish();
      return;
    }
    const step = getTourStep(stepId);
    if (step?.allowNext) {
      const nextId = getNextTourStepId(stepId);
      if (!nextId) {
        await finish();
        return;
      }
      await applyStep(nextId);
      return;
    }
    if (step?.requirement) {
      const met = await step.requirement();
      if (!met) {
        if (step.createRoute) {
          router.push(step.createRoute as never);
        }
        return;
      }
    }
    const nextId = getNextTourStepId(stepId);
    if (!nextId) {
      await finish();
      return;
    }
    await applyStep(nextId);
  }, [applyStep, finish, router, stepId]);

  const goCreate = useCallback(() => {
    const step = getTourStep(stepId);
    if (step?.createRoute) {
      router.push(step.createRoute as never);
    }
  }, [router, stepId]);

  const isTabScreen = (() => {
    const p = pathname.replace(/\/$/, "") || "/";
    return (
      p === "/" ||
      p.endsWith("/(tabs)") ||
      p.endsWith("/index") ||
      p.endsWith("/today") ||
      p.endsWith("/groups") ||
      p.endsWith("/payments") ||
      p.endsWith("/more") ||
      p.endsWith("/students") ||
      p.endsWith("/schedule")
    );
  })();

  const currentStep = getTourStep(stepId);
  const activeTargetId = currentStep?.targetId;

  const active =
    ready &&
    foreground &&
    setupComplete &&
    licenseStatus === "unlocked" &&
    status === "pending" &&
    isTabScreen;

  const stepIndex = Math.max(
    0,
    TOUR_STEPS.findIndex((s) => s.id === stepId)
  );

  const value = useMemo(
    () => ({
      ready,
      active,
      activeTargetId,
      status,
      stepId,
      stepIndex,
      stepCount: TOUR_STEPS.length,
      targets,
      registerTarget,
      unregisterTarget,
      start,
      skip,
      next,
      goCreate,
      finish,
    }),
    [
      ready,
      active,
      activeTargetId,
      status,
      stepId,
      stepIndex,
      targets,
      registerTarget,
      unregisterTarget,
      start,
      skip,
      next,
      goCreate,
      finish,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return {
      ready: false,
      active: false,
      activeTargetId: undefined,
      status: "completed",
      stepId: TOUR_FIRST_STEP_ID,
      stepIndex: 0,
      stepCount: TOUR_STEPS.length,
      targets: {},
      registerTarget: () => undefined,
      unregisterTarget: () => undefined,
      start: async () => undefined,
      skip: async () => undefined,
      next: async () => undefined,
      goCreate: () => undefined,
      finish: async () => undefined,
    };
  }
  return ctx;
}
