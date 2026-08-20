"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Pencil, Send, Check, X, ArrowRightCircle } from "lucide-react";
import {
  markQuoteSentAction,
  markQuoteAcceptedAction,
  markQuoteRejectedAction,
  convertQuoteToInvoiceAction,
} from "@/app/(app)/quotes/actions";
import { Button } from "@/components/ui/button";
import { DeleteQuoteDialog } from "@/components/quotes/delete-quote-dialog";
import type { QuoteStatus } from "@/generated/prisma/enums";

export function QuoteActions({
  quoteId,
  quoteNumber,
  status,
}: {
  quoteId: string;
  quoteNumber: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string }>, key: string, message: string) {
    setPending(key);
    const result = await action();
    if (result.error) toast.error(result.error);
    else {
      toast.success(message);
      router.refresh();
    }
    setPending(null);
  }

  async function handleConvert() {
    setPending("convert");
    const result = await convertQuoteToInvoiceAction(quoteId);
    if (result.error) {
      toast.error(result.error);
      setPending(null);
      return;
    }
    toast.success("Converted to invoice.");
    router.push(`/invoices/${result.invoiceId}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button variant="outline" asChild>
          <Link href={`/quotes/${quoteId}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      )}
      <Button variant="outline" asChild>
        <a href={`/quotes/${quoteId}/pdf?disposition=inline`} target="_blank" rel="noopener noreferrer">
          <Eye className="h-4 w-4" />
          View PDF
        </a>
      </Button>
      <Button variant="outline" asChild>
        <a href={`/quotes/${quoteId}/pdf`} download={`${quoteNumber}.pdf`}>
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </Button>
      {status === "DRAFT" && (
        <Button
          variant="outline"
          disabled={pending === "sent"}
          onClick={() => run(() => markQuoteSentAction(quoteId), "sent", "Quote marked as sent.")}
        >
          <Send className="h-4 w-4" />
          Mark as Sent
        </Button>
      )}
      {status === "SENT" && (
        <>
          <Button
            variant="outline"
            disabled={pending === "accept"}
            onClick={() => run(() => markQuoteAcceptedAction(quoteId), "accept", "Quote accepted.")}
          >
            <Check className="h-4 w-4" />
            Mark Accepted
          </Button>
          <Button
            variant="outline"
            disabled={pending === "reject"}
            onClick={() => run(() => markQuoteRejectedAction(quoteId), "reject", "Quote rejected.")}
          >
            <X className="h-4 w-4" />
            Mark Rejected
          </Button>
        </>
      )}
      {status === "ACCEPTED" && (
        <Button variant="default" disabled={pending === "convert"} onClick={handleConvert}>
          <ArrowRightCircle className="h-4 w-4" />
          {pending === "convert" ? "Converting…" : "Convert to Invoice"}
        </Button>
      )}
      {status === "DRAFT" && <DeleteQuoteDialog quoteId={quoteId} quoteNumber={quoteNumber} />}
    </div>
  );
}
