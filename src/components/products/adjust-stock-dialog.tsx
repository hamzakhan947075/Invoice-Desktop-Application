"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustStockAction } from "@/app/(app)/products/stock-actions";
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
} from "@/components/ui/dialog";

export function AdjustStockDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentStock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentStock: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = await adjustStockAction(productId, {
      type,
      quantity: Number(formData.get("quantity")),
      reason: String(formData.get("reason") ?? ""),
    });

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Stock adjusted.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {productName}</DialogTitle>
          <DialogDescription>Current stock: {currentStock}</DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="adjustmentType">Adjustment</FieldLabel>
                <Select value={type} onValueChange={(value) => setType(value as "INCREASE" | "DECREASE")}>
                  <SelectTrigger id="adjustmentType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCREASE">Increase</SelectItem>
                    <SelectItem value="DECREASE">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
                <Input id="quantity" name="quantity" type="number" min="0.01" step="0.01" required />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea
                id="reason"
                name="reason"
                rows={2}
                placeholder="Restock, damaged goods, stock count correction, etc."
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Adjust stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
