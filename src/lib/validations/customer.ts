import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name must be at least 2 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40, "Phone number is too long.").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Address is too long.").optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Notes are too long.").optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;
