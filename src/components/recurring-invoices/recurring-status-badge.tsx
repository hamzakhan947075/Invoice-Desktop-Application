import { Badge } from "@/components/ui/badge";
import type { RecurringInvoiceStatus } from "@/generated/prisma/enums";

export const RECURRING_STATUS_LABELS: Record<RecurringInvoiceStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

const STATUS_VARIANTS: Record<RecurringInvoiceStatus, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "outline",
  CANCELLED: "secondary",
  COMPLETED: "secondary",
};

export function RecurringStatusBadge({ status }: { status: RecurringInvoiceStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{RECURRING_STATUS_LABELS[status]}</Badge>;
}
