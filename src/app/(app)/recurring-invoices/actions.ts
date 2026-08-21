"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  recurringInvoiceSchema,
  type RecurringInvoiceInput,
} from "@/lib/validations/recurring-invoice";
import { resolveOwnedProductIds } from "@/lib/resolve-owned-products";
import { generateInvoiceFromTemplate } from "@/lib/recurring-invoice-generator";
import { logActivity } from "@/lib/activity-log";

export type RecurringInvoiceActionResult = { error?: string; recurringInvoiceId?: string };

function buildItemsData(items: RecurringInvoiceInput["items"], ownedProductIds: Set<string>) {
  return items.map((item) => ({
    productId: item.productId && ownedProductIds.has(item.productId) ? item.productId : null,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    taxRate: item.taxRate,
  }));
}

export async function createRecurringInvoiceAction(
  input: RecurringInvoiceInput
): Promise<RecurringInvoiceActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = recurringInvoiceSchema.safeParse(input);
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

  const template = await prisma.recurringInvoice.create({
    data: {
      businessId: business.id,
      customerId: data.customerId,
      frequency: data.frequency,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextRunDate: new Date(data.startDate),
      dueInDays: data.dueInDays,
      currency: data.currency,
      notes: data.notes || null,
      items: { create: buildItemsData(data.items, ownedProductIds) },
    },
    select: { id: true },
  });

  await logActivity(prisma, {
    businessId: business.id,
    action: "recurring_invoice.created",
    entityType: "RecurringInvoice",
    entityId: template.id,
    summary: `Created recurring invoice template (${data.frequency.toLowerCase()})`,
  });

  revalidatePath("/recurring-invoices");
  return { recurringInvoiceId: template.id };
}

export async function updateRecurringInvoiceAction(
  templateId: string,
  input: RecurringInvoiceInput
): Promise<RecurringInvoiceActionResult> {
  const business = await requireCurrentBusiness();

  const existing = await prisma.recurringInvoice.findFirst({
    where: { id: templateId, businessId: business.id },
    select: { id: true },
  });
  if (!existing) return { error: "Recurring invoice not found." };

  const parsed = recurringInvoiceSchema.safeParse(input);
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

  await prisma.$transaction(async (tx) => {
    await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: templateId } });
    await tx.recurringInvoice.update({
      where: { id: templateId },
      data: {
        customerId: data.customerId,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        dueInDays: data.dueInDays,
        currency: data.currency,
        notes: data.notes || null,
        items: { create: buildItemsData(data.items, ownedProductIds) },
      },
    });

    await logActivity(tx, {
      businessId: business.id,
      action: "recurring_invoice.updated",
      entityType: "RecurringInvoice",
      entityId: templateId,
      summary: "Updated recurring invoice template",
    });
  });

  revalidatePath("/recurring-invoices");
  revalidatePath(`/recurring-invoices/${templateId}`);
  return { recurringInvoiceId: templateId };
}

async function setStatus(
  templateId: string,
  fromStatuses: ("ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED")[],
  toStatus: "ACTIVE" | "PAUSED" | "CANCELLED"
): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const template = await prisma.recurringInvoice.findFirst({
    where: { id: templateId, businessId: business.id, status: { in: fromStatuses } },
    select: { id: true, status: true },
  });
  if (!template) {
    return { error: "This recurring invoice can't be updated." };
  }

  await prisma.recurringInvoice.update({ where: { id: template.id }, data: { status: toStatus } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "recurring_invoice.status_changed",
    entityType: "RecurringInvoice",
    entityId: template.id,
    summary: `${toStatus === "PAUSED" ? "Paused" : toStatus === "ACTIVE" ? "Resumed" : "Cancelled"} recurring invoice template`,
    changes: [{ field: "status", from: template.status, to: toStatus }],
  });

  revalidatePath("/recurring-invoices");
  revalidatePath(`/recurring-invoices/${templateId}`);
  return {};
}

export async function pauseRecurringInvoiceAction(templateId: string) {
  return setStatus(templateId, ["ACTIVE"], "PAUSED");
}

export async function resumeRecurringInvoiceAction(templateId: string) {
  return setStatus(templateId, ["PAUSED"], "ACTIVE");
}

export async function cancelRecurringInvoiceAction(templateId: string) {
  return setStatus(templateId, ["ACTIVE", "PAUSED"], "CANCELLED");
}

export async function deleteRecurringInvoiceAction(templateId: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();

  const template = await prisma.recurringInvoice.findFirst({
    where: { id: templateId, businessId: business.id },
    select: { id: true },
  });
  if (!template) {
    return { error: "Recurring invoice not found." };
  }

  await prisma.recurringInvoice.delete({ where: { id: template.id } });

  await logActivity(prisma, {
    businessId: business.id,
    action: "recurring_invoice.deleted",
    entityType: "RecurringInvoice",
    entityId: template.id,
    summary: "Deleted recurring invoice template",
  });

  revalidatePath("/recurring-invoices");
  return {};
}

export async function generateNowAction(
  templateId: string
): Promise<{ error?: string; invoiceId?: string; invoiceNumber?: string }> {
  const business = await requireCurrentBusiness();

  // Ownership check happens here, before handing off to the shared generator
  // (which itself is unscoped by design, since the cron sweep also uses it).
  const template = await prisma.recurringInvoice.findFirst({
    where: { id: templateId, businessId: business.id },
    select: { id: true, status: true },
  });
  if (!template) return { error: "Recurring invoice not found." };
  if (template.status !== "ACTIVE") {
    return { error: "Only active recurring invoices can be generated." };
  }

  const result = await generateInvoiceFromTemplate(templateId);
  if (!result) return { error: "Nothing to generate." };

  revalidatePath("/recurring-invoices");
  revalidatePath("/invoices");
  revalidatePath("/");
  return { invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber };
}
