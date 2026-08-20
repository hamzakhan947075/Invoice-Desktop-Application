import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters."),
  sku: z.string().trim().max(60, "SKU is too long.").optional().or(z.literal("")),
  description: z.string().trim().max(1000, "Description is too long.").optional().or(z.literal("")),
  type: z.enum(["PRODUCT", "SERVICE"]),
  price: z.coerce
    .number({ error: "Price must be a number." })
    .nonnegative("Price can't be negative.")
    .max(999_999_999, "Price is too large."),
  taxRate: z.coerce
    .number({ error: "Tax rate must be a number." })
    .min(0, "Tax rate can't be negative.")
    .max(100, "Tax rate can't exceed 100%."),
  isActive: z.coerce.boolean(),
  trackInventory: z.coerce.boolean(),
  reorderLevel: z.coerce
    .number({ error: "Reorder level must be a number." })
    .nonnegative("Reorder level can't be negative.")
    .max(999_999_999, "Reorder level is too large.")
    .optional()
    .default(0),
  initialStock: z.coerce
    .number({ error: "Initial stock must be a number." })
    .nonnegative("Initial stock can't be negative.")
    .max(999_999_999, "Initial stock is too large.")
    .optional()
    .default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
