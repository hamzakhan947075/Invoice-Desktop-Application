"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";
import { logActivity, diffFields } from "@/lib/activity-log";

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

    await logActivity(tx, {
      businessId: business.id,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      summary: `Created product ${product.name}`,
    });
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

  const before = await prisma.product.findFirst({
    where: { id, businessId: business.id },
    select: { name: true, sku: true, price: true, taxRate: true, isActive: true },
  });
  if (!before) return { error: "Product not found." };

  // stockQuantity is intentionally not editable here — it only changes via
  // adjustStockAction, which keeps every change backed by a StockMovement record.
  const after = {
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    description: parsed.data.description || null,
    type: parsed.data.type,
    price: parsed.data.price.toFixed(2),
    taxRate: parsed.data.taxRate.toFixed(2),
    isActive: parsed.data.isActive,
    trackInventory: parsed.data.trackInventory,
    reorderLevel: parsed.data.reorderLevel.toFixed(2),
  };
  const { count } = await prisma.product.updateMany({
    where: { id, businessId: business.id },
    data: after,
  });

  if (count === 0) {
    return { error: "Product not found." };
  }

  await logActivity(prisma, {
    businessId: business.id,
    action: "product.updated",
    entityType: "Product",
    entityId: id,
    summary: `Updated product ${after.name}`,
    changes: diffFields(
      { name: before.name, sku: before.sku, price: before.price.toFixed(2), taxRate: before.taxRate.toFixed(2), isActive: before.isActive },
      { name: after.name, sku: after.sku, price: after.price, taxRate: after.taxRate, isActive: after.isActive }
    ),
  });

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

  const product = await prisma.product.findFirst({ where: { id, businessId: business.id }, select: { id: true, name: true } });

  // Past invoice items snapshot their own description/price/tax and only
  // reference the product loosely (onDelete: SetNull), so this is always safe.
  await prisma.product.updateMany({
    where: { id, businessId: business.id },
    data: { deletedAt: new Date() },
  });

  if (product) {
    await logActivity(prisma, {
      businessId: business.id,
      action: "product.deleted",
      entityType: "Product",
      entityId: product.id,
      summary: `Moved product ${product.name} to Trash`,
    });
  }

  revalidatePath("/products");
  revalidatePath("/trash");
  return { success: true };
}

export async function restoreProductAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const product = await prisma.product.findFirst({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    select: { id: true, name: true },
  });
  if (!product) return { error: "Product not found in trash." };

  await prisma.product.update({ where: { id: product.id }, data: { deletedAt: null } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "product.restored",
    entityType: "Product",
    entityId: product.id,
    summary: `Restored product ${product.name} from Trash`,
  });

  revalidatePath("/products");
  revalidatePath("/trash");
  return {};
}

export async function purgeProductAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const product = await prisma.product.findFirst({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    select: { id: true, name: true },
  });
  if (!product) return { error: "Product not found in trash." };
  await prisma.product.delete({ where: { id: product.id } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "product.purged",
    entityType: "Product",
    entityId: product.id,
    summary: `Permanently deleted product ${product.name}`,
  });

  revalidatePath("/trash");
  return {};
}
