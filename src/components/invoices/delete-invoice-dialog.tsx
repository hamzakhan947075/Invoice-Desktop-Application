"use client";

import { useState } from "react";
import { deleteInvoiceAction } from "@/app/(app)/invoices/actions";
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

export function DeleteInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  /** Called after the invoice is actually deleted, once the dialog has already closed itself. */
  onDeleted?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteInvoiceAction(invoiceId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This moves the invoice to Trash, where it can be restored. Purging it permanently from Trash also
            removes any payments and credit notes recorded against it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
