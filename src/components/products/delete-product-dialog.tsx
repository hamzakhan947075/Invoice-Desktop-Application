"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { deleteProductAction, type DeleteProductActionState } from "@/app/(app)/products/actions";
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

export function DeleteProductDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState<DeleteProductActionState, FormData>(
    deleteProductAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Product deleted.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {productName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this item from your catalog. Past invoices that used it
            keep their own copy of the description, price, and tax, so this action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction} className="contents">
            <input type="hidden" name="id" value={productId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
