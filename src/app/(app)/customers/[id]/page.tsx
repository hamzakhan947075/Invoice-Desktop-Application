import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Mail, MapPin, Phone, Wallet } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-status";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  // Scoped by businessId — a customer id alone is never enough to authorize access.
  const customer = await prisma.customer.findFirst({
    where: { id, businessId: business.id },
    include: {
      invoices: {
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          status: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
        },
      },
    },
  });

  if (!customer) notFound();

  const payments = await prisma.payment.findMany({
    where: { businessId: business.id, invoice: { customerId: id } },
    include: { invoice: { select: { invoiceNumber: true } } },
    orderBy: { paymentDate: "desc" },
  });

  const currency = business.currency as CurrencyCode;
  const totals = customer.invoices.reduce(
    (acc, invoice) => ({
      invoiced: acc.invoiced.plus(invoice.total),
      paid: acc.paid.plus(invoice.amountPaid),
      outstanding: acc.outstanding.plus(invoice.balanceDue),
    }),
    {
      invoiced: new Prisma.Decimal(0),
      paid: new Prisma.Decimal(0),
      outstanding: new Prisma.Decimal(0),
    }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
        <Button variant="outline" asChild>
          <a href={`/customers/${customer.id}/statement/pdf`} download={`${customer.name}-statement.pdf`}>
            <Download className="h-4 w-4" />
            Download Statement PDF
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="lg:w-80">
          <CardHeader>
            <CardTitle>{customer.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {customer.email}
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {customer.phone}
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {customer.address}
              </div>
            )}
            {customer.notes && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                {customer.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoiced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(totals.invoiced.toFixed(2), currency)}</p>
              <p className="text-xs text-muted-foreground">
                {customer.invoices.length} invoice{customer.invoices.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(totals.paid.toFixed(2), currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatMoney(totals.outstanding.toFixed(2), currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Invoices for this customer will appear here once invoicing is available."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {customer.invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex flex-col">
                    <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                    <span className="text-muted-foreground">
                      {invoice.issueDate.toLocaleDateString()}
                    </span>
                  </div>
                  <InvoiceStatusBadge status={getEffectiveInvoiceStatus(invoice)} />
                  <span className="font-medium">{formatMoney(invoice.total.toFixed(2), currency)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              description="Payments recorded against this customer's invoices will appear here."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{payment.paymentDate.toLocaleDateString()}</span>
                    <span className="text-muted-foreground">
                      {payment.invoice.invoiceNumber} · {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                  </div>
                  <span className="font-medium">{formatMoney(payment.amount.toFixed(2), currency)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
