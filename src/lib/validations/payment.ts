import { z } from "zod";

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "JAZZCASH",
  "EASYPAISA",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
  OTHER: "Other",
};

export const paymentSchema = z.object({
  amount: z
    .number({ error: "Amount must be a number." })
    .positive("Amount must be greater than zero."),
  paymentDate: z.string().trim().min(1, "Payment date is required."),
  paymentMethod: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120, "Reference is too long.").optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Notes are too long.").optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
