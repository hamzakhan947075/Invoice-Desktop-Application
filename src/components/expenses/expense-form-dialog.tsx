"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createExpenseAction,
  updateExpenseAction,
  type ExpenseActionState,
} from "@/app/(app)/expenses/actions";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/validations/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ExpenseRecord = {
  id: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  description: string;
  vendor: string | null;
  amount: string;
  expenseDate: string;
  notes: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRecord | null;
}) {
  const isEdit = Boolean(expense);
  const [state, formAction, pending] = useActionState<ExpenseActionState, FormData>(
    isEdit ? updateExpenseAction : createExpenseAction,
    undefined
  );
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(
    expense?.category ?? "OTHER"
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? "Expense updated." : "Expense added.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this expense record." : "Track a business expense."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {isEdit && <input type="hidden" name="id" value={expense!.id} />}
          <input type="hidden" name="category" value={category} />
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="expenseCategory">Category</FieldLabel>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as (typeof EXPENSE_CATEGORIES)[number])}
                >
                  <SelectTrigger id="expenseCategory" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="vendor">Vendor</FieldLabel>
                <Input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input
                id="description"
                name="description"
                defaultValue={expense?.description ?? ""}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={expense?.amount ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expenseDate">Date</FieldLabel>
                <Input
                  id="expenseDate"
                  name="expenseDate"
                  type="date"
                  defaultValue={expense?.expenseDate ?? todayIsoDate()}
                  required
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" defaultValue={expense?.notes ?? ""} rows={2} />
            </Field>

            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
