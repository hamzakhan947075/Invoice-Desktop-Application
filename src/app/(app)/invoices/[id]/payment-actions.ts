"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { paymentSchema, type PaymentInput } from "@/lib/validations/payment";
import { applyPayment } from "@/lib/invoice-calculations";

export type PaymentActionResult = { error?: string };

class PaymentActionError extends Error {}

export async function recordPaymentAction(
  invoiceId: string,
  input: PaymentInput
): Promise<PaymentActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  const paymentAmount = new Prisma.Decimal(data.amount.toFixed(2));

  try {
    // The read (current balance) and the write (new balance) must happen in
    // one transaction with an optimistic-concurrency guard on the write —
    // otherwise two concurrent payments can both pass the balance check
    // against the same stale balance and the invoice ends up overpaid.
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId: business.id },
        select: { id: true, status: true, total: true, amountPaid: true, balanceDue: true },
      });
      if (!invoice) throw new PaymentActionError("Invoice not found.");
      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
        throw new PaymentActionError("This invoice can't accept payments.");
      }
      if (paymentAmount.greaterThan(invoice.balanceDue)) {
        throw new PaymentActionError("Payment amount can't exceed the remaining balance.");
      }

      const progress = applyPayment(invoice.total, invoice.amountPaid, paymentAmount);

      await tx.payment.create({
        data: {
          businessId: business.id,
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          reference: data.reference || null,
          notes: data.notes || null,
        },
      });

      // Only applies if amountPaid still matches what we just read — the guard
      // that closes the race window.
      const { count } = await tx.invoice.updateMany({
        where: { id: invoice.id, businessId: business.id, amountPaid: invoice.amountPaid },
        data: {
          amountPaid: progress.amountPaid,
          balanceDue: progress.balanceDue,
          status: progress.isPaidInFull ? "PAID" : "PARTIALLY_PAID",
        },
      });
      if (count === 0) {
        throw new PaymentActionError(
          "This invoice's balance just changed elsewhere. Please review and try again."
        );
      }
    });
  } catch (error) {
    if (error instanceof PaymentActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/");
  return {};
}
