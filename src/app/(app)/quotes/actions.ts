"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { quoteSchema, type QuoteInput } from "@/lib/validations/quote";
import { calculateInvoiceTotals, calculateLineItem } from "@/lib/invoice-calculations";
import { generateQuoteNumber } from "@/lib/quote-number";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { resolveOwnedProductIds } from "@/lib/resolve-owned-products";
import { getEffectiveQuoteStatus } from "@/lib/quote-status";
import { logActivity } from "@/lib/activity-log";

export type QuoteActionResult = { error?: string; quoteId?: string };

class QuoteActionError extends Error {}

function buildItemsData(items: QuoteInput["items"], ownedProductIds: Set<string>) {
  return items.map((item) => {
    const { lineTotal } = calculateLineItem(item);
    return {
      productId: item.productId && ownedProductIds.has(item.productId) ? item.productId : null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      lineTotal,
    };
  });
}

export async function createQuoteAction(input: QuoteInput): Promise<QuoteActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId: business.id },
    select: { id: true },
  });
  if (!customer) return { error: "Select a valid customer." };

  const ownedProductIds = await resolveOwnedProductIds(business.id, data.items);
  const totals = calculateInvoiceTotals(data.items);
  const issueDate = new Date(data.issueDate);

  const quote = await prisma.$transaction(async (tx) => {
    const quoteNumber = await generateQuoteNumber(tx, business.id, issueDate);
    const created = await tx.quote.create({
      data: {
        businessId: business.id,
        customerId: data.customerId,
        quoteNumber,
        issueDate,
        expiryDate: new Date(data.expiryDate),
        status: "DRAFT",
        currency: data.currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        notes: data.notes || null,
        items: { create: buildItemsData(data.items, ownedProductIds) },
      },
      select: { id: true, quoteNumber: true },
    });

    await logActivity(tx, {
      businessId: business.id,
      action: "quote.created",
      entityType: "Quote",
      entityId: created.id,
      summary: `Created quote ${created.quoteNumber} for ${totals.total.toFixed(2)} ${data.currency}`,
    });

    return created;
  });

  revalidatePath("/quotes");
  return { quoteId: quote.id };
}

export async function updateQuoteAction(
  quoteId: string,
  input: QuoteInput
): Promise<QuoteActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId: business.id },
    select: { id: true },
  });
  if (!customer) return { error: "Select a valid customer." };

  const ownedProductIds = await resolveOwnedProductIds(business.id, data.items);
  const totals = calculateInvoiceTotals(data.items);

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findFirst({
        where: { id: quoteId, businessId: business.id, status: "DRAFT" },
        select: { quoteNumber: true },
      });
      if (!existing) {
        throw new QuoteActionError("Only draft quotes can be edited.");
      }

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          customerId: data.customerId,
          issueDate: new Date(data.issueDate),
          expiryDate: new Date(data.expiryDate),
          currency: data.currency,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          notes: data.notes || null,
        },
      });

      await tx.quoteItem.deleteMany({ where: { quoteId } });
      await tx.quoteItem.createMany({
        data: buildItemsData(data.items, ownedProductIds).map((item) => ({ ...item, quoteId })),
      });

      await logActivity(tx, {
        businessId: business.id,
        action: "quote.updated",
        entityType: "Quote",
        entityId: quoteId,
        summary: `Updated quote ${existing.quoteNumber}`,
      });
    });
  } catch (error) {
    if (error instanceof QuoteActionError) return { error: error.message };
    throw error;
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return { quoteId };
}

export async function deleteDraftQuoteAction(quoteId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId: business.id, status: "DRAFT" },
    select: { id: true, quoteNumber: true },
  });
  if (!quote) return { error: "Only draft quotes can be deleted." };

  await prisma.quote.delete({ where: { id: quote.id } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "quote.deleted",
    entityType: "Quote",
    entityId: quote.id,
    summary: `Deleted draft quote ${quote.quoteNumber}`,
  });

  revalidatePath("/quotes");
  return {};
}

async function setQuoteStatus(
  quoteId: string,
  fromStatuses: ("DRAFT" | "SENT" | "ACCEPTED" | "REJECTED")[],
  toStatus: "SENT" | "ACCEPTED" | "REJECTED"
): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId: business.id, status: { in: fromStatuses } },
    select: { id: true, quoteNumber: true, status: true },
  });
  if (!quote) return { error: "This quote can't be updated." };

  await prisma.quote.update({ where: { id: quote.id }, data: { status: toStatus } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "quote.status_changed",
    entityType: "Quote",
    entityId: quote.id,
    summary: `Marked quote ${quote.quoteNumber} as ${toStatus[0]}${toStatus.slice(1).toLowerCase()}`,
    changes: [{ field: "status", from: quote.status, to: toStatus }],
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return {};
}

export async function markQuoteSentAction(quoteId: string) {
  return setQuoteStatus(quoteId, ["DRAFT"], "SENT");
}

export async function markQuoteAcceptedAction(quoteId: string) {
  return setQuoteStatus(quoteId, ["SENT"], "ACCEPTED");
}

export async function markQuoteRejectedAction(quoteId: string) {
  return setQuoteStatus(quoteId, ["SENT"], "REJECTED");
}

export async function convertQuoteToInvoiceAction(
  quoteId: string
): Promise<{ error?: string; invoiceId?: string }> {
  const business = await requireCurrentBusiness();

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId: business.id },
    include: { items: true },
  });
  if (!quote) return { error: "Quote not found." };
  // Re-derive effective status — a stored SENT quote past its expiry date
  // must not be convertible even though the raw column still says SENT.
  if (getEffectiveQuoteStatus(quote) !== "ACCEPTED") {
    return { error: "Only accepted quotes can be converted to an invoice." };
  }

  const totals = calculateInvoiceTotals(
    quote.items.map((item) => ({
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      discount: item.discount.toNumber(),
      taxRate: item.taxRate.toNumber(),
    }))
  );

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const { count } = await tx.quote.updateMany({
        where: { id: quoteId, businessId: business.id, status: "ACCEPTED" },
        data: { status: "CONVERTED" },
      });
      if (count === 0) {
        throw new QuoteActionError("This quote was just updated elsewhere. Please try again.");
      }

      const invoiceNumber = await generateInvoiceNumber(tx, business.id, issueDate);
      const created = await tx.invoice.create({
        data: {
          businessId: business.id,
          customerId: quote.customerId,
          invoiceNumber,
          issueDate,
          dueDate,
          status: "DRAFT",
          currency: quote.currency,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          amountPaid: 0,
          balanceDue: totals.total,
          notes: quote.notes,
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              lineTotal: item.lineTotal,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      await tx.quote.update({ where: { id: quoteId }, data: { convertedInvoiceId: created.id } });

      await logActivity(tx, {
        businessId: business.id,
        action: "quote.converted",
        entityType: "Quote",
        entityId: quoteId,
        summary: `Converted quote ${quote.quoteNumber} to invoice ${created.invoiceNumber}`,
      });

      return created;
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/invoices");
    return { invoiceId: invoice.id };
  } catch (error) {
    if (error instanceof QuoteActionError) return { error: error.message };
    throw error;
  }
}
