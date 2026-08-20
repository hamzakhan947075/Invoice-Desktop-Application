"use client";

import Link from "next/link";
import { Eye, Pencil, Repeat } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";
import { RECURRING_FREQUENCY_LABELS, isDueToRun } from "@/lib/recurring-invoice-schedule";
import { RecurringStatusBadge } from "@/components/recurring-invoices/recurring-status-badge";
import type { RecurringInvoiceStatus, RecurringFrequency } from "@/generated/prisma/enums";

export type RecurringInvoiceRow = {
  id: string;
  customerName: string;
  frequency: RecurringFrequency;
  nextRunDate: string;
  status: RecurringInvoiceStatus;
  amountPerInvoice: string;
};

export function RecurringInvoicesView({
  templates,
  currency,
}: {
  templates: RecurringInvoiceRow[];
  currency: CurrencyCode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-0">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  icon={Repeat}
                  title="No recurring invoices yet"
                  description="Set up a schedule to automatically bill a customer on a regular cadence."
                />
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <Link href={`/recurring-invoices/${template.id}`} className="hover:underline">
                    {template.customerName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {RECURRING_FREQUENCY_LABELS[template.frequency]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(template.nextRunDate).toLocaleDateString()}
                  {template.status === "ACTIVE" && isDueToRun(new Date(template.nextRunDate)) && (
                    <span className="ml-2 text-xs font-medium text-primary">Due</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(template.amountPerInvoice, currency)}
                </TableCell>
                <TableCell>
                  <RecurringStatusBadge status={template.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={`/recurring-invoices/${template.id}`} aria-label="View recurring invoice">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={`/recurring-invoices/${template.id}/edit`} aria-label="Edit recurring invoice">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
