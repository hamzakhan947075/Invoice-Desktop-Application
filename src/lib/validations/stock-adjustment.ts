import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  type: z.enum(["INCREASE", "DECREASE"]),
  quantity: z
    .number({ error: "Quantity must be a number." })
    .positive("Quantity must be greater than zero.")
    .max(999_999_999, "Quantity is too large."),
  reason: z.string().trim().max(500, "Reason is too long.").optional().or(z.literal("")),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
