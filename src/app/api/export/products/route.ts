import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  const business = await requireCurrentBusiness();

  const products = await prisma.product.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
  });

  const csv = toCsv(
    [
      "Name",
      "SKU",
      "Description",
      "Type",
      "Price",
      "Tax Rate (%)",
      "Active",
      "Track Inventory",
      "Stock Quantity",
      "Reorder Level",
    ],
    products.map((p) => [
      p.name,
      p.sku,
      p.description,
      p.type,
      p.price.toFixed(2),
      p.taxRate.toFixed(2),
      p.isActive ? "Yes" : "No",
      p.trackInventory ? "Yes" : "No",
      p.trackInventory ? p.stockQuantity.toFixed(2) : "",
      p.trackInventory ? p.reorderLevel.toFixed(2) : "",
    ])
  );

  return new Response(csv, { headers: csvResponseHeaders("products.csv") });
}
