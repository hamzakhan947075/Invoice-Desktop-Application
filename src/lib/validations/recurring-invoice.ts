import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";
import { RECURRING_FREQUENCIES } from "@/lib/recurring-invoice-schedule";

export const recurringInvoiceItemSchema = z
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

export const recurringInvoiceSchema = z
  .object({
    customerId: z.string().trim().min(1, "Select a customer."),
    frequency: z.enum(RECURRING_FREQUENCIES),
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: z.string().trim().optional().or(z.literal("")),
    dueInDays: z
      .number({ error: "Due-in-days must be a number." })
      .int("Due-in-days must be a whole number.")
      .min(0, "Due-in-days can't be negative.")
      .max(365, "Due-in-days can't exceed 365."),
    currency: z.enum(CURRENCIES),
    notes: z.string().trim().max(2000, "Notes are too long.").optional().or(z.literal("")),
    items: z.array(recurringInvoiceItemSchema).min(1, "Add at least one item."),
  })
  .refine((data) => !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

export type RecurringInvoiceItemInput = z.infer<typeof recurringInvoiceItemSchema>;
export type RecurringInvoiceInput = z.infer<typeof recurringInvoiceSchema>;
