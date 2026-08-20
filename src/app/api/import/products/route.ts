import { NextRequest, NextResponse } from "next/server";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { productSchema } from "@/lib/validations/product";

function isYes(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "yes";
}

export async function POST(request: NextRequest) {
  const business = await requireCurrentBusiness();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (label: string) => headers.indexOf(label);
  const nameIndex = colIndex("name");
  const priceIndex = colIndex("price");
  if (nameIndex === -1 || priceIndex === -1) {
    return NextResponse.json({ error: 'Missing required "Name" or "Price" column.' }, { status: 400 });
  }
  const skuIndex = colIndex("sku");
  const descriptionIndex = colIndex("description");
  const typeIndex = colIndex("type");
  const taxRateIndex = colIndex("tax rate (%)");
  const activeIndex = colIndex("active");
  const trackInventoryIndex = colIndex("track inventory");
  const stockIndex = colIndex("stock quantity");
  const reorderIndex = colIndex("reorder level");

  let created = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const trackInventory = isYes(trackInventoryIndex >= 0 ? row[trackInventoryIndex] : undefined, false);

    const parsed = productSchema.safeParse({
      name: row[nameIndex] ?? "",
      sku: skuIndex >= 0 ? row[skuIndex] : "",
      description: descriptionIndex >= 0 ? row[descriptionIndex] : "",
      type: (typeIndex >= 0 ? row[typeIndex] : "PRODUCT").trim().toUpperCase() || "PRODUCT",
      price: row[priceIndex] ?? "0",
      taxRate: taxRateIndex >= 0 ? row[taxRateIndex] || "0" : "0",
      isActive: isYes(activeIndex >= 0 ? row[activeIndex] : undefined, true),
      trackInventory,
      reorderLevel: reorderIndex >= 0 ? row[reorderIndex] || "0" : "0",
      initialStock: trackInventory ? (stockIndex >= 0 ? row[stockIndex] || "0" : "0") : "0",
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "Invalid data."}`);
      continue;
    }

    const data = parsed.data;
    const initialStock = data.trackInventory ? data.initialStock : 0;

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId: business.id,
          name: data.name,
          sku: data.sku || null,
          description: data.description || null,
          type: data.type,
          price: data.price.toFixed(2),
          taxRate: data.taxRate.toFixed(2),
          isActive: data.isActive,
          trackInventory: data.trackInventory,
          reorderLevel: data.reorderLevel.toFixed(2),
          stockQuantity: initialStock.toFixed(2),
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            businessId: business.id,
            productId: product.id,
            type: "INCREASE",
            quantity: initialStock.toFixed(2),
            reason: "Imported from CSV",
          },
        });
      }
    });
    created++;
  }

  return NextResponse.json({ created, skipped: errors.length, errors: errors.slice(0, 20) });
}
