import Link from "next/link";
import Image from "next/image";
import { FileClock, FileText, PiggyBank, Receipt, TriangleAlert, Settings } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatMoney, initialsFor } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { getEffectiveInvoiceStatus, overdueWhereClause } from "@/lib/invoice-status";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import type { InvoiceStatus } from "@/generated/prisma/enums";
import "@/styles/bootstrap-dashboard.css";

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
      where: { businessId: business.id, paymentDate: { gte: sixMonthsAgo }, invoice: { deletedAt: null } },
      select: { amount: true, paymentDate: true },
    }),
  ]);

  const stats = [
    { label: "Total Invoiced", icon: FileText, value: totals._sum?.total ?? new Prisma.Decimal(0), color: "var(--bs-primary)" },
    { label: "Total Paid", icon: PiggyBank, value: totals._sum?.amountPaid ?? new Prisma.Decimal(0), color: "var(--bs-success)" },
    { label: "Outstanding", icon: FileClock, value: totals._sum?.balanceDue ?? new Prisma.Decimal(0), color: "var(--bs-warning)" },
    { label: "Overdue", icon: TriangleAlert, value: overdueTotal._sum?.balanceDue ?? new Prisma.Decimal(0), color: "var(--bs-danger)" },
    { label: "Total Expenses", icon: Receipt, value: expenseTotal._sum?.amount ?? new Prisma.Decimal(0), color: "var(--bs-purple)" },
  ];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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
      <div
        className="dashboard-hero dashboard-fade-in card border-0 shadow-sm"
        style={{ animationDelay: "0ms" }}
      >
        <div className="card-body flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt={business.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full border-2 border-white/40 object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-xl font-semibold text-white">
                {initialsFor(business.name)}
              </div>
            )}
            <div>
              <h2 className="card-title mb-1 text-2xl font-semibold text-white">{business.name}</h2>
              <p className="mb-0 text-sm text-white/80">
                {today} · {currency}
              </p>
            </div>
          </div>
          <Link href="/settings" className="btn btn-light btn-sm">
            <Settings className="mr-1 inline h-4 w-4" />
            Business Settings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon, value, color }, index) => (
          <div
            key={label}
            className="dashboard-fade-in card border-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            style={{ animationDelay: `${(index + 1) * 60}ms` }}
          >
            <div className="card-body flex items-center justify-between gap-3 p-4">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mb-0 text-2xl font-semibold">{formatMoney(value.toFixed(2), currency)}</p>
              </div>
              <span className="dashboard-stat-icon" style={{ backgroundColor: color }}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="dashboard-fade-in card border-0 shadow-sm lg:col-span-2" style={{ animationDelay: "360ms" }}>
          <div className="card-header border-0 bg-transparent pt-4">
            <h3 className="card-title mb-0 text-base">Recent Invoices</h3>
          </div>
          <div className="card-body pt-0">
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
          </div>
        </div>

        <div className="dashboard-fade-in card border-0 shadow-sm" style={{ animationDelay: "420ms" }}>
          <div className="card-header border-0 bg-transparent pt-4">
            <h3 className="card-title mb-0 text-base">Revenue Overview</h3>
          </div>
          <div className="card-body pt-0">
            <RevenueChart data={months} currency={currency} />
          </div>
        </div>
      </div>
    </div>
  );
}
