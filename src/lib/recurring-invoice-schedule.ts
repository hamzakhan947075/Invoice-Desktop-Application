import type { RecurringFrequency } from "@/generated/prisma/enums";

export const RECURRING_FREQUENCIES: RecurringFrequency[] = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

/**
 * Advances a schedule date by one occurrence of `frequency`. Always advances
 * from the *previous scheduled date*, not from "today" — so generating an
 * invoice a few days early (via "Generate Now") doesn't shift the rest of
 * the schedule.
 */
export function calculateNextRunDate(current: Date, frequency: RecurringFrequency): Date {
  const next = new Date(current);
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isDueToRun(nextRunDate: Date): boolean {
  return nextRunDate.getTime() <= startOfToday().getTime();
}
