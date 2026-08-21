"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { markInvoiceOverdueAction } from "@/app/(app)/invoices/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export function InvoiceStatusDropdown({
  invoiceId,
  status,
  onRequestCancel,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  onRequestCancel: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"overdue" | null>(null);

  // `status` is the *effective* status: OVERDUE is either derived automatically
  // (SENT/PARTIALLY_PAID + a past due date + a remaining balance — see
  // getEffectiveInvoiceStatus) or set manually via Mark Overdue below. Either
  // way it carries the same permissions as the SENT/PARTIALLY_PAID it stands in for.
  const canMarkOverdue = status === "SENT" || status === "PARTIALLY_PAID";
  const canCancel = status === "SENT" || status === "PARTIALLY_PAID" || status === "OVERDUE";

  // Nothing to change to (Draft/Paid/Cancelled are terminal here) — show a
  // plain, non-interactive badge instead of a dropdown with nothing in it.
  // Recording a payment (which Draft now also supports) happens from the
  // invoice detail page, not this quick status menu.
  if (!canMarkOverdue && !canCancel) {
    return <InvoiceStatusBadge status={status} />;
  }

  async function run(action: () => Promise<{ error?: string }>, key: "overdue", message: string) {
    setPending(key);
    const result = await action();
    setPending(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(message);
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Change invoice status"
      >
        <InvoiceStatusBadge status={status} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {canMarkOverdue && (
          <DropdownMenuItem
            disabled={pending !== null}
            onClick={() => run(() => markInvoiceOverdueAction(invoiceId), "overdue", "Invoice marked overdue.")}
          >
            Mark Overdue
          </DropdownMenuItem>
        )}
        {canCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRequestCancel}>
              Cancel Invoice
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
