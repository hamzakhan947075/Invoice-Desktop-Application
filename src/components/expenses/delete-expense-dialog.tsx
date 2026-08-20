"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { deleteExpenseAction, type DeleteExpenseActionState } from "@/app/(app)/expenses/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteExpenseDialog({
  open,
  onOpenChange,
  expenseId,
  expenseDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  expenseDescription: string;
}) {
  const [state, formAction, pending] = useActionState<DeleteExpenseActionState, FormData>(
    deleteExpenseAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Expense deleted.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{expenseDescription}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this expense record. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction} className="contents">
            <input type="hidden" name="id" value={expenseId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
