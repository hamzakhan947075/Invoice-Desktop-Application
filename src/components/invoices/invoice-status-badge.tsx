import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@/generated/prisma/enums";

const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  PARTIALLY_PAID: "outline",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
