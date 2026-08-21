"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updatePaymentAction } from "@/app/(app)/invoices/[id]/payment-actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EditPaymentDialog({
  paymentId,
  invoiceNumber,
  paymentDate,
  paymentMethod,
  reference,
  notes,
}: {
  paymentId: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = await updatePaymentAction(paymentId, {
      paymentDate: String(formData.get("paymentDate")),
      paymentMethod: formData.get("paymentMethod") as (typeof PAYMENT_METHODS)[number],
      reference: String(formData.get("reference") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Payment updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full" title="Edit payment">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit payment</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>Invoice {invoiceNumber}. The payment amount can&apos;t be changed here.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="paymentDate">Payment date</FieldLabel>
              <Input id="paymentDate" name="paymentDate" type="date" defaultValue={paymentDate} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentMethod">Payment method</FieldLabel>
              <Select name="paymentMethod" defaultValue={paymentMethod}>
                <SelectTrigger id="paymentMethod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="reference">Reference</FieldLabel>
              <Input
                id="reference"
                name="reference"
                defaultValue={reference ?? ""}
                placeholder="Transaction ID, cheque no., etc."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} defaultValue={notes ?? ""} />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
