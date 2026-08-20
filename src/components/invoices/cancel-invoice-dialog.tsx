"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelInvoiceAction } from "@/app/(app)/invoices/actions";
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

export function CancelInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setPending(true);
    setError(null);
    const result = await cancelInvoiceAction(invoiceId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Invoice cancelled.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {invoiceNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks the invoice as cancelled — it will no longer accept payments or credit
            notes, but stays on record for reference. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep invoice</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleCancel}>
            {pending ? "Cancelling…" : "Cancel invoice"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
