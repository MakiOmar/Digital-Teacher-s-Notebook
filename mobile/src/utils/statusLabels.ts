import type { AttendanceStatus, PaymentStatus, SessionStatus } from "../db/types";
import { lightColors, type AppColors } from "../theme/colors";
import { t } from "../i18n/ar";

/** Shared session status filter options for Today / Group Sessions. */
export const SESSION_STATUS_FILTER_OPTIONS: {
  value: string;
  labelKey:
    | "filterAllStatuses"
    | "sessionScheduled"
    | "sessionCompleted"
    | "sessionCancelled"
    | "sessionRescheduled";
}[] = [
  { value: "all", labelKey: "filterAllStatuses" },
  { value: "scheduled", labelKey: "sessionScheduled" },
  { value: "completed", labelKey: "sessionCompleted" },
  { value: "cancelled", labelKey: "sessionCancelled" },
  { value: "rescheduled", labelKey: "sessionRescheduled" },
];

export function sessionStatusFilterOptions(): { value: string; label: string }[] {
  return SESSION_STATUS_FILTER_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }));
}

export function paymentStatusLabel(status: PaymentStatus | string): string {
  if (status === "paid") return t("paid");
  if (status === "partial") return t("partial");
  return t("unpaid");
}

export function attendanceStatusLabel(status: AttendanceStatus | string): string {
  if (status === "present") return t("present");
  if (status === "absent_excused") return t("absentExcused");
  if (status === "absent_unexcused") return t("absentUnexcused");
  return status;
}

export function paymentStatusBorderColor(
  status: PaymentStatus | string,
  palette: AppColors = lightColors
): string {
  if (status === "paid") return palette.paidBorder;
  if (status === "partial") return palette.partialBorder;
  return palette.unpaidBorder;
}

export function enrollmentStatusLabel(status: string): string {
  if (status === "active") return t("active");
  if (status === "paused") return t("paused");
  if (status === "withdrawn") return t("withdrawn");
  return status;
}
