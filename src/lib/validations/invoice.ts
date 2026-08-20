import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";

export const invoiceItemSchema = z
  .object({
    productId: z.string().trim().optional().or(z.literal("")),
    description: z.string().trim().min(1, "Description is required."),
    quantity: z
      .number({ error: "Quantity must be a number." })
      .positive("Quantity must be greater than zero."),
    unitPrice: z
      .number({ error: "Unit price must be a number." })
      .nonnegative("Unit price can't be negative."),
    discount: z
      .number({ error: "Discount must be a number." })
      .nonnegative("Discount can't be negative."),
    taxRate: z
      .number({ error: "Tax rate must be a number." })
      .min(0, "Tax rate can't be negative.")
      .max(100, "Tax rate can't exceed 100%."),
  })
  .refine((item) => item.discount <= item.quantity * item.unitPrice, {
    message: "Discount can't exceed the line's amount.",
    path: ["discount"],
  });

export const invoiceSchema = z
  .object({
    customerId: z.string().trim().min(1, "Select a customer."),
    issueDate: z.string().trim().min(1, "Issue date is required."),
    dueDate: z.string().trim().min(1, "Due date is required."),
    currency: z.enum(CURRENCIES),
    notes: z.string().trim().max(2000, "Notes are too long.").optional().or(z.literal("")),
    items: z.array(invoiceItemSchema).min(1, "Add at least one item."),
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.issueDate), {
    message: "Due date can't be before the issue date.",
    path: ["dueDate"],
  });

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
