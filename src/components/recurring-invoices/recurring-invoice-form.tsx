"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  recurringInvoiceSchema,
  type RecurringInvoiceInput,
} from "@/lib/validations/recurring-invoice";
import {
  createRecurringInvoiceAction,
  updateRecurringInvoiceAction,
} from "@/app/(app)/recurring-invoices/actions";
import { CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currencies";
import {
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_LABELS,
} from "@/lib/recurring-invoice-schedule";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

export type RecurringInvoiceFormCustomer = { id: string; name: string };
export type RecurringInvoiceFormProduct = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  taxRate: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyItem() {
  return { productId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 };
}

export function RecurringInvoiceForm({
  customers,
  products,
  defaultCurrency,
  template,
}: {
  customers: RecurringInvoiceFormCustomer[];
  products: RecurringInvoiceFormProduct[];
  defaultCurrency: CurrencyCode;
  template?: {
    id: string;
    customerId: string;
    frequency: RecurringInvoiceInput["frequency"];
    startDate: string;
    endDate: string;
    dueInDays: number;
    currency: string;
    notes: string;
    items: RecurringInvoiceInput["items"];
  };
}) {
  const router = useRouter();
  const isEdit = Boolean(template);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecurringInvoiceInput>({
    resolver: zodResolver(recurringInvoiceSchema),
    defaultValues: template
      ? {
          customerId: template.customerId,
          frequency: template.frequency,
          startDate: template.startDate,
          endDate: template.endDate,
          dueInDays: template.dueInDays,
          currency: template.currency as CurrencyCode,
          notes: template.notes,
          items: template.items.map((item, index) => ({ ...item, id: String(index) })),
        }
      : {
          customerId: "",
          frequency: "MONTHLY",
          startDate: todayIsoDate(),
          endDate: "",
          dueInDays: 14,
          currency: defaultCurrency,
          notes: "",
          items: [{ ...emptyItem(), id: "0" }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const currency = useWatch({ control, name: "currency" }) ?? defaultCurrency;

  const lineTotals = watchedItems.map((item) => {
    const net = (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
    const tax = net * ((item.taxRate || 0) / 100);
    return { net, tax, total: net + tax };
  });
  const previewSubtotal = lineTotals.reduce((sum, l) => sum + l.net, 0);
  const previewTax = lineTotals.reduce((sum, l) => sum + l.tax, 0);
  const previewTotal = previewSubtotal + previewTax;

  function applyProduct(index: number, productId: string) {
    setValue(`items.${index}.productId`, productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.description`, product.description || product.name);
      setValue(`items.${index}.unitPrice`, Number(product.price));
      setValue(`items.${index}.taxRate`, Number(product.taxRate));
    }
  }

  async function onSubmit(data: RecurringInvoiceInput) {
    setServerError(null);
    const result = isEdit
      ? await updateRecurringInvoiceAction(template!.id, data)
      : await createRecurringInvoiceAction(data);

    if (result.error) {
      setServerError(result.error);
      return;
    }
    toast.success(isEdit ? "Recurring invoice updated." : "Recurring invoice created.");
    router.push(`/recurring-invoices/${result.recurringInvoiceId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="customerId">Customer</FieldLabel>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="customerId" className="w-full">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.customerId && <FieldError>{errors.customerId.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="currency">Currency</FieldLabel>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {CURRENCY_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="frequency">Frequency</FieldLabel>
            <Controller
              control={control}
              name="frequency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {RECURRING_FREQUENCY_LABELS[freq]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="dueInDays">Due in (days)</FieldLabel>
            <Input
              id="dueInDays"
              type="number"
              min="0"
              max="365"
              {...register("dueInDays", { valueAsNumber: true })}
            />
            {errors.dueInDays && <FieldError>{errors.dueInDays.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="startDate">Start date</FieldLabel>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="endDate">End date (optional)</FieldLabel>
            <Input id="endDate" type="date" {...register("endDate")} />
            {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem())}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {typeof errors.items?.message === "string" && <FieldError>{errors.items.message}</FieldError>}
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border border-border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={`product-${index}`}>Product/Service</FieldLabel>
                  <Select
                    value={watchedItems[index]?.productId ?? ""}
                    onValueChange={(value) => applyProduct(index, value)}
                  >
                    <SelectTrigger id={`product-${index}`} className="w-full">
                      <SelectValue placeholder="Custom item" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="sm:col-span-4">
                  <FieldLabel htmlFor={`description-${index}`}>Description</FieldLabel>
                  <Input id={`description-${index}`} {...register(`items.${index}.description`)} />
                  {errors.items?.[index]?.description && (
                    <FieldError>{errors.items[index]?.description?.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor={`quantity-${index}`}>Quantity</FieldLabel>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`unitPrice-${index}`}>Unit price</FieldLabel>
                  <Input
                    id={`unitPrice-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`discount-${index}`}>Discount</FieldLabel>
                  <Input
                    id={`discount-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.discount`, { valueAsNumber: true })}
                  />
                  {errors.items?.[index]?.discount && (
                    <FieldError>{errors.items[index]?.discount?.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor={`taxRate-${index}`}>Tax rate (%)</FieldLabel>
                  <Input
                    id={`taxRate-${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                  />
                </Field>

                <div className="flex items-end justify-between sm:col-span-6">
                  <p className="text-sm text-muted-foreground">
                    Line total:{" "}
                    <span className="font-medium text-foreground">
                      {currency} {(lineTotals[index]?.total ?? 0).toFixed(2)}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove item"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} {...register("notes")} />
        </CardContent>
      </Card>

      <Card className="lg:ml-auto lg:w-80">
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal per invoice</span>
            <span>{currency} {previewSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax per invoice</span>
            <span>{currency} {previewTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total per invoice</span>
            <span>{currency} {previewTotal.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Each generated invoice recalculates this total on the server.
          </p>
        </CardContent>
      </Card>

      {serverError && <FieldError>{serverError}</FieldError>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create recurring invoice"}
        </Button>
      </div>
    </form>
  );
}
