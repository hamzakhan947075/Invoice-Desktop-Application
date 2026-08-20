import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS } from "@/lib/quote-status";
import type { QuoteStatus } from "@/generated/prisma/enums";

const STATUS_VARIANTS: Record<QuoteStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  ACCEPTED: "default",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  CONVERTED: "secondary",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}
