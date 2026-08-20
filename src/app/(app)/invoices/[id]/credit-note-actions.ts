"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { creditNoteSchema, type CreditNoteInput } from "@/lib/validations/credit-note";
import { generateCreditNoteNumber } from "@/lib/credit-note-number";

export type CreditNoteActionResult = { error?: string };

class CreditNoteActionError extends Error {}

export async function issueCreditNoteAction(
  invoiceId: string,
  input: CreditNoteInput
): Promise<CreditNoteActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = creditNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const creditAmount = new Prisma.Decimal(data.amount.toFixed(2));

  try {
    // Same read-then-guarded-write pattern as payments: the balance read and
    // the balance write must be in one transaction with an optimistic
    // concurrency check, otherwise a concurrent payment or credit note can
    // both pass the balance check against the same stale balanceDue.
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId: business.id },
        select: { id: true, status: true, balanceDue: true },
      });
      if (!invoice) throw new CreditNoteActionError("Invoice not found.");
      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
        throw new CreditNoteActionError("This invoice can't receive credit notes.");
      }
      if (creditAmount.greaterThan(invoice.balanceDue)) {
        throw new CreditNoteActionError("Credit amount can't exceed the remaining balance.");
      }

      const creditNoteNumber = await generateCreditNoteNumber(tx, business.id, new Date());
      const newBalance = invoice.balanceDue.minus(creditAmount);

      await tx.creditNote.create({
        data: {
          businessId: business.id,
          invoiceId: invoice.id,
          creditNoteNumber,
          issueDate: new Date(),
          amount: creditAmount,
          reason: data.reason,
        },
      });

      const { count } = await tx.invoice.updateMany({
        where: { id: invoice.id, businessId: business.id, balanceDue: invoice.balanceDue },
        data: {
          balanceDue: newBalance,
          status: newBalance.lessThanOrEqualTo(0) ? "PAID" : invoice.status,
        },
      });
      if (count === 0) {
        throw new CreditNoteActionError(
          "This invoice's balance just changed elsewhere. Please review and try again."
        );
      }
    });
  } catch (error) {
    if (error instanceof CreditNoteActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/credit-notes");
  revalidatePath("/");
  return {};
}
