import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ExpensesView } from "@/components/expenses/expenses-view";
import { EXPENSE_CATEGORIES } from "@/lib/validations/expense";
import type { CurrencyCode } from "@/lib/currencies";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q, category } = await searchParams;
  const query = q?.trim() ?? "";
  const categoryFilter = EXPENSE_CATEGORIES.includes(
    category as (typeof EXPENSE_CATEGORIES)[number]
  )
    ? (category as (typeof EXPENSE_CATEGORIES)[number])
    : "";

  const expenses = await prisma.expense.findMany({
    where: {
      businessId: business.id,
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(query
        ? {
            OR: [
              { description: { contains: query } },
              { vendor: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { expenseDate: "desc" },
  });

  const rows = expenses.map((expense) => ({
    id: expense.id,
    category: expense.category,
    description: expense.description,
    vendor: expense.vendor,
    amount: expense.amount.toFixed(2),
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    notes: expense.notes,
  }));

  return (
    <ExpensesView
      expenses={rows}
      currency={business.currency as CurrencyCode}
      searchQuery={query}
      category={categoryFilter}
    />
  );
}
