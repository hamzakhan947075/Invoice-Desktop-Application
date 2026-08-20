import Link from "next/link";
import { Undo2 } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { formatMoney } from "@/lib/format";
import type { CurrencyCode } from "@/lib/currencies";

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const creditNotes = await prisma.creditNote.findMany({
    where: {
      businessId: business.id,
      ...(query
        ? {
            OR: [
              { creditNoteNumber: { contains: query } },
              { reason: { contains: query } },
              { invoice: { invoiceNumber: { contains: query } } },
              { invoice: { customer: { name: { contains: query } } } },
            ],
          }
        : {}),
    },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          currency: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { issueDate: "desc" },
  });

  const currency = business.currency as CurrencyCode;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search credit notes…" defaultValue={query} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Credit Note</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditNotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Undo2}
                    title={query ? "No credit notes match your search" : "No credit notes yet"}
                    description={
                      query
                        ? "Try a different invoice number, customer, or reason."
                        : "Credit notes issued against invoices will appear here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              creditNotes.map((creditNote) => (
                <TableRow key={creditNote.id}>
                  <TableCell className="text-muted-foreground">
                    {creditNote.issueDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{creditNote.creditNoteNumber}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/invoices/${creditNote.invoice.id}`} className="hover:underline">
                      {creditNote.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/customers/${creditNote.invoice.customer.id}`} className="hover:underline">
                      {creditNote.invoice.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {creditNote.reason}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(creditNote.amount.toFixed(2), creditNote.invoice.currency || currency)}
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
