"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { invoiceSchema, type InvoiceInput } from "@/lib/validations/invoice";
import { calculateInvoiceTotals, calculateLineItem, applyPayment } from "@/lib/invoice-calculations";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { resolveOwnedProductIds } from "@/lib/resolve-owned-products";

export type InvoiceActionResult = { error?: string; invoiceId?: string };

class InvoiceActionError extends Error {}

export async function createInvoiceAction(input: InvoiceInput): Promise<InvoiceActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId: business.id },
    select: { id: true },
  });
  if (!customer) {
    return { error: "Select a valid customer." };
  }

  // Only trust productId references that actually belong to this business.
  const ownedProductIds = await resolveOwnedProductIds(business.id, data.items);

  const totals = calculateInvoiceTotals(data.items);
  const issueDate = new Date(data.issueDate);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx, business.id, issueDate);

    return tx.invoice.create({
      data: {
        businessId: business.id,
        customerId: data.customerId,
        invoiceNumber,
        issueDate,
        dueDate: new Date(data.dueDate),
        status: "DRAFT",
        currency: data.currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        notes: data.notes || null,
        items: {
          create: data.items.map((item) => {
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
          }),
        },
      },
      select: { id: true },
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/");
  return { invoiceId: invoice.id };
}

export async function updateInvoiceAction(
  invoiceId: string,
  input: InvoiceInput
): Promise<InvoiceActionResult> {
  const business = await requireCurrentBusiness();

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: business.id },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "Invoice not found." };
  if (existing.status !== "DRAFT") {
    return { error: "Only draft invoices can be edited." };
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId: business.id },
    select: { id: true },
  });
  if (!customer) {
    return { error: "Select a valid customer." };
  }

  const ownedProductIds = await resolveOwnedProductIds(business.id, data.items);
  const totals = calculateInvoiceTotals(data.items);

  try {
    await prisma.$transaction(async (tx) => {
      // Re-verify DRAFT status and tenant ownership atomically with the write —
      // the earlier check above is only a fast-path UX guard, not the source of
      // truth, since the invoice could be marked Sent by another request in between.
      const { count } = await tx.invoice.updateMany({
        where: { id: invoiceId, businessId: business.id, status: "DRAFT" },
        data: {
          customerId: data.customerId,
          issueDate: new Date(data.issueDate),
          dueDate: new Date(data.dueDate),
          currency: data.currency,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          balanceDue: totals.total,
          notes: data.notes || null,
        },
      });
      if (count === 0) {
        throw new InvoiceActionError("Only draft invoices can be edited.");
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      await tx.invoiceItem.createMany({
        data: data.items.map((item) => {
          const { lineTotal } = calculateLineItem(item);
          return {
            invoiceId,
            productId: item.productId && ownedProductIds.has(item.productId) ? item.productId : null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal,
          };
        }),
      });
    });
  } catch (error) {
    if (error instanceof InvoiceActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return { invoiceId };
}

export async function deleteDraftInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const { count } = await prisma.invoice.deleteMany({
    where: { id: invoiceId, businessId: business.id, status: "DRAFT" },
  });

  if (count === 0) {
    return { error: "Only draft invoices can be deleted." };
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/invoices");
}

export async function markInvoiceSentAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const { count } = await prisma.invoice.updateMany({
    where: { id: invoiceId, businessId: business.id, status: "DRAFT" },
    data: { status: "SENT" },
  });

  if (count === 0) {
    return { error: "Only draft invoices can be marked as sent." };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return {};
}

export async function cancelInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const { count } = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      businessId: business.id,
      status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
    data: { status: "CANCELLED" },
  });

  if (count === 0) {
    return { error: "This invoice can't be cancelled." };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return {};
}

/**
 * Manually flags an invoice OVERDUE ahead of (or independent of) the automatic
 * due-date derivation in getEffectiveInvoiceStatus — once stored, that function's
 * fallback returns it as-is, so a manual OVERDUE sticks until cancelled or paid,
 * regardless of due date.
 */
export async function markInvoiceOverdueAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const { count } = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      businessId: business.id,
      status: { in: ["SENT", "PARTIALLY_PAID"] },
    },
    data: { status: "OVERDUE" },
  });

  if (count === 0) {
    return { error: "Only a sent or partially-paid invoice can be marked overdue." };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return {};
}

class MarkPaidActionError extends Error {}

/**
 * Marks an invoice fully paid by recording a real payment for the entire
 * remaining balance — money math (amountPaid/balanceDue) always stays
 * consistent with status, the same as using Record Payment for the full
 * amount. Uses the same read-then-guarded-write transaction pattern as
 * recordPaymentAction to close the same concurrent-payment race.
 */
export async function markInvoicePaidAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId: business.id },
        select: { id: true, status: true, total: true, amountPaid: true, balanceDue: true },
      });
      if (!invoice) throw new MarkPaidActionError("Invoice not found.");
      if (!["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
        throw new MarkPaidActionError("This invoice can't be marked paid.");
      }
      if (invoice.balanceDue.lessThanOrEqualTo(0)) {
        throw new MarkPaidActionError("This invoice has no remaining balance.");
      }

      const paymentAmount = invoice.balanceDue;
      const progress = applyPayment(invoice.total, invoice.amountPaid, paymentAmount);

      await tx.payment.create({
        data: {
          businessId: business.id,
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentDate: new Date(),
          paymentMethod: "OTHER",
          notes: 'Recorded via "Mark as Paid."',
        },
      });

      const { count } = await tx.invoice.updateMany({
        where: { id: invoice.id, businessId: business.id, amountPaid: invoice.amountPaid },
        data: {
          amountPaid: progress.amountPaid,
          balanceDue: progress.balanceDue,
          status: "PAID",
        },
      });
      if (count === 0) {
        throw new MarkPaidActionError(
          "This invoice's balance just changed elsewhere. Please review and try again."
        );
      }
    });
  } catch (error) {
    if (error instanceof MarkPaidActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/payments");
  revalidatePath("/");
  return {};
}
