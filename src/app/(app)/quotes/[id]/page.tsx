import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightCircle } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { getEffectiveQuoteStatus } from "@/lib/quote-status";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { QuoteActions } from "@/components/quotes/quote-actions";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, businessId: business.id },
    include: { customer: true, items: true },
  });
  if (!quote) notFound();

  const status = getEffectiveQuoteStatus(quote);
  const currency = quote.currency;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to quotes
        </Link>
        <QuoteActions quoteId={quote.id} quoteNumber={quote.quoteNumber} status={quote.status} />
      </div>

      {quote.convertedInvoiceId && (
        <Link
          href={`/invoices/${quote.convertedInvoiceId}`}
          className="inline-flex items-center gap-1 self-start text-sm text-primary hover:underline"
        >
          <ArrowRightCircle className="h-4 w-4" />
          View the invoice this quote was converted to
        </Link>
      )}

      <Card>
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
              <h2 className="font-heading text-2xl font-semibold">Quote {quote.quoteNumber}</h2>
              <div className="mt-2">
                <QuoteStatusBadge status={status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Prepared for
              </p>
              <p className="mt-1 font-medium">{quote.customer.name}</p>
              {quote.customer.email && (
                <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
              )}
              {quote.customer.phone && (
                <p className="text-sm text-muted-foreground">{quote.customer.phone}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:justify-self-end">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{quote.issueDate.toLocaleDateString()}</span>
              <span className="text-muted-foreground">Valid Until</span>
              <span>{quote.expiryDate.toLocaleDateString()}</span>
              <span className="text-muted-foreground">Currency</span>
              <span>{quote.currency}</span>
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
                {quote.items.map((item) => (
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
                <span>{formatMoney(quote.subtotal.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>{formatMoney(quote.discount.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(quote.tax.toFixed(2), currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(quote.total.toFixed(2), currency)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Notes</p>
              <p className="whitespace-pre-line">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
