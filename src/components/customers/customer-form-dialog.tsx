"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from "@/app/(app)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerRecord | null;
}) {
  const isEdit = Boolean(customer);
  const [state, formAction, pending] = useActionState<CustomerActionState, FormData>(
    isEdit ? updateCustomerAction : createCustomerAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? "Customer updated." : "Customer added.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this customer's details."
              : "Add a new customer to your business."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {isEdit && <input type="hidden" name="id" value={customer!.id} />}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={customer?.name ?? ""} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Textarea id="address" name="address" defaultValue={customer?.address ?? ""} rows={2} />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} rows={2} />
            </Field>
            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
