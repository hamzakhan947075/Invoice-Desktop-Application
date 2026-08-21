import Link from "next/link";
import { Wallet } from "lucide-react";
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
import { EditPaymentDialog } from "@/components/payments/edit-payment-dialog";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";
import type { CurrencyCode } from "@/lib/currencies";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const payments = await prisma.payment.findMany({
    where: {
      businessId: business.id,
      // A deleted invoice's payments shouldn't linger here — see the global
      // soft-delete filter in lib/prisma.ts, which only covers direct
      // customer/product/invoice queries, not nested relations like this one.
      invoice: { deletedAt: null },
      ...(query
        ? {
            OR: [
              { reference: { contains: query } },
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
    orderBy: { paymentDate: "desc" },
  });

  const currency = business.currency as CurrencyCode;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search payments…" defaultValue={query} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={Wallet}
                    title={query ? "No payments match your search" : "No payments yet"}
                    description={
                      query
                        ? "Try a different invoice number, customer, or reference."
                        : "Payments recorded against invoices will appear here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">
                    {payment.paymentDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/invoices/${payment.invoice.id}`} className="hover:underline">
                      {payment.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/customers/${payment.invoice.customer.id}`} className="hover:underline">
                      {payment.invoice.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{payment.reference || "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(payment.amount.toFixed(2), payment.invoice.currency || currency)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <EditPaymentDialog
                        paymentId={payment.id}
                        invoiceNumber={payment.invoice.invoiceNumber}
                        paymentDate={payment.paymentDate.toISOString().slice(0, 10)}
                        paymentMethod={payment.paymentMethod}
                        reference={payment.reference}
                        notes={payment.notes}
                      />
                    </div>
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
