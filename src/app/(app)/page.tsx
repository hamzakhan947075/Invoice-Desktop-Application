import Link from "next/link";
import { FileClock, FileText, PiggyBank, Receipt, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { getEffectiveInvoiceStatus, overdueWhereClause } from "@/lib/invoice-status";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import type { InvoiceStatus } from "@/generated/prisma/enums";

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short" });
}

export default async function DashboardPage() {
  const business = await requireCurrentBusiness();
  const currency = business.currency as CurrencyCode;

  const activeInvoiceFilter = {
    businessId: business.id,
    status: { notIn: ["DRAFT", "CANCELLED"] as InvoiceStatus[] },
  };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [totals, overdueTotal, expenseTotal, recentInvoices, recentPayments] = await Promise.all([
    prisma.invoice.aggregate({
      where: activeInvoiceFilter,
      _sum: { total: true, amountPaid: true, balanceDue: true },
    }),
    prisma.invoice.aggregate({
      where: { businessId: business.id, ...overdueWhereClause() },
      _sum: { balanceDue: true },
    }),
    prisma.expense.aggregate({
      where: { businessId: business.id },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { businessId: business.id },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.payment.findMany({
      where: { businessId: business.id, paymentDate: { gte: sixMonthsAgo } },
      select: { amount: true, paymentDate: true },
    }),
  ]);

  const stats = [
    { label: "Total Invoiced", icon: FileText, value: totals._sum?.total ?? new Prisma.Decimal(0) },
    { label: "Total Paid", icon: PiggyBank, value: totals._sum?.amountPaid ?? new Prisma.Decimal(0) },
    { label: "Outstanding", icon: FileClock, value: totals._sum?.balanceDue ?? new Prisma.Decimal(0) },
    { label: "Overdue", icon: TriangleAlert, value: overdueTotal._sum?.balanceDue ?? new Prisma.Decimal(0) },
    { label: "Total Expenses", icon: Receipt, value: expenseTotal._sum?.amount ?? new Prisma.Decimal(0) },
  ];

  const months: { label: string; amount: number; year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ label: monthLabel(d), amount: 0, year: d.getFullYear(), month: d.getMonth() });
  }
  for (const payment of recentPayments) {
    const bucket = months.find(
      (m) => m.year === payment.paymentDate.getFullYear() && m.month === payment.paymentDate.getMonth()
    );
    if (bucket) bucket.amount += Number(payment.amount);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon, value }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(value.toFixed(2), currency)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices you create will show up here."
              />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{invoice.invoiceNumber}</span>
                      <span className="truncate text-muted-foreground">{invoice.customer.name}</span>
                    </div>
                    <span className="text-muted-foreground">{invoice.issueDate.toLocaleDateString()}</span>
                    <span className="font-medium">{formatMoney(invoice.total.toFixed(2), invoice.currency)}</span>
                    <InvoiceStatusBadge status={getEffectiveInvoiceStatus(invoice)} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={months} currency={currency} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
