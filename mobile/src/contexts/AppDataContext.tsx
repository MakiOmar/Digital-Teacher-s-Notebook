import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getDb } from "../db/client";
import type { AcademicYear, StudyMonth } from "../db/types";
import {
  getActiveYear,
  listStudyMonths,
  resolveCurrentStudyMonth,
} from "../repositories";

type AppDataContextValue = {
  ready: boolean;
  error: string | null;
  activeYear: AcademicYear | null;
  studyMonths: StudyMonth[];
  selectedMonthId: number | null;
  setSelectedMonthId: (id: number | null) => void;
  selectedMonth: StudyMonth | null;
  refresh: () => Promise<void>;
  revision: number;
  bump: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [studyMonths, setStudyMonths] = useState<StudyMonth[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    try {
      await getDb();
      const year = await getActiveYear();
      setActiveYear(year);
      if (year) {
        const months = await listStudyMonths(year.id);
        setStudyMonths(months);
        setSelectedMonthId((prev) => {
          if (prev && months.some((m) => m.id === prev)) return prev;
          return null;
        });
        const current = await resolveCurrentStudyMonth(year.id);
        setSelectedMonthId((prev) => prev ?? current?.id ?? months[0]?.id ?? null);
      } else {
        setStudyMonths([]);
        setSelectedMonthId(null);
      }
      setError(null);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في قاعدة البيانات");
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const selectedMonth = useMemo(
    () => studyMonths.find((m) => m.id === selectedMonthId) ?? null,
    [studyMonths, selectedMonthId]
  );

  const value = useMemo(
    () => ({
      ready,
      error,
      activeYear,
      studyMonths,
      selectedMonthId,
      setSelectedMonthId,
      selectedMonth,
      refresh,
      revision,
      bump,
    }),
    [
      ready,
      error,
      activeYear,
      studyMonths,
      selectedMonthId,
      selectedMonth,
      refresh,
      revision,
      bump,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
