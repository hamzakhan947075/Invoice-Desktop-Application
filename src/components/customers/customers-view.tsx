"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { CustomerFormDialog, type CustomerRecord } from "@/components/customers/customer-form-dialog";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";

export type CustomerRow = CustomerRecord & {
  invoiceCount: number;
  outstanding: string;
};

export function CustomersView({
  customers,
  currency,
  searchQuery,
}: {
  customers: CustomerRow[];
  currency: CurrencyCode;
  searchQuery: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search customers…" defaultValue={searchQuery} />
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add customer
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={searchQuery ? "No customers match your search" : "No customers yet"}
                    description={
                      searchQuery
                        ? "Try a different name, email, or phone number."
                        : "Add your first customer to start invoicing them."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <Link href={`/customers/${customer.id}`} className="hover:underline">
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone || "—"}</TableCell>
                  <TableCell className="text-right">{customer.invoiceCount}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(customer.outstanding, currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link href={`/customers/${customer.id}`} aria-label="View customer">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit customer"
                        onClick={() => setEditing(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete customer"
                        onClick={() => setDeleting(customer)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerFormDialog key="add" open={addOpen} onOpenChange={setAddOpen} />
      <CustomerFormDialog
        key={editing?.id ?? "edit"}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        customer={editing}
      />
      {deleting && (
        <DeleteCustomerDialog
          key={deleting.id}
          open={deleting !== null}
          onOpenChange={(open) => !open && setDeleting(null)}
          customerId={deleting.id}
          customerName={deleting.name}
          invoiceCount={deleting.invoiceCount}
        />
      )}
    </div>
  );
}
