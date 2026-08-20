"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Pencil, Printer, Send, CircleCheck, Clock, Ban, Trash2 } from "lucide-react";
import {
  markInvoiceSentAction,
  markInvoicePaidAction,
  markInvoiceOverdueAction,
} from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { IssueCreditNoteDialog } from "@/components/invoices/issue-credit-note-dialog";
import { DeleteInvoiceDialog } from "@/components/invoices/delete-invoice-dialog";
import { CancelInvoiceDialog } from "@/components/invoices/cancel-invoice-dialog";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  balanceDue,
  currency,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  balanceDue: string;
  currency: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"sent" | "paid" | "overdue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function run(action: () => Promise<{ error?: string }>, key: "sent" | "paid" | "overdue", message: string) {
    setPending(key);
    setError(null);
    const result = await action();
    if (result.error) {
      setError(result.error);
    } else {
      toast.success(message);
      router.refresh();
    }
    setPending(null);
  }

  // OVERDUE can now be a manually-set stored status (via Mark Overdue), not just
  // an automatic due-date derivation — either way it carries the same
  // permissions as the SENT/PARTIALLY_PAID it stands in for.
  const canRecordPayment = status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";
  const canMarkOverdue = status === "SENT" || status === "PARTIALLY_PAID";
  const canCancel = status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <Button variant="outline" asChild>
            <Link href={`/invoices/${invoiceId}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href={`/invoices/${invoiceId}/pdf?disposition=inline`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
            View PDF
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/invoices/${invoiceId}/pdf`} download={`${invoiceNumber}.pdf`}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
        {status === "DRAFT" && (
          <Button
            variant="outline"
            disabled={pending === "sent"}
            onClick={() => run(() => markInvoiceSentAction(invoiceId), "sent", "Invoice marked as sent.")}
          >
            <Send className="h-4 w-4" />
            {pending === "sent" ? "Marking…" : "Mark as Sent"}
          </Button>
        )}
        {canRecordPayment && (
          <RecordPaymentDialog invoiceId={invoiceId} balanceDue={balanceDue} currency={currency} />
        )}
        {canRecordPayment && (
          <IssueCreditNoteDialog invoiceId={invoiceId} balanceDue={balanceDue} currency={currency} />
        )}
        {canRecordPayment && (
          <Button
            variant="outline"
            disabled={pending === "paid"}
            onClick={() => run(() => markInvoicePaidAction(invoiceId), "paid", "Invoice marked as paid.")}
          >
            <CircleCheck className="h-4 w-4" />
            {pending === "paid" ? "Marking…" : "Mark as Paid"}
          </Button>
        )}
        {canMarkOverdue && (
          <Button
            variant="outline"
            disabled={pending === "overdue"}
            onClick={() => run(() => markInvoiceOverdueAction(invoiceId), "overdue", "Invoice marked overdue.")}
          >
            <Clock className="h-4 w-4" />
            {pending === "overdue" ? "Marking…" : "Mark Overdue"}
          </Button>
        )}
        {status === "DRAFT" && (
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            <Ban className="h-4 w-4" />
            Cancel Invoice
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DeleteInvoiceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
      />
      <CancelInvoiceDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
      />
    </div>
  );
}
