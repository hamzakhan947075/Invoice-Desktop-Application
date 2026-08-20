import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const PLACEHOLDER_BUSINESS_NAME = "My Business";

/**
 * This is a single-business desktop app — there is no login. Every
 * business-scoped Server Action / query derives businessId from here rather
 * than trusting a client-submitted value, keeping the same tenant-isolation
 * query pattern (`findFirst`/`updateMany`/`deleteMany` scoped by businessId)
 * the app has always used, even though there is now only ever one business.
 *
 * On first run (no Business row yet), this creates a placeholder one so the
 * rest of the app never has to handle a "no business" state. The (app)
 * layout redirects to /settings once if the name is still the placeholder,
 * nudging a first-time user to fill in real details.
 */
export const requireCurrentBusiness = cache(async () => {
  const existing = await prisma.business.findFirst();
  if (existing) return existing;

  return prisma.business.create({
    data: { name: PLACEHOLDER_BUSINESS_NAME, currency: "PKR" },
  });
});
