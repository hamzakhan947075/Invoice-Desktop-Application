"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  deleteCustomerAction,
  type DeleteCustomerActionState,
} from "@/app/(app)/customers/actions";
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

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  invoiceCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  invoiceCount: number;
}) {
  const canDelete = invoiceCount === 0;
  const [state, formAction, pending] = useActionState<DeleteCustomerActionState, FormData>(
    deleteCustomerAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Customer deleted.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {customerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {canDelete
              ? "This will permanently delete this customer. This action cannot be undone."
              : `This customer has ${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} and can't be deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {canDelete && (
            <form action={formAction} className="contents">
              <input type="hidden" name="id" value={customerId} />
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </form>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
