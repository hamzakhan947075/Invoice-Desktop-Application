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

/** Two-letter fallback (e.g. "Acme Design Studio" -> "AD") for an avatar with no logo/photo. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
