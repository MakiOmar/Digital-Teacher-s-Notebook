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
import { usePathname, useRouter } from "expo-router";
import { useAppData } from "@/src/contexts/AppDataContext";
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

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setupComplete } = useTutorProfile();
  const { activeYear, revision, ready: dataReady } = useAppData();

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<TourStatus>("pending");
  const [stepId, setStepId] = useState(TOUR_FIRST_STEP_ID);
  const [targets, setTargets] = useState<Partial<Record<TourTargetId, TargetRect>>>(
    {}
  );
  const advancingRef = useRef(false);
  const bootNavRef = useRef(false);

  const registerTarget = useCallback((id: TourTargetId, rect: TargetRect) => {
    setTargets((prev) => {
      const cur = prev[id];
      if (
        cur &&
        cur.x === rect.x &&
        cur.y === rect.y &&
        cur.width === rect.width &&
        cur.height === rect.height
      ) {
        return prev;
      }
      return { ...prev, [id]: rect };
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

  /** Skip create steps that are already satisfied (e.g. imported backup). */
  const resolveStepForward = useCallback(async (fromId: string): Promise<string> => {
    let id = fromId;
    // Cap iterations to step count
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const step = getTourStep(id);
      if (!step) return TOUR_FIRST_STEP_ID;
      if (step.id === "done") return id;
      if (!step.requirement) return id;
      const met = await step.requirement();
      if (!met) return id;
      const nextId = getNextTourStepId(id);
      if (!nextId) return id;
      id = nextId;
    }
    return id;
  }, []);

  const applyStep = useCallback(
    async (id: string, opts?: { navigate?: boolean }) => {
      const resolved = await resolveStepForward(id);
      await persist({ status: "pending", stepId: resolved });
      if (opts?.navigate !== false) {
        navigateForStep(resolved);
      }
    },
    [navigateForStep, persist, resolveStepForward]
  );

  useEffect(() => {
    void (async () => {
      const stored = await loadTourState();
      setStatus(stored.status);
      setStepId(stored.stepId);
      setReady(true);
    })();
  }, []);

  // Auto-start after profile setup when still pending (navigate once)
  useEffect(() => {
    if (!ready || !setupComplete || !dataReady) return;
    if (status !== "pending") {
      bootNavRef.current = false;
      return;
    }
    if (bootNavRef.current) return;
    bootNavRef.current = true;
    void (async () => {
      const resolved = await resolveStepForward(stepId || TOUR_FIRST_STEP_ID);
      if (resolved !== stepId) {
        await persist({ stepId: resolved });
      }
      navigateForStep(resolved);
    })();
  }, [ready, setupComplete, dataReady, status]);

  // Re-check requirements when data changes (after create forms)
  useEffect(() => {
    if (!ready || status !== "pending" || !setupComplete) return;
    if (advancingRef.current) return;
    void (async () => {
      const step = getTourStep(stepId);
      if (!step?.requirement) return;
      const met = await step.requirement();
      if (!met) return;
      const nextId = getNextTourStepId(stepId);
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
  }, [revision, activeYear?.id, stepId, status, ready, setupComplete]);

  const start = useCallback(async () => {
    bootNavRef.current = true;
    await applyStep(TOUR_FIRST_STEP_ID);
  }, [applyStep]);

  const skip = useCallback(async () => {
    await persist({ status: "skipped" });
  }, [persist]);

  const finish = useCallback(async () => {
    await persist({ status: "completed", stepId: "done" });
  }, [persist]);

  const next = useCallback(async () => {
    const step = getTourStep(stepId);
    if (stepId === "done" || !getNextTourStepId(stepId)) {
      await finish();
      return;
    }
    if (step?.requirement) {
      const met = await step.requirement();
      if (!met) {
        // Still blocked — nudge to create route if any
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

  const active =
    ready && setupComplete && status === "pending" && isTabScreen;

  const stepIndex = Math.max(
    0,
    TOUR_STEPS.findIndex((s) => s.id === stepId)
  );

  const value = useMemo(
    () => ({
      ready,
      active,
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
