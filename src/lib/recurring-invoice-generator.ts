import { prisma } from "@/lib/prisma";
import { calculateInvoiceTotals, calculateLineItem } from "@/lib/invoice-calculations";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { calculateNextRunDate } from "@/lib/recurring-invoice-schedule";
import { logActivity } from "@/lib/activity-log";

export type GeneratedInvoiceSummary = {
  recurringInvoiceId: string;
  invoiceId: string;
  invoiceNumber: string;
};

/**
 * Generates a real Invoice from one recurring template and advances its
 * schedule, in a single transaction. Shared by the cron sweep (system-wide,
 * unscoped by design) and the per-business "Generate Now" action (which
 * scopes the template lookup by businessId before calling this).
 */
export async function generateInvoiceFromTemplate(
  templateId: string
): Promise<GeneratedInvoiceSummary | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.recurringInvoice.findUnique({
      where: { id: templateId },
      include: { items: true },
    });
    if (!template || template.status !== "ACTIVE") return null;

    const itemsForCalc = template.items.map((item) => ({
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      discount: item.discount.toNumber(),
      taxRate: item.taxRate.toNumber(),
    }));
    const totals = calculateInvoiceTotals(itemsForCalc);

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + template.dueInDays);

    const invoiceNumber = await generateInvoiceNumber(tx, template.businessId, issueDate);

    const invoice = await tx.invoice.create({
      data: {
        businessId: template.businessId,
        customerId: template.customerId,
        recurringInvoiceId: template.id,
        invoiceNumber,
        issueDate,
        dueDate,
        // Auto-generated invoices go straight to Sent — the whole point of
        // automation is not having to manually send each one.
        status: "SENT",
        currency: template.currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        notes: template.notes,
        items: {
          create: template.items.map((item) => {
            const { lineTotal } = calculateLineItem({
              quantity: item.quantity.toNumber(),
              unitPrice: item.unitPrice.toNumber(),
              discount: item.discount.toNumber(),
              taxRate: item.taxRate.toNumber(),
            });
            return {
              productId: item.productId,
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

    // Advance from the *scheduled* date, not from today — generating early
    // (via "Generate Now") must not shift the rest of the schedule.
    const nextRunDate = calculateNextRunDate(template.nextRunDate, template.frequency);
    const isPastEnd = template.endDate ? nextRunDate.getTime() > template.endDate.getTime() : false;

    await tx.recurringInvoice.update({
      where: { id: template.id },
      data: {
        nextRunDate,
        lastGeneratedAt: new Date(),
        status: isPastEnd ? "COMPLETED" : "ACTIVE",
      },
    });

    await logActivity(tx, {
      businessId: template.businessId,
      action: "recurring_invoice.generated",
      entityType: "RecurringInvoice",
      entityId: template.id,
      summary: `Generated invoice ${invoice.invoiceNumber} from recurring template`,
    });

    return {
      recurringInvoiceId: template.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    };
  });
}

/**
 * Sweeps every business for recurring templates due today or earlier and
 * generates their invoices. Not scoped to a single business by design — a
 * cron run must cover every tenant. Templates are processed sequentially so
 * two due templates for the same business never race on invoice numbering.
 */
export async function generateDueInvoices(): Promise<GeneratedInvoiceSummary[]> {
  const dueTemplates = await prisma.recurringInvoice.findMany({
    where: { status: "ACTIVE", nextRunDate: { lte: new Date() } },
    select: { id: true },
  });

  const results: GeneratedInvoiceSummary[] = [];
  for (const template of dueTemplates) {
    const result = await generateInvoiceFromTemplate(template.id);
    if (result) results.push(result);
  }
  return results;
}
