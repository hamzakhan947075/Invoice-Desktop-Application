import { notFound } from "next/navigation";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/quotes/quote-form";
import type { CurrencyCode } from "@/lib/currencies";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, businessId: business.id },
    include: { items: true },
  });
  if (!quote) notFound();
  if (quote.status !== "DRAFT") notFound();

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, price: true, taxRate: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-heading text-lg font-semibold">Edit Quote {quote.quoteNumber}</h2>
      <QuoteForm
        customers={customers}
        products={products.map((p) => ({
          ...p,
          price: p.price.toFixed(2),
          taxRate: p.taxRate.toFixed(2),
        }))}
        defaultCurrency={business.currency as CurrencyCode}
        quote={{
          id: quote.id,
          customerId: quote.customerId,
          issueDate: quote.issueDate.toISOString().slice(0, 10),
          expiryDate: quote.expiryDate.toISOString().slice(0, 10),
          currency: quote.currency,
          notes: quote.notes ?? "",
          items: quote.items.map((item) => ({
            productId: item.productId ?? "",
            description: item.description,
            quantity: item.quantity.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
            discount: item.discount.toNumber(),
            taxRate: item.taxRate.toNumber(),
          })),
        }}
      />
    </div>
  );
}
