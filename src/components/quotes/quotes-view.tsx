"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
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
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import type { QuoteStatus } from "@/generated/prisma/enums";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  customerName: string;
  issueDate: string;
  total: string;
  status: QuoteStatus;
};

export function QuotesView({
  quotes,
  currency,
  searchQuery,
}: {
  quotes: QuoteRow[];
  currency: CurrencyCode;
  searchQuery: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search quotes…" defaultValue={searchQuery} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={FileText}
                    title={searchQuery ? "No quotes match your search" : "No quotes yet"}
                    description={
                      searchQuery
                        ? "Try a different quote number or customer."
                        : "Create a quote to send a customer an estimate before invoicing."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">
                    <Link href={`/quotes/${quote.id}`} className="hover:underline">
                      {quote.quoteNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{quote.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(quote.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(quote.total, currency)}</TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={quote.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
