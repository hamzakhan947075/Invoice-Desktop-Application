"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Receipt, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/validations/expense";
import { ExpenseFormDialog, type ExpenseRecord } from "@/components/expenses/expense-form-dialog";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";

export function ExpensesView({
  expenses,
  currency,
  searchQuery,
  category,
}: {
  expenses: ExpenseRecord[];
  currency: CurrencyCode;
  searchQuery: string;
  category: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRecord | null>(null);

  function handleCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Search expenses…" defaultValue={searchQuery} />
          <Select value={category || "ALL"} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add expense
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Receipt}
                    title={searchQuery || category ? "No expenses match your filters" : "No expenses yet"}
                    description={
                      searchQuery || category
                        ? "Try a different search term or category."
                        : "Track your business expenses to see them here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.description}
                    {expense.notes && (
                      <p className="text-xs text-muted-foreground">{expense.notes}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{expense.vendor || "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(expense.amount, currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit expense"
                        onClick={() => setEditing(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete expense"
                        onClick={() => setDeleting(expense)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ExpenseFormDialog key="add" open={addOpen} onOpenChange={setAddOpen} />
      <ExpenseFormDialog
        key={editing?.id ?? "edit"}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        expense={editing}
      />
      {deleting && (
        <DeleteExpenseDialog
          key={deleting.id}
          open={deleting !== null}
          onOpenChange={(open) => !open && setDeleting(null)}
          expenseId={deleting.id}
          expenseDescription={deleting.description}
        />
      )}
    </div>
  );
}
