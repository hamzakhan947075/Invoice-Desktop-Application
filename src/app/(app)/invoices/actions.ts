"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { invoiceSchema, type InvoiceInput } from "@/lib/validations/invoice";
import { calculateInvoiceTotals, calculateLineItem } from "@/lib/invoice-calculations";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { resolveOwnedProductIds } from "@/lib/resolve-owned-products";
import { logActivity, diffFields } from "@/lib/activity-log";

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

    const created = await tx.invoice.create({
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
      select: { id: true, invoiceNumber: true },
    });

    await logActivity(tx, {
      businessId: business.id,
      action: "invoice.created",
      entityType: "Invoice",
      entityId: created.id,
      summary: `Created invoice ${created.invoiceNumber} for ${totals.total.toFixed(2)} ${data.currency}`,
    });

    return created;
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
    select: {
      id: true,
      status: true,
      invoiceNumber: true,
      customerId: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      total: true,
      notes: true,
    },
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

      await logActivity(tx, {
        businessId: business.id,
        action: "invoice.updated",
        entityType: "Invoice",
        entityId: invoiceId,
        summary: `Updated invoice ${existing.invoiceNumber}`,
        changes: diffFields(
          {
            customerId: existing.customerId,
            issueDate: existing.issueDate.toISOString(),
            dueDate: existing.dueDate.toISOString(),
            currency: existing.currency,
            total: existing.total.toFixed(2),
            notes: existing.notes,
          },
          {
            customerId: data.customerId,
            issueDate: new Date(data.issueDate).toISOString(),
            dueDate: new Date(data.dueDate).toISOString(),
            currency: data.currency,
            total: totals.total.toFixed(2),
            notes: data.notes || null,
          }
        ),
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

export async function deleteInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: business.id },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoice) return { error: "Invoice not found." };

  // Deleting a non-draft invoice also takes its payments and credit notes
  // with it (see the Cascade relations in schema.prisma) once it's purged
  // from trash — the confirmation dialog warns about this up front.
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { deletedAt: new Date() },
  });

  await logActivity(prisma, {
    businessId: business.id,
    action: "invoice.deleted",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Moved invoice ${invoice.invoiceNumber} to Trash`,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/payments");
  revalidatePath("/customers");
  revalidatePath("/trash");
  revalidatePath("/");
  return {};
}

export async function restoreInvoiceAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoice) return { error: "Invoice not found in trash." };

  await prisma.invoice.update({ where: { id: invoice.id }, data: { deletedAt: null } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "invoice.restored",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Restored invoice ${invoice.invoiceNumber} from Trash`,
  });

  revalidatePath("/invoices");
  revalidatePath("/trash");
  revalidatePath("/");
  return {};
}

export async function purgeInvoiceAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoice) return { error: "Invoice not found in trash." };
  await prisma.invoice.delete({ where: { id: invoice.id } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "invoice.purged",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Permanently deleted invoice ${invoice.invoiceNumber}`,
  });

  revalidatePath("/trash");
  return {};
}

export async function cancelInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId: business.id,
      status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID", "OVERDUE"] },
    },
    select: { id: true, invoiceNumber: true, status: true },
  });
  if (!invoice) {
    return { error: "This invoice can't be cancelled." };
  }

  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "invoice.cancelled",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Cancelled invoice ${invoice.invoiceNumber}`,
    changes: [{ field: "status", from: invoice.status, to: "CANCELLED" }],
  });

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

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId: business.id,
      status: { in: ["SENT", "PARTIALLY_PAID"] },
    },
    select: { id: true, invoiceNumber: true, status: true },
  });
  if (!invoice) {
    return { error: "Only a sent or partially-paid invoice can be marked overdue." };
  }

  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "invoice.status_changed",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Marked invoice ${invoice.invoiceNumber} as Overdue`,
    changes: [{ field: "status", from: invoice.status, to: "OVERDUE" }],
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return {};
}

/**
 * Records that the user handed this invoice off to their email client via
 * the Send/Resend Email button. There's no real send happening here — the
 * app never touches the customer's inbox — so this is "the user clicked
 * send," not delivery confirmation.
 */
export async function recordInvoiceEmailedAction(invoiceId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: business.id },
    select: { id: true, invoiceNumber: true, lastEmailedAt: true },
  });
  if (!invoice) return { error: "Invoice not found." };

  const wasResend = invoice.lastEmailedAt !== null;
  await prisma.invoice.update({ where: { id: invoice.id }, data: { lastEmailedAt: new Date() } });

  await logActivity(prisma, {
    businessId: business.id,
    action: wasResend ? "invoice.email_resent" : "invoice.emailed",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${wasResend ? "Resent" : "Emailed"} invoice ${invoice.invoiceNumber} to the customer`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return {};
}

