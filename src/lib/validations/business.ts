import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40, "Phone number is too long.").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Address is too long.").optional().or(z.literal("")),
  currency: z.enum(CURRENCIES),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
