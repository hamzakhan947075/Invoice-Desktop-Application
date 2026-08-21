import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Repeat } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-status";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: business.id },
    include: {
      customer: true,
      items: true,
      payments: { orderBy: { paymentDate: "desc" } },
      creditNotes: { orderBy: { issueDate: "desc" } },
    },
  });
  if (!invoice) notFound();

  const status = getEffectiveInvoiceStatus(invoice);
  const currency = invoice.currency;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Link>
          {invoice.recurringInvoiceId && (
            <Link
              href={`/recurring-invoices/${invoice.recurringInvoiceId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Repeat className="h-4 w-4" />
              Generated from a recurring schedule
            </Link>
          )}
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          status={invoice.status}
          balanceDue={invoice.balanceDue.toFixed(2)}
          total={invoice.total.toFixed(2)}
          currency={currency}
          customerName={invoice.customer.name}
          customerEmail={invoice.customer.email}
          businessName={business.name}
          lastEmailedAt={invoice.lastEmailedAt ? invoice.lastEmailedAt.toISOString() : null}
        />
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardContent className="flex flex-col gap-8 p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {business.logoUrl && (
                <Image
                  src={business.logoUrl}
                  alt={business.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg object-cover"
                  unoptimized
                />
              )}
              <div>
                <h1 className="font-heading text-xl font-semibold">{business.name}</h1>
                {business.email && <p className="text-sm text-muted-foreground">{business.email}</p>}
                {business.phone && <p className="text-sm text-muted-foreground">{business.phone}</p>}
                {business.address && <p className="text-sm text-muted-foreground">{business.address}</p>}
              </div>
            </div>

            <div className="text-right">
              <h2 className="font-heading text-2xl font-semibold">Invoice {invoice.invoiceNumber}</h2>
              <div className="mt-2">
                <InvoiceStatusBadge status={status} />
              </div>
              {invoice.lastEmailedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last emailed {invoice.lastEmailedAt.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Billed to</p>
              <p className="mt-1 font-medium">{invoice.customer.name}</p>
              {invoice.customer.email && (
                <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
              )}
              {invoice.customer.phone && (
                <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
              )}
              {invoice.customer.address && (
                <p className="text-sm text-muted-foreground">{invoice.customer.address}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:justify-self-end">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{invoice.issueDate.toLocaleDateString()}</span>
              <span className="text-muted-foreground">Due Date</span>
              <span>{invoice.dueDate.toLocaleDateString()}</span>
              <span className="text-muted-foreground">Currency</span>
              <span>{invoice.currency}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Qty</th>
                  <th className="py-2 font-medium text-right">Price</th>
                  <th className="py-2 font-medium text-right">Tax</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity.toString()}</td>
                    <td className="py-2 text-right">{formatMoney(item.unitPrice.toFixed(2), currency)}</td>
                    <td className="py-2 text-right">{item.taxRate.toFixed(2)}%</td>
                    <td className="py-2 text-right">{formatMoney(item.lineTotal.toFixed(2), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="flex w-full max-w-xs flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(invoice.subtotal.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>{formatMoney(invoice.discount.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(invoice.tax.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-medium">
                <span>Total</span>
                <span>{formatMoney(invoice.total.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Paid</span>
                <span>{formatMoney(invoice.amountPaid.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Balance Due</span>
                <span>{formatMoney(invoice.balanceDue.toFixed(2), currency)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Notes</p>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {invoice.payments.length > 0 && (
        <Card className="print:hidden">
          <CardContent className="flex flex-col divide-y divide-border p-0">
            <div className="p-4 pb-2 font-medium">Payment History</div>
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 text-sm">
                <div className="flex flex-col">
                  <span>{payment.paymentDate.toLocaleDateString()}</span>
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                </div>
                <span className="font-medium">{formatMoney(payment.amount.toFixed(2), currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {invoice.creditNotes.length > 0 && (
        <Card className="print:hidden">
          <CardContent className="flex flex-col divide-y divide-border p-0">
            <div className="p-4 pb-2 font-medium">Credit Notes</div>
            {invoice.creditNotes.map((creditNote) => (
              <div key={creditNote.id} className="flex items-center justify-between p-4 text-sm">
                <div className="flex flex-col">
                  <span>{creditNote.creditNoteNumber}</span>
                  <span className="text-muted-foreground">
                    {creditNote.issueDate.toLocaleDateString()} · {creditNote.reason}
                  </span>
                </div>
                <span className="font-medium">{formatMoney(creditNote.amount.toFixed(2), currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
