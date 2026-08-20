import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { RECURRING_FREQUENCY_LABELS } from "@/lib/recurring-invoice-schedule";
import { RecurringStatusBadge } from "@/components/recurring-invoices/recurring-status-badge";
import { RecurringInvoiceActions } from "@/components/recurring-invoices/recurring-invoice-actions";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-status";

export default async function RecurringInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  // Scoped by businessId — a template id alone is never enough to authorize access.
  const template = await prisma.recurringInvoice.findFirst({
    where: { id, businessId: business.id },
    include: {
      customer: true,
      items: true,
      generatedInvoices: {
        orderBy: { issueDate: "desc" },
        select: { id: true, invoiceNumber: true, issueDate: true, status: true, dueDate: true, balanceDue: true, total: true },
      },
    },
  });
  if (!template) notFound();

  const currency = business.currency as CurrencyCode;
  const totals = calculateInvoiceTotals(
    template.items.map((item) => ({
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      discount: item.discount.toNumber(),
      taxRate: item.taxRate.toNumber(),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/recurring-invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to recurring invoices
        </Link>
        <RecurringInvoiceActions templateId={template.id} status={template.status} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="lg:w-96">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{template.customer.name}</CardTitle>
            <RecurringStatusBadge status={template.status} />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Frequency</span>
            <span>{RECURRING_FREQUENCY_LABELS[template.frequency]}</span>
            <span className="text-muted-foreground">Next run</span>
            <span>{template.nextRunDate.toLocaleDateString()}</span>
            <span className="text-muted-foreground">Start date</span>
            <span>{template.startDate.toLocaleDateString()}</span>
            <span className="text-muted-foreground">End date</span>
            <span>{template.endDate ? template.endDate.toLocaleDateString() : "—"}</span>
            <span className="text-muted-foreground">Due in</span>
            <span>{template.dueInDays} days</span>
            <span className="text-muted-foreground">Last generated</span>
            <span>{template.lastGeneratedAt ? template.lastGeneratedAt.toLocaleDateString() : "Never"}</span>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Amount per invoice</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(totals.subtotal.toFixed(2), currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatMoney(totals.tax.toFixed(2), currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.total.toFixed(2), currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {template.generatedInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices generated yet"
              description="Invoices created from this schedule will appear here."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {template.generatedInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between py-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <span className="text-muted-foreground">{invoice.issueDate.toLocaleDateString()}</span>
                  </div>
                  <InvoiceStatusBadge status={getEffectiveInvoiceStatus(invoice)} />
                  <span className="font-medium">{formatMoney(invoice.total.toFixed(2), currency)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
