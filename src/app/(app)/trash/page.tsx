import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { TrashView } from "@/components/trash/trash-view";
import type { CurrencyCode } from "@/lib/currencies";

export default async function TrashPage() {
  const business = await requireCurrentBusiness();

  const [customers, products, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: business.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, email: true, deletedAt: true },
    }),
    prisma.product.findMany({
      where: { businessId: business.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, sku: true, price: true, deletedAt: true },
    }),
    prisma.invoice.findMany({
      where: { businessId: business.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  return (
    <TrashView
      currency={business.currency as CurrencyCode}
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        deletedAt: c.deletedAt!.toISOString(),
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price.toFixed(2),
        deletedAt: p.deletedAt!.toISOString(),
      }))}
      invoices={invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        customerName: i.customer.name,
        total: i.total.toFixed(2),
        deletedAt: i.deletedAt!.toISOString(),
      }))}
    />
  );
}
