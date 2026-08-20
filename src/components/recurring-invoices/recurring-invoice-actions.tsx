"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Pause, Play, Ban, Zap, Trash2 } from "lucide-react";
import {
  pauseRecurringInvoiceAction,
  resumeRecurringInvoiceAction,
  cancelRecurringInvoiceAction,
  deleteRecurringInvoiceAction,
  generateNowAction,
} from "@/app/(app)/recurring-invoices/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { RecurringInvoiceStatus } from "@/generated/prisma/enums";

export function RecurringInvoiceActions({
  templateId,
  status,
}: {
  templateId: string;
  status: RecurringInvoiceStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function run(action: () => Promise<{ error?: string }>, key: string, successMessage: string) {
    setPending(key);
    const result = await action();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(successMessage);
      router.refresh();
    }
    setPending(null);
  }

  async function handleGenerateNow() {
    setPending("generate");
    const result = await generateNowAction(templateId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Generated ${result.invoiceNumber}.`);
      router.refresh();
    }
    setPending(null);
  }

  async function handleDelete() {
    setPending("delete");
    const result = await deleteRecurringInvoiceAction(templateId);
    if (result.error) {
      toast.error(result.error);
      setPending(null);
      return;
    }
    setDeleteOpen(false);
    router.push("/recurring-invoices");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "ACTIVE" && (
        <Button variant="outline" disabled={pending === "generate"} onClick={handleGenerateNow}>
          <Zap className="h-4 w-4" />
          {pending === "generate" ? "Generating…" : "Generate Now"}
        </Button>
      )}
      <Button variant="outline" asChild>
        <Link href={`/recurring-invoices/${templateId}/edit`}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </Button>
      {status === "ACTIVE" && (
        <Button
          variant="outline"
          disabled={pending === "pause"}
          onClick={() => run(() => pauseRecurringInvoiceAction(templateId), "pause", "Paused.")}
        >
          <Pause className="h-4 w-4" />
          Pause
        </Button>
      )}
      {status === "PAUSED" && (
        <Button
          variant="outline"
          disabled={pending === "resume"}
          onClick={() => run(() => resumeRecurringInvoiceAction(templateId), "resume", "Resumed.")}
        >
          <Play className="h-4 w-4" />
          Resume
        </Button>
      )}
      {(status === "ACTIVE" || status === "PAUSED") && (
        <Button
          variant="outline"
          disabled={pending === "cancel"}
          onClick={() => run(() => cancelRecurringInvoiceAction(templateId), "cancel", "Cancelled.")}
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recurring invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the schedule only — invoices it already generated are kept. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending === "delete"} onClick={handleDelete}>
              {pending === "delete" ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
