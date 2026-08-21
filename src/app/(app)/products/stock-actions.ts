"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { stockAdjustmentSchema, type StockAdjustmentInput } from "@/lib/validations/stock-adjustment";
import { logActivity } from "@/lib/activity-log";

export type StockAdjustmentActionResult = { error?: string };

class StockAdjustmentActionError extends Error {}

export async function adjustStockAction(
  productId: string,
  input: StockAdjustmentInput
): Promise<StockAdjustmentActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const quantity = new Prisma.Decimal(data.quantity.toFixed(2));

  try {
    // Read-then-guarded-write in one transaction, same optimistic-concurrency
    // pattern as payments/credit notes — closes the race window between two
    // concurrent adjustments to the same product.
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, businessId: business.id },
        select: { id: true, name: true, trackInventory: true, stockQuantity: true },
      });
      if (!product) throw new StockAdjustmentActionError("Product not found.");
      if (!product.trackInventory) {
        throw new StockAdjustmentActionError("This item doesn't have inventory tracking enabled.");
      }

      const delta = data.type === "INCREASE" ? quantity : quantity.negated();
      const newQuantity = product.stockQuantity.plus(delta);
      if (newQuantity.isNegative()) {
        throw new StockAdjustmentActionError("Stock can't go below zero.");
      }

      await tx.stockMovement.create({
        data: {
          businessId: business.id,
          productId: product.id,
          type: data.type,
          quantity,
          reason: data.reason || null,
        },
      });

      const { count } = await tx.product.updateMany({
        where: { id: product.id, businessId: business.id, stockQuantity: product.stockQuantity },
        data: { stockQuantity: newQuantity },
      });
      if (count === 0) {
        throw new StockAdjustmentActionError(
          "This item's stock just changed elsewhere. Please review and try again."
        );
      }

      await logActivity(tx, {
        businessId: business.id,
        action: "product.stock_adjusted",
        entityType: "Product",
        entityId: product.id,
        summary: `${data.type === "INCREASE" ? "Increased" : "Decreased"} stock of ${product.name} by ${quantity.toFixed(2)}`,
        changes: [{ field: "stockQuantity", from: product.stockQuantity.toFixed(2), to: newQuantity.toFixed(2) }],
      });
    });
  } catch (error) {
    if (error instanceof StockAdjustmentActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/products");
  return {};
}
