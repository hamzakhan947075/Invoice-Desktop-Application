"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";

export type ProductRecord = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: "PRODUCT" | "SERVICE";
  price: string;
  taxRate: string;
  isActive: boolean;
  trackInventory: boolean;
  stockQuantity: string;
  reorderLevel: string;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductRecord | null;
}) {
  const isEdit = Boolean(product);
  const [state, formAction, pending] = useActionState<ProductActionState, FormData>(
    isEdit ? updateProductAction : createProductAction,
    undefined
  );
  const [type, setType] = useState<"PRODUCT" | "SERVICE">(product?.type ?? "SERVICE");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? false);

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? "Product updated." : "Product added.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product or service"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this catalog item's details."
              : "Add a product or service to your catalog."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {isEdit && <input type="hidden" name="id" value={product!.id} />}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
          <input type="hidden" name="trackInventory" value={trackInventory ? "true" : "false"} />
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" defaultValue={product?.name ?? ""} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                name="description"
                defaultValue={product?.description ?? ""}
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="productType">Type</FieldLabel>
                <Select value={type} onValueChange={(value) => setType(value as "PRODUCT" | "SERVICE")}>
                  <SelectTrigger id="productType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCT">Product</SelectItem>
                    <SelectItem value="SERVICE">Service</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="price">Price</FieldLabel>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={product?.price ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="taxRate">Tax rate (%)</FieldLabel>
                <Input
                  id="taxRate"
                  name="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={product?.taxRate ?? "0"}
                  required
                />
              </Field>
            </div>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="active-toggle" className="flex-1">
                Active
              </FieldLabel>
              <Switch id="active-toggle" checked={isActive} onCheckedChange={setIsActive} />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="track-inventory-toggle" className="flex-1">
                Track inventory
              </FieldLabel>
              <Switch
                id="track-inventory-toggle"
                checked={trackInventory}
                onCheckedChange={setTrackInventory}
              />
            </Field>

            {trackInventory && (
              <div className="grid grid-cols-2 gap-4">
                {!isEdit && (
                  <Field>
                    <FieldLabel htmlFor="initialStock">Initial stock</FieldLabel>
                    <Input
                      id="initialStock"
                      name="initialStock"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="reorderLevel">Reorder level</FieldLabel>
                  <Input
                    id="reorderLevel"
                    name="reorderLevel"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={product?.reorderLevel ?? "0"}
                  />
                </Field>
              </div>
            )}

            {isEdit && trackInventory && (
              <p className="text-xs text-muted-foreground">
                Current stock: {product?.stockQuantity ?? "0"}. Use &ldquo;Adjust Stock&rdquo; from the
                item&rsquo;s row menu to change it.
              </p>
            )}

            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
