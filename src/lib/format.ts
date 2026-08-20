import type { CurrencyCode } from "@/lib/currencies";

/**
 * Formats a pre-computed decimal string (e.g. from Prisma.Decimal#toFixed)
 * for display only. All money math must happen with Prisma.Decimal server-side —
 * this never feeds back into a calculation.
 */
export function formatMoney(amount: string, currency: CurrencyCode | string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
