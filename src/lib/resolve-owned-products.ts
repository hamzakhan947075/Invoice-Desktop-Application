import { prisma } from "@/lib/prisma";

/**
 * Returns the subset of the given productIds that actually belong to this
 * business. Used before trusting a client-submitted productId on an
 * invoice/recurring-invoice line item — any id not in the returned set must
 * be treated as absent (nulled out), never passed through to the database.
 */
export async function resolveOwnedProductIds(
  businessId: string,
  items: { productId?: string }[]
): Promise<Set<string>> {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id))),
  ];
  if (productIds.length === 0) return new Set<string>();

  const ownedProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true },
  });
  return new Set(ownedProducts.map((p) => p.id));
}
