import { notFound } from "next/navigation";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { RecurringInvoiceForm } from "@/components/recurring-invoices/recurring-invoice-form";
import type { CurrencyCode } from "@/lib/currencies";

export default async function EditRecurringInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  const template = await prisma.recurringInvoice.findFirst({
    where: { id, businessId: business.id },
    include: { items: true },
  });
  if (!template) notFound();

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
      <h2 className="font-heading text-lg font-semibold">Edit Recurring Invoice</h2>
      <RecurringInvoiceForm
        customers={customers}
        products={products.map((p) => ({ ...p, price: p.price.toFixed(2), taxRate: p.taxRate.toFixed(2) }))}
        defaultCurrency={business.currency as CurrencyCode}
        template={{
          id: template.id,
          customerId: template.customerId,
          frequency: template.frequency,
          startDate: template.startDate.toISOString().slice(0, 10),
          endDate: template.endDate ? template.endDate.toISOString().slice(0, 10) : "",
          dueInDays: template.dueInDays,
          currency: template.currency,
          notes: template.notes ?? "",
          items: template.items.map((item) => ({
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
