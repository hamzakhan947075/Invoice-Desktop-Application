import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/uploads";
import { Prisma } from "@/generated/prisma/client";
import {
  CustomerStatementPdfDocument,
  type CustomerStatementPdfData,
} from "@/lib/pdf/customer-statement-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route Handlers are NOT covered by the (app) layout's auth guard —
  // every route handler must check auth and tenant scope itself.
  const business = await requireCurrentBusiness();
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("disposition") === "inline";

  // Scoped by businessId — a customer id alone is never enough to authorize access.
  const customer = await prisma.customer.findFirst({
    where: { id, businessId: business.id },
    include: {
      invoices: { select: { total: true, amountPaid: true, balanceDue: true } },
    },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { businessId: business.id, invoice: { customerId: id } },
    include: { invoice: { select: { invoiceNumber: true } } },
    orderBy: { paymentDate: "desc" },
  });

  const totals = customer.invoices.reduce(
    (acc, invoice) => ({
      invoiced: acc.invoiced.plus(invoice.total),
      paid: acc.paid.plus(invoice.amountPaid),
      outstanding: acc.outstanding.plus(invoice.balanceDue),
    }),
    { invoiced: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(0) }
  );

  const data: CustomerStatementPdfData = {
    generatedOn: new Date().toLocaleDateString(),
    currency: business.currency,
    business: {
      name: business.name,
      email: business.email,
      phone: business.phone,
      address: business.address,
      logoPath: business.logoUrl ? resolveUploadPath(business.logoUrl) : null,
    },
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    totals: {
      invoiced: totals.invoiced.toFixed(2),
      paid: totals.paid.toFixed(2),
      outstanding: totals.outstanding.toFixed(2),
    },
    payments: payments.map((payment) => ({
      paymentDate: payment.paymentDate.toLocaleDateString(),
      invoiceNumber: payment.invoice.invoiceNumber,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      amount: payment.amount.toFixed(2),
    })),
  };

  const buffer = await renderToBuffer(<CustomerStatementPdfDocument data={data} />);
  const filename = `${customer.name.replace(/[^a-z0-9]+/gi, "-")}-statement.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
