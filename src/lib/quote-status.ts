import type { QuoteStatus } from "@/generated/prisma/enums";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * "Expired" is never written to the database — like an invoice's Overdue
 * status, it's derived at read time from a SENT quote whose expiry date has
 * passed, so it's never possible for the stored status and a displayed badge
 * to disagree.
 */
export function getEffectiveQuoteStatus(quote: { status: QuoteStatus; expiryDate: Date }): QuoteStatus {
  if (quote.status === "SENT" && quote.expiryDate.getTime() < startOfToday().getTime()) {
    return "EXPIRED";
  }
  return quote.status;
}
