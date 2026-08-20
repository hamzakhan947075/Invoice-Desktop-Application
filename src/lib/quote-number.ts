import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Generates the next sequential quote number for a business: QUO-{year}-{seq:04d}. */
export async function generateQuoteNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  businessId: string,
  issueDate: Date
): Promise<string> {
  const year = issueDate.getFullYear();
  const count = await tx.quote.count({
    where: { businessId, quoteNumber: { startsWith: `QUO-${year}-` } },
  });
  return `QUO-${year}-${String(count + 1).padStart(4, "0")}`;
}
