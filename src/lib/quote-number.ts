import type { PrismaTransactionClient } from "@/lib/prisma";

/** Generates the next sequential quote number for a business: QUO-{year}-{seq:04d}. */
export async function generateQuoteNumber(
  tx: PrismaTransactionClient,
  businessId: string,
  issueDate: Date
): Promise<string> {
  const year = issueDate.getFullYear();
  const count = await tx.quote.count({
    where: { businessId, quoteNumber: { startsWith: `QUO-${year}-` } },
  });
  return `QUO-${year}-${String(count + 1).padStart(4, "0")}`;
}
