import { notFound } from "next/navigation";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { CurrencyCode } from "@/lib/currencies";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: business.id },
    include: { items: true },
  });
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") notFound();

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
      <h2 className="font-heading text-lg font-semibold">Edit Invoice {invoice.invoiceNumber}</h2>
      <InvoiceForm
        customers={customers}
        products={products.map((p) => ({
          ...p,
          price: p.price.toFixed(2),
          taxRate: p.taxRate.toFixed(2),
        }))}
        defaultCurrency={business.currency as CurrencyCode}
        invoice={{
          id: invoice.id,
          customerId: invoice.customerId,
          issueDate: invoice.issueDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          currency: invoice.currency,
          notes: invoice.notes ?? "",
          items: invoice.items.map((item) => ({
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
