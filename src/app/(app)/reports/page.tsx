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

  const [invoiceTotals, expenseTotals, invoices, expenses, expensesByCategory, outstandingInvoices] =
    await Promise.all([
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
      // Aged receivables is a live snapshot ("who owes what, right now"), not
      // scoped to the from/to period above — an invoice issued last year with
      // an unpaid balance is exactly the kind of thing this should surface.
      prisma.invoice.findMany({
        where: {
          businessId: business.id,
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
          balanceDue: { gt: 0 },
        },
        select: {
          dueDate: true,
          balanceDue: true,
          customer: { select: { id: true, name: true } },
        },
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

  // Aged receivables — bucket every outstanding balance by how many days
  // past its due date it is, grouped by customer, as of right now.
  const today = new Date();
  const zero = () => new Prisma.Decimal(0);
  const byCustomer = new Map<
    string,
    { customerId: string; customerName: string; current: Prisma.Decimal; d1to30: Prisma.Decimal; d31to60: Prisma.Decimal; d61to90: Prisma.Decimal; over90: Prisma.Decimal }
  >();
  for (const invoice of outstandingInvoices) {
    const existing = byCustomer.get(invoice.customer.id) ?? {
      customerId: invoice.customer.id,
      customerName: invoice.customer.name,
      current: zero(),
      d1to30: zero(),
      d31to60: zero(),
      d61to90: zero(),
      over90: zero(),
    };
    const daysOverdue = Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) existing.current = existing.current.plus(invoice.balanceDue);
    else if (daysOverdue <= 30) existing.d1to30 = existing.d1to30.plus(invoice.balanceDue);
    else if (daysOverdue <= 60) existing.d31to60 = existing.d31to60.plus(invoice.balanceDue);
    else if (daysOverdue <= 90) existing.d61to90 = existing.d61to90.plus(invoice.balanceDue);
    else existing.over90 = existing.over90.plus(invoice.balanceDue);
    byCustomer.set(invoice.customer.id, existing);
  }

  const agedReceivables = Array.from(byCustomer.values())
    .map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      current: row.current.toFixed(2),
      d1to30: row.d1to30.toFixed(2),
      d31to60: row.d31to60.toFixed(2),
      d61to90: row.d61to90.toFixed(2),
      over90: row.over90.toFixed(2),
      total: row.current.plus(row.d1to30).plus(row.d31to60).plus(row.d61to90).plus(row.over90).toFixed(2),
    }))
    .sort((a, b) => Number(b.total) - Number(a.total));

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
      agedReceivables={agedReceivables}
    />
  );
}
