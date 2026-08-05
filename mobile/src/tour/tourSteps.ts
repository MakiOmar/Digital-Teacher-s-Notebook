import type { ArKey } from "@/src/i18n/ar";
import {
  getActiveYear,
  listGroups,
  listStudentsWithEnrollment,
} from "@/src/repositories";

export type TourTargetId =
  | "homeYearCta"
  | "homeHeader"
  | "groupsAdd"
  | "studentsAdd"
  | "todayHeader"
  | "paymentsHeader"
  | "moreMenu";

export type TourStep = {
  id: string;
  titleKey: ArKey;
  bodyKey: ArKey;
  /** Spotlight target; omit for centered completion card */
  targetId?: TourTargetId;
  /** Navigate here when the step becomes active */
  tabHref?: string;
  /** Form/route opened by «أنشئ الآن» */
  createRoute?: string;
  /** When true, primary CTA advances without create */
  allowNext?: boolean;
  /** Skip forward automatically when already satisfied */
  requirement?: () => Promise<boolean>;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcomeHome",
    titleKey: "tourWelcomeTitle",
    bodyKey: "tourWelcomeBody",
    targetId: "homeHeader",
    tabHref: "/(tabs)",
    allowNext: true,
  },
  {
    id: "createYear",
    titleKey: "tourYearTitle",
    bodyKey: "tourYearBody",
    targetId: "homeYearCta",
    tabHref: "/(tabs)",
    createRoute: "/years/form",
    requirement: async () => Boolean(await getActiveYear()),
  },
  {
    id: "createGroup",
    titleKey: "tourGroupTitle",
    bodyKey: "tourGroupBody",
    targetId: "groupsAdd",
    tabHref: "/(tabs)/groups",
    createRoute: "/groups/form",
    requirement: async () => (await listGroups()).length > 0,
  },
  {
    id: "createStudent",
    titleKey: "tourStudentTitle",
    bodyKey: "tourStudentBody",
    targetId: "studentsAdd",
    tabHref: "/(tabs)/students",
    createRoute: "/students/form",
    requirement: async () => {
      const rows = await listStudentsWithEnrollment();
      return rows.some((r) => r.group_name != null && r.status === "active");
    },
  },
  {
    id: "todayHint",
    titleKey: "tourTodayTitle",
    bodyKey: "tourTodayBody",
    targetId: "todayHeader",
    tabHref: "/(tabs)/today",
    allowNext: true,
  },
  {
    id: "paymentsHint",
    titleKey: "tourPaymentsTitle",
    bodyKey: "tourPaymentsBody",
    targetId: "paymentsHeader",
    tabHref: "/(tabs)/payments",
    allowNext: true,
  },
  {
    id: "moreHint",
    titleKey: "tourMoreTitle",
    bodyKey: "tourMoreBody",
    targetId: "moreMenu",
    tabHref: "/(tabs)/more",
    allowNext: true,
  },
  {
    id: "done",
    titleKey: "tourDoneTitle",
    bodyKey: "tourDoneBody",
    allowNext: true,
  },
];

export function getTourStep(id: string): TourStep | undefined {
  return TOUR_STEPS.find((s) => s.id === id);
}

export function getTourStepIndex(id: string): number {
  return Math.max(0, TOUR_STEPS.findIndex((s) => s.id === id));
}

export function getNextTourStepId(id: string): string | null {
  const i = getTourStepIndex(id);
  if (i < 0 || i >= TOUR_STEPS.length - 1) return null;
  return TOUR_STEPS[i + 1].id;
}
