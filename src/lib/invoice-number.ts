import type { PrismaTransactionClient } from "@/lib/prisma";

/**
 * Generates the next sequential invoice number for a business, scoped to
 * the given issue year: INV-{year}-{seq:04d}. Must be called inside the same
 * transaction that creates the invoice so the count-then-insert is atomic
 * against the (businessId, invoiceNumber) unique constraint.
 */
export async function generateInvoiceNumber(
  tx: PrismaTransactionClient,
  businessId: string,
  issueDate: Date
): Promise<string> {
  const year = issueDate.getFullYear();
  const count = await tx.invoice.count({
    where: {
      businessId,
      invoiceNumber: { startsWith: `INV-${year}-` },
    },
  });
  const sequence = String(count + 1).padStart(4, "0");
  return `INV-${year}-${sequence}`;
}
