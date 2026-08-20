"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";

export type ProductActionState = { error?: string; success?: boolean } | undefined;

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    type: formData.get("type"),
    price: formData.get("price"),
    taxRate: formData.get("taxRate"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    trackInventory:
      formData.get("trackInventory") === "on" || formData.get("trackInventory") === "true",
    reorderLevel: formData.get("reorderLevel") || "0",
    initialStock: formData.get("initialStock") || "0",
  });
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const business = await requireCurrentBusiness();
  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const initialStock = parsed.data.trackInventory ? parsed.data.initialStock : 0;

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId: business.id,
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        description: parsed.data.description || null,
        type: parsed.data.type,
        price: parsed.data.price.toFixed(2),
        taxRate: parsed.data.taxRate.toFixed(2),
        isActive: parsed.data.isActive,
        trackInventory: parsed.data.trackInventory,
        reorderLevel: parsed.data.reorderLevel.toFixed(2),
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
          reason: "Initial stock",
        },
      });
    }
  });

  revalidatePath("/products");
  return { success: true };
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing product id." };
  }

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // stockQuantity is intentionally not editable here — it only changes via
  // adjustStockAction, which keeps every change backed by a StockMovement record.
  const { count } = await prisma.product.updateMany({
    where: { id, businessId: business.id },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      type: parsed.data.type,
      price: parsed.data.price.toFixed(2),
      taxRate: parsed.data.taxRate.toFixed(2),
      isActive: parsed.data.isActive,
      trackInventory: parsed.data.trackInventory,
      reorderLevel: parsed.data.reorderLevel.toFixed(2),
    },
  });

  if (count === 0) {
    return { error: "Product not found." };
  }

  revalidatePath("/products");
  return { success: true };
}

export type DeleteProductActionState = { error?: string; success?: boolean } | undefined;

export async function deleteProductAction(
  _prevState: DeleteProductActionState,
  formData: FormData
): Promise<DeleteProductActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing product id." };
  }

  // Past invoice items snapshot their own description/price/tax and only
  // reference the product loosely (onDelete: SetNull), so this is always safe.
  await prisma.product.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/products");
  return { success: true };
}
