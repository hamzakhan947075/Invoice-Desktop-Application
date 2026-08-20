import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const STATUS_FILTER_OPTIONS: { value: "ALL" | InvoiceStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * "Overdue" is never written to the database — it's derived at read time
 * from (status is SENT/PARTIALLY_PAID) AND (dueDate has passed) AND
 * (balance remains), per Phase 10: never require a manual "mark overdue" step.
 */
export function getEffectiveInvoiceStatus(invoice: {
  status: InvoiceStatus;
  dueDate: Date;
  balanceDue: Prisma.Decimal | string | number;
}): InvoiceStatus {
  const isOpen = invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID";
  const hasBalance = Number(invoice.balanceDue) > 0;
  const isPastDue = invoice.dueDate.getTime() < startOfToday().getTime();

  if (isOpen && hasBalance && isPastDue) return "OVERDUE";
  return invoice.status;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Prisma `where` fragment matching "effectively overdue", for list filtering
 * and dashboard aggregates. OVERDUE can now be a manually-set stored status
 * (via markInvoiceOverdueAction) as well as the automatic due-date derivation
 * below — this has to match both, or a manually-flagged invoice would vanish
 * from the Overdue filter and the dashboard's Overdue total.
 */
export function overdueWhereClause() {
  return {
    OR: [
      { status: "OVERDUE" as InvoiceStatus },
      {
        status: { in: ["SENT", "PARTIALLY_PAID"] as InvoiceStatus[] },
        dueDate: { lt: startOfToday() },
        balanceDue: { gt: 0 },
      },
    ],
  };
}

function notOverdueWhereClause() {
  return {
    OR: [{ dueDate: { gte: startOfToday() } }, { balanceDue: { lte: 0 } }],
  };
}

/** Builds the Prisma `where` fragment for an invoice status filter, keeping the "effective" status consistent between list filtering and per-row display. */
export function invoiceStatusWhere(filter: "ALL" | InvoiceStatus) {
  if (filter === "ALL") return {};
  if (filter === "OVERDUE") return overdueWhereClause();
  if (filter === "SENT" || filter === "PARTIALLY_PAID") {
    return { status: filter, ...notOverdueWhereClause() };
  }
  return { status: filter };
}
