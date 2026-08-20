import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ProductsView } from "@/components/products/products-view";
import type { CurrencyCode } from "@/lib/currencies";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: {
      businessId: business.id,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { sku: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    type: product.type,
    price: product.price.toFixed(2),
    taxRate: product.taxRate.toFixed(2),
    isActive: product.isActive,
    trackInventory: product.trackInventory,
    stockQuantity: product.stockQuantity.toFixed(2),
    reorderLevel: product.reorderLevel.toFixed(2),
  }));

  return (
    <ProductsView products={rows} currency={business.currency as CurrencyCode} searchQuery={query} />
  );
}
