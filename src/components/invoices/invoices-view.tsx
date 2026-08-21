"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { STATUS_FILTER_OPTIONS } from "@/lib/invoice-status";
import { InvoiceStatusDropdown } from "@/components/invoices/invoice-status-dropdown";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import { DeleteInvoiceDialog } from "@/components/invoices/delete-invoice-dialog";
import { CancelInvoiceDialog } from "@/components/invoices/cancel-invoice-dialog";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  balanceDue: string;
  total: string;
};

export function InvoicesView({
  invoices,
  customers,
  currency,
  filters,
}: {
  invoices: InvoiceRow[];
  customers: { id: string; name: string }[];
  currency: CurrencyCode;
  filters: { q: string; status: "ALL" | InvoiceStatus; customerId: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cancelling, setCancelling] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  const hasFilters = Boolean(filters.q || filters.status !== "ALL" || filters.customerId || filters.from || filters.to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput placeholder="Search invoices…" defaultValue={filters.q} />

        <Select value={filters.status} onValueChange={(value) => updateParam("status", value === "ALL" ? "" : value)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.customerId || "ALL"}
          onValueChange={(value) => updateParam("customerId", value === "ALL" ? "" : value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All customers</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-36"
            value={filters.from}
            onChange={(event) => updateParam("from", event.target.value)}
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-36"
            value={filters.to}
            onChange={(event) => updateParam("to", event.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={FileText}
                    title={hasFilters ? "No invoices match your filters" : "No invoices yet"}
                    description={
                      hasFilters
                        ? "Try adjusting your search, status, or date range."
                        : "Create your first invoice to start billing customers."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{invoice.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(invoice.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(invoice.total, currency)}</TableCell>
                  <TableCell>
                    <InvoiceStatusDropdown
                      invoiceId={invoice.id}
                      status={invoice.status}
                      onRequestCancel={() => setCancelling(invoice)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <InvoiceRowActions
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        status={invoice.status}
                        onRequestDelete={() => setDeleting(invoice)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {deleting && (
        <DeleteInvoiceDialog
          key={deleting.id}
          open={deleting !== null}
          onOpenChange={(open) => !open && setDeleting(null)}
          invoiceId={deleting.id}
          invoiceNumber={deleting.invoiceNumber}
          onDeleted={() => router.refresh()}
        />
      )}
      {cancelling && (
        <CancelInvoiceDialog
          key={cancelling.id}
          open={cancelling !== null}
          onOpenChange={(open) => !open && setCancelling(null)}
          invoiceId={cancelling.id}
          invoiceNumber={cancelling.invoiceNumber}
        />
      )}
    </div>
  );
}
