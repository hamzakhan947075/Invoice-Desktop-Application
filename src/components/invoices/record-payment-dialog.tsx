"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";
import { recordPaymentAction } from "@/app/(app)/invoices/[id]/payment-actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentDialog({
  invoiceId,
  balanceDue,
  currency,
}: {
  invoiceId: string;
  balanceDue: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = await recordPaymentAction(invoiceId, {
      amount: Number(formData.get("amount")),
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
    toast.success("Payment recorded.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CircleDollarSign className="h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Remaining balance: {currency} {balanceDue}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={balanceDue}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentDate">Payment date</FieldLabel>
              <Input id="paymentDate" name="paymentDate" type="date" defaultValue={todayIsoDate()} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentMethod">Payment method</FieldLabel>
              <Select name="paymentMethod" defaultValue="BANK_TRANSFER">
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
              <Input id="reference" name="reference" placeholder="Transaction ID, cheque no., etc." />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
