import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { CurrencyCode } from "@/lib/currencies";

export default async function NewInvoicePage() {
  const business = await requireCurrentBusiness();

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
      <h2 className="font-heading text-lg font-semibold">New Invoice</h2>
      <InvoiceForm
        customers={customers}
        products={products.map((p) => ({
          ...p,
          price: p.price.toFixed(2),
          taxRate: p.taxRate.toFixed(2),
        }))}
        defaultCurrency={business.currency as CurrencyCode}
      />
    </div>
  );
}
