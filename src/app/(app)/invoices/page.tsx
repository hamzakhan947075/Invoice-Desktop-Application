import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { InvoicesView } from "@/components/invoices/invoices-view";
import { INVOICE_STATUS_LABELS, getEffectiveInvoiceStatus, invoiceStatusWhere } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@/generated/prisma/enums";
import type { CurrencyCode } from "@/lib/currencies";

const VALID_STATUSES = new Set(Object.keys(INVOICE_STATUS_LABELS));

function parseStatusFilter(value: string | undefined): "ALL" | InvoiceStatus {
  if (value && VALID_STATUSES.has(value)) return value as InvoiceStatus;
  return "ALL";
}

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; customerId?: string; from?: string; to?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q, status, customerId, from, to } = await searchParams;
  const query = q?.trim() ?? "";
  const statusFilter = parseStatusFilter(status);
  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to);

  const [invoices, customers] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        businessId: business.id,
        ...invoiceStatusWhere(statusFilter),
        ...(customerId ? { customerId } : {}),
        ...(fromDate || toDate
          ? {
              issueDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { invoiceNumber: { contains: query } },
                { customer: { name: { contains: query } } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { issueDate: "desc" },
    }),
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.name,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    status: getEffectiveInvoiceStatus(invoice),
    balanceDue: invoice.balanceDue.toFixed(2),
    total: invoice.total.toFixed(2),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </div>
      <InvoicesView
        invoices={rows}
        customers={customers}
        currency={business.currency as CurrencyCode}
        filters={{ q: query, status: statusFilter, customerId: customerId ?? "", from: from ?? "", to: to ?? "" }}
      />
    </div>
  );
}
