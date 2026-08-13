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
  | "groupsList"
  | "studentsAdd"
  | "todayHeader"
  | "scheduleHeader"
  | "paymentsHeader"
  | "moreBackup"
  | "moreReports"
  | "moreReminders"
  | "moreSettings"
  | "moreSettingsCluster"
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
  /** Auto-advance only after the user completes a create step (not for boot skip-ahead). */
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
    allowNext: true,
    requirement: async () => Boolean(await getActiveYear()),
  },
  {
    id: "createStudent",
    titleKey: "tourStudentTitle",
    bodyKey: "tourStudentBody",
    targetId: "studentsAdd",
    tabHref: "/(tabs)/students",
    createRoute: "/students/form",
    allowNext: true,
    requirement: async () => {
      const rows = await listStudentsWithEnrollment();
      return rows.some((r) => r.status === "active");
    },
  },
  {
    id: "createGroup",
    titleKey: "tourGroupTitle",
    bodyKey: "tourGroupBody",
    targetId: "groupsAdd",
    tabHref: "/(tabs)/groups",
    createRoute: "/groups/form",
    allowNext: true,
    requirement: async () => (await listGroups()).length > 0,
  },
  {
    id: "groupHubHint",
    titleKey: "tourGroupHubTitle",
    bodyKey: "tourGroupHubBody",
    targetId: "groupsList",
    tabHref: "/(tabs)/groups",
    allowNext: true,
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
    id: "scheduleHint",
    titleKey: "tourScheduleTitle",
    bodyKey: "tourScheduleBody",
    targetId: "scheduleHeader",
    tabHref: "/(tabs)/schedule",
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
    id: "backupHint",
    titleKey: "tourBackupTitle",
    bodyKey: "tourBackupBody",
    targetId: "moreBackup",
    tabHref: "/(tabs)/more",
    allowNext: true,
  },
  {
    id: "reportsHint",
    titleKey: "tourReportsTitle",
    bodyKey: "tourReportsBody",
    targetId: "moreReports",
    tabHref: "/(tabs)/more",
    allowNext: true,
  },
  {
    id: "remindersHint",
    titleKey: "tourRemindersTitle",
    bodyKey: "tourRemindersBody",
    targetId: "moreReminders",
    tabHref: "/(tabs)/more",
    allowNext: true,
  },
  {
    id: "moreHint",
    titleKey: "tourMoreTitle",
    bodyKey: "tourMoreBody",
    targetId: "moreSettingsCluster",
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

export function isKnownTourStepId(id: string): boolean {
  return TOUR_STEPS.some((s) => s.id === id);
}
