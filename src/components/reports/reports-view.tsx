"use client";

import { usePathname, useRouter } from "next/navigation";
import { FileText, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/validations/expense";

type MonthRow = { label: string; revenue: string; expenses: string; netProfit: string };
type CategoryRow = { category: string; amount: string };

export function ReportsView({
  currency,
  filters,
  summary,
  months,
  expensesByCategory,
}: {
  currency: CurrencyCode;
  filters: { from: string; to: string };
  summary: { revenue: string; taxCollected: string; expenses: string; netProfit: string };
  months: MonthRow[];
  expensesByCategory: CategoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  const cards = [
    { label: "Revenue", icon: FileText, value: summary.revenue },
    { label: "Expenses", icon: Receipt, value: summary.expenses },
    { label: "Net Profit", icon: TrendingUp, value: summary.netProfit },
    { label: "Tax Collected", icon: PiggyBank, value: summary.taxCollected },
  ];

  const hasActivity = months.some((m) => m.revenue !== "0.00" || m.expenses !== "0.00");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-36"
            value={filters.from}
            onChange={(event) => updateParam("from", event.target.value)}
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-36"
            value={filters.to}
            onChange={(event) => updateParam("to", event.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, icon: Icon, value }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMoney(value, currency)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasActivity ? (
        <EmptyState
          icon={TrendingUp}
          title="No activity in this date range"
          description="Sent, paid, or overdue invoices and expenses in the selected range will show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((month) => (
                    <TableRow key={month.label}>
                      <TableCell className="font-medium">{month.label}</TableCell>
                      <TableCell className="text-right">{formatMoney(month.revenue, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(month.expenses, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(month.netProfit, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by category</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {expensesByCategory.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No expenses in this range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesByCategory.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">
                          {EXPENSE_CATEGORY_LABELS[row.category as keyof typeof EXPENSE_CATEGORY_LABELS] ??
                            row.category}
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(row.amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
