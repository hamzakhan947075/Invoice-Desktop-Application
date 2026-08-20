import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { CurrencyCode } from "@/lib/currencies";
import { ReportsView } from "@/components/reports/reports-view";
import type { InvoiceStatus } from "@/generated/prisma/enums";

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { from, to } = await searchParams;

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const fromDate = parseDateParam(from) ?? startOfYear;
  const toDate = parseDateParam(to) ?? new Date();
  // Include the entire "to" day, since date-only inputs default to midnight.
  const toDateInclusive = new Date(toDate);
  toDateInclusive.setHours(23, 59, 59, 999);

  const invoiceWhere = {
    businessId: business.id,
    status: { notIn: ["DRAFT", "CANCELLED"] as InvoiceStatus[] },
    issueDate: { gte: fromDate, lte: toDateInclusive },
  };
  const expenseWhere = {
    businessId: business.id,
    expenseDate: { gte: fromDate, lte: toDateInclusive },
  };

  const [invoiceTotals, expenseTotals, invoices, expenses, expensesByCategory] = await Promise.all([
    prisma.invoice.aggregate({ where: invoiceWhere, _sum: { total: true, tax: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: { total: true, tax: true, issueDate: true },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: { amount: true, expenseDate: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: expenseWhere,
      _sum: { amount: true },
    }),
  ]);

  const revenue = invoiceTotals._sum.total ?? new Prisma.Decimal(0);
  const taxCollected = invoiceTotals._sum.tax ?? new Prisma.Decimal(0);
  const expenseTotal = expenseTotals._sum.amount ?? new Prisma.Decimal(0);
  const netProfit = revenue.minus(expenseTotal);

  // Monthly breakdown across the selected range — display-only bucketing,
  // same convention as the dashboard's revenue chart (plain Number, not Decimal).
  const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cursor <= end) {
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      revenue: 0,
      expenses: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const invoice of invoices) {
    const key = `${invoice.issueDate.getFullYear()}-${invoice.issueDate.getMonth()}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.revenue += Number(invoice.total);
  }
  for (const expense of expenses) {
    const key = `${expense.expenseDate.getFullYear()}-${expense.expenseDate.getMonth()}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.expenses += Number(expense.amount);
  }

  return (
    <ReportsView
      currency={business.currency as CurrencyCode}
      filters={{ from: toDateInputValue(fromDate), to: toDateInputValue(toDate) }}
      summary={{
        revenue: revenue.toFixed(2),
        taxCollected: taxCollected.toFixed(2),
        expenses: expenseTotal.toFixed(2),
        netProfit: netProfit.toFixed(2),
      }}
      months={months.map((m) => ({
        label: m.label,
        revenue: m.revenue.toFixed(2),
        expenses: m.expenses.toFixed(2),
        netProfit: (m.revenue - m.expenses).toFixed(2),
      }))}
      expensesByCategory={expensesByCategory.map((row) => ({
        category: row.category,
        amount: (row._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      }))}
    />
  );
}
