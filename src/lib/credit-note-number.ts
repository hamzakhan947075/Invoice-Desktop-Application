import type { PrismaTransactionClient } from "@/lib/prisma";

/** Generates the next sequential credit note number for a business: CN-{year}-{seq:04d}. */
export async function generateCreditNoteNumber(
  tx: PrismaTransactionClient,
  businessId: string,
  issueDate: Date
): Promise<string> {
  const year = issueDate.getFullYear();
  const count = await tx.creditNote.count({
    where: { businessId, creditNoteNumber: { startsWith: `CN-${year}-` } },
  });
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}
