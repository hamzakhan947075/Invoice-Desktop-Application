export const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AUD", "NZD", "AED", "SAR", "CNY"] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "PKR";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  PKR: "PKR — Pakistani Rupee",
  USD: "USD — US Dollar",
  EUR: "EUR — Euro",
  GBP: "GBP — British Pound",
  AUD: "AUD — Australian Dollar",
  NZD: "NZD — New Zealand Dollar",
  AED: "AED — UAE Dirham",
  SAR: "SAR — Saudi Riyal",
  CNY: "CNY — Chinese Yuan",
};
