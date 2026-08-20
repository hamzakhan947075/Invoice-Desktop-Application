"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, RotateCcw, Users, Package, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import {
  restoreCustomerAction,
  purgeCustomerAction,
} from "@/app/(app)/customers/actions";
import {
  restoreProductAction,
  purgeProductAction,
} from "@/app/(app)/products/actions";
import {
  restoreInvoiceAction,
  purgeInvoiceAction,
} from "@/app/(app)/invoices/actions";

type TrashCustomer = { id: string; name: string; email: string | null; deletedAt: string };
type TrashProduct = { id: string; name: string; sku: string | null; price: string; deletedAt: string };
type TrashInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: string;
  deletedAt: string;
};

function RowActions({
  onRestore,
  onPurge,
  itemLabel,
}: {
  onRestore: () => Promise<{ error?: string } | void>;
  onPurge: () => Promise<{ error?: string } | void>;
  itemLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleRestore() {
    setPending(true);
    const result = await onRestore();
    setPending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Restored.");
    router.refresh();
  }

  async function handlePurge() {
    setPending(true);
    const result = await onPurge();
    setPending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Deleted forever.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Restore" disabled={pending} onClick={handleRestore}>
        <RotateCcw className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Delete forever" disabled={pending}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemLabel} forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={handlePurge}>
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TrashView({
  customers,
  products,
  invoices,
  currency,
}: {
  customers: TrashCustomer[];
  products: TrashProduct[];
  invoices: TrashInvoice[];
  currency: CurrencyCode;
}) {
  const isEmpty = customers.length === 0 && products.length === 0 && invoices.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Deleted customers, products, and draft invoices show up here and can be restored."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {customers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Customers
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="w-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(customer.deletedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        itemLabel={customer.name}
                        onRestore={() => restoreCustomerAction(customer.id)}
                        onPurge={() => purgeCustomerAction(customer.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4" /> Products & services
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="w-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku || "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(product.price, currency)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(product.deletedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        itemLabel={product.name}
                        onRestore={() => restoreProductAction(product.id)}
                        onPurge={() => purgeProductAction(product.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> Draft invoices
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="w-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{invoice.customerName}</TableCell>
                    <TableCell className="text-right">{formatMoney(invoice.total, currency)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invoice.deletedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        itemLabel={invoice.invoiceNumber}
                        onRestore={() => restoreInvoiceAction(invoice.id)}
                        onPurge={() => purgeInvoiceAction(invoice.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
