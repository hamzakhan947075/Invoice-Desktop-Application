import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponseHeaders } from "@/lib/csv";
import { getEffectiveInvoiceStatus, INVOICE_STATUS_LABELS } from "@/lib/invoice-status";

export async function GET() {
  const business = await requireCurrentBusiness();

  const invoices = await prisma.invoice.findMany({
    where: { businessId: business.id },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
  });

  const csv = toCsv(
    [
      "Invoice Number",
      "Customer",
      "Issue Date",
      "Due Date",
      "Status",
      "Currency",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Amount Paid",
      "Balance Due",
      "Notes",
    ],
    invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customer.name,
      invoice.issueDate.toISOString().slice(0, 10),
      invoice.dueDate.toISOString().slice(0, 10),
      INVOICE_STATUS_LABELS[getEffectiveInvoiceStatus(invoice)],
      invoice.currency,
      invoice.subtotal.toFixed(2),
      invoice.discount.toFixed(2),
      invoice.tax.toFixed(2),
      invoice.total.toFixed(2),
      invoice.amountPaid.toFixed(2),
      invoice.balanceDue.toFixed(2),
      invoice.notes,
    ])
  );

  return new Response(csv, { headers: csvResponseHeaders("invoices.csv") });
}
