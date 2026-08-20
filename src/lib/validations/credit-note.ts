import { z } from "zod";

export const creditNoteSchema = z.object({
  amount: z
    .number({ error: "Amount must be a number." })
    .positive("Amount must be greater than zero."),
  reason: z.string().trim().min(1, "Reason is required.").max(500, "Reason is too long."),
});

export type CreditNoteInput = z.infer<typeof creditNoteSchema>;
