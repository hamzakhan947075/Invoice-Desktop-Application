"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Pencil, Clock, Ban, Trash2 } from "lucide-react";
import { markInvoiceOverdueAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { IssueCreditNoteDialog } from "@/components/invoices/issue-credit-note-dialog";
import { DeleteInvoiceDialog } from "@/components/invoices/delete-invoice-dialog";
import { CancelInvoiceDialog } from "@/components/invoices/cancel-invoice-dialog";
import { SendInvoiceEmailButton } from "@/components/invoices/send-invoice-email-button";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  balanceDue,
  total,
  currency,
  customerName,
  customerEmail,
  businessName,
  lastEmailedAt,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  balanceDue: string;
  total: string;
  currency: string;
  customerName: string;
  customerEmail: string | null;
  businessName: string;
  lastEmailedAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"overdue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function run(action: () => Promise<{ error?: string }>, key: "overdue", message: string) {
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

  // Draft invoices can now go straight to Record Payment — there's no
  // separate "mark as sent" step, so recording any payment (partial or full)
  // is what actually moves a Draft forward to Partially Paid/Paid.
  const canRecordPayment =
    status === "DRAFT" || status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";
  // Credit notes are corrections to an already-issued invoice, so Draft stays excluded here.
  const canIssueCreditNote = status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";
  // OVERDUE can now be a manually-set stored status (via Mark Overdue), not just
  // an automatic due-date derivation — either way it carries the same
  // permissions as the SENT/PARTIALLY_PAID it stands in for.
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
        <Button variant="outline" asChild title="Opens in the PDF viewer, which has its own working print button with a real preview — window.print() on this page can't offer one in Electron.">
          <a href={`/invoices/${invoiceId}/pdf?disposition=inline`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
            View / Print PDF
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/invoices/${invoiceId}/pdf`} download={`${invoiceNumber}.pdf`}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </Button>
        <SendInvoiceEmailButton
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          customerName={customerName}
          customerEmail={customerEmail}
          businessName={businessName}
          total={total}
          currency={currency}
          lastEmailedAt={lastEmailedAt}
        />
        {canRecordPayment && (
          <RecordPaymentDialog invoiceId={invoiceId} balanceDue={balanceDue} currency={currency} />
        )}
        {canIssueCreditNote && (
          <IssueCreditNoteDialog invoiceId={invoiceId} balanceDue={balanceDue} currency={currency} />
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
        onDeleted={() => router.push("/invoices")}
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
