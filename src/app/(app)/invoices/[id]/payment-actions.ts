"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { paymentSchema, paymentEditSchema, type PaymentInput, type PaymentEditInput } from "@/lib/validations/payment";
import { applyPayment } from "@/lib/invoice-calculations";
import { logActivity } from "@/lib/activity-log";

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
        select: { id: true, invoiceNumber: true, status: true, total: true, amountPaid: true, balanceDue: true },
      });
      if (!invoice) throw new PaymentActionError("Invoice not found.");
      // Draft invoices can accept payments too — there's no separate "mark as
      // sent" step, so recording a payment is what moves a Draft forward.
      if (invoice.status === "CANCELLED") {
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

      await logActivity(tx, {
        businessId: business.id,
        action: "payment.recorded",
        entityType: "Payment",
        entityId: invoice.id,
        summary: `Recorded ${paymentAmount.toFixed(2)} payment on invoice ${invoice.invoiceNumber}`,
      });
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

/**
 * Corrects a previously recorded payment's method/date/reference/notes —
 * never its amount, which would require recomputing the invoice's
 * amountPaid/balanceDue/status (a materially different, riskier operation).
 */
export async function updatePaymentAction(
  paymentId: string,
  input: PaymentEditInput
): Promise<PaymentActionResult> {
  const business = await requireCurrentBusiness();

  const parsed = paymentEditSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId: business.id },
    select: { id: true, invoiceId: true, paymentMethod: true, invoice: { select: { invoiceNumber: true } } },
  });
  if (!payment) return { error: "Payment not found." };

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentDate: new Date(data.paymentDate),
      paymentMethod: data.paymentMethod,
      reference: data.reference || null,
      notes: data.notes || null,
    },
  });

  await logActivity(prisma, {
    businessId: business.id,
    action: "payment.updated",
    entityType: "Payment",
    entityId: payment.id,
    summary: `Updated payment on invoice ${payment.invoice.invoiceNumber}`,
    changes: [{ field: "paymentMethod", from: payment.paymentMethod, to: data.paymentMethod }],
  });

  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/payments");
  return {};
}
