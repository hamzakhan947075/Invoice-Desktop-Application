import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "OFFICE_SUPPLIES",
  "TRAVEL",
  "UTILITIES",
  "RENT",
  "SOFTWARE",
  "MARKETING",
  "PROFESSIONAL_SERVICES",
  "OTHER",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  OFFICE_SUPPLIES: "Office Supplies",
  TRAVEL: "Travel",
  UTILITIES: "Utilities",
  RENT: "Rent",
  SOFTWARE: "Software",
  MARKETING: "Marketing",
  PROFESSIONAL_SERVICES: "Professional Services",
  OTHER: "Other",
};

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2, "Description must be at least 2 characters."),
  vendor: z.string().trim().max(120, "Vendor is too long.").optional().or(z.literal("")),
  amount: z.coerce
    .number({ error: "Amount must be a number." })
    .positive("Amount must be greater than zero.")
    .max(999_999_999, "Amount is too large."),
  expenseDate: z.string().trim().min(1, "Expense date is required."),
  notes: z.string().trim().max(1000, "Notes are too long.").optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
