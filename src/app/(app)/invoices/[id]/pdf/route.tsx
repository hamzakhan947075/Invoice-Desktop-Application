import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/uploads";
import { InvoicePdfDocument, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route Handlers are NOT covered by the (app) layout's auth guard —
  // every route handler must check auth and tenant scope itself.
  const business = await requireCurrentBusiness();
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("disposition") === "inline";

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: business.id },
    include: {
      customer: true,
      items: true,
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toLocaleDateString(),
    dueDate: invoice.dueDate.toLocaleDateString(),
    status: invoice.status,
    currency: invoice.currency,
    notes: invoice.notes,
    subtotal: invoice.subtotal.toFixed(2),
    discount: invoice.discount.toFixed(2),
    tax: invoice.tax.toFixed(2),
    total: invoice.total.toFixed(2),
    amountPaid: invoice.amountPaid.toFixed(2),
    balanceDue: invoice.balanceDue.toFixed(2),
    business: {
      name: business.name,
      email: business.email,
      phone: business.phone,
      address: business.address,
      logoPath: business.logoUrl ? resolveUploadPath(business.logoUrl) : null,
    },
    customer: {
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      address: invoice.customer.address,
    },
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toFixed(2),
      taxRate: item.taxRate.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    payments: invoice.payments.map((payment) => ({
      paymentDate: payment.paymentDate.toLocaleDateString(),
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      amount: payment.amount.toFixed(2),
    })),
  };

  const buffer = await renderToBuffer(<InvoicePdfDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoice.invoiceNumber}.pdf"`,
      // Tenant-specific document — must never be cached by a shared proxy/CDN.
      "Cache-Control": "private, no-store",
    },
  });
}
