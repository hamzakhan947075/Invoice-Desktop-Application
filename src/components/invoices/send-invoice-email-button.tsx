"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, RotateCw } from "lucide-react";
import { recordInvoiceEmailedAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export function SendInvoiceEmailButton({
  invoiceId,
  invoiceNumber,
  customerName,
  customerEmail,
  businessName,
  total,
  currency,
  lastEmailedAt,
}: {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  businessName: string;
  total: string;
  currency: string;
  lastEmailedAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isResend = lastEmailedAt !== null;

  async function handleClick() {
    if (!customerEmail) {
      toast.error(`${customerName} has no email address on file. Add one on the customer's page first.`);
      return;
    }

    setPending(true);

    // Start the PDF download first — <a download> triggers a download
    // rather than a navigation, so it won't interfere with the mailto
    // handoff below. The user attaches it from their Downloads folder.
    const downloadLink = document.createElement("a");
    downloadLink.href = `/invoices/${invoiceId}/pdf`;
    downloadLink.download = `${invoiceNumber}.pdf`;
    downloadLink.click();

    const subject = `Invoice ${invoiceNumber} from ${businessName}`;
    const body = `Hi ${customerName},\n\nPlease find attached invoice ${invoiceNumber} for ${formatMoney(total, currency)}.\n\nThe PDF was just downloaded to your Downloads folder — attach it here before sending.\n\nThanks,\n${businessName}`;
    const mailto = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Electron's main process intercepts this navigation (it isn't part of
    // the app's own served pages) and hands it to the OS's default mail
    // client instead — see the will-navigate handler in electron/main.ts.
    window.location.href = mailto;

    const result = await recordInvoiceEmailedAction(invoiceId);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isResend
        ? "Your email app should be opening — the PDF downloaded again for you to attach."
        : "Your email app should be opening — attach the PDF that just downloaded."
    );
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={pending} onClick={handleClick}>
      {isResend ? <RotateCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      {pending ? "Opening…" : isResend ? "Resend Email" : "Send Email"}
    </Button>
  );
}
