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
    return tx.quote.create({
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
      select: { id: true },
    });
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
      const { count } = await tx.quote.updateMany({
        where: { id: quoteId, businessId: business.id, status: "DRAFT" },
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
      if (count === 0) {
        throw new QuoteActionError("Only draft quotes can be edited.");
      }

      await tx.quoteItem.deleteMany({ where: { quoteId } });
      await tx.quoteItem.createMany({
        data: buildItemsData(data.items, ownedProductIds).map((item) => ({ ...item, quoteId })),
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

  const { count } = await prisma.quote.deleteMany({
    where: { id: quoteId, businessId: business.id, status: "DRAFT" },
  });
  if (count === 0) return { error: "Only draft quotes can be deleted." };

  revalidatePath("/quotes");
  return {};
}

async function setQuoteStatus(
  quoteId: string,
  fromStatuses: ("DRAFT" | "SENT" | "ACCEPTED" | "REJECTED")[],
  toStatus: "SENT" | "ACCEPTED" | "REJECTED"
): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const { count } = await prisma.quote.updateMany({
    where: { id: quoteId, businessId: business.id, status: { in: fromStatuses } },
    data: { status: toStatus },
  });
  if (count === 0) return { error: "This quote can't be updated." };

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
        select: { id: true },
      });

      await tx.quote.update({ where: { id: quoteId }, data: { convertedInvoiceId: created.id } });
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
