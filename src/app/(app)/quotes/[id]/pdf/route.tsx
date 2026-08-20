import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/uploads";
import { QuotePdfDocument, type QuotePdfData } from "@/lib/pdf/quote-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route Handlers are NOT covered by the (app) layout's auth guard —
  // every route handler must check auth and tenant scope itself.
  const business = await requireCurrentBusiness();
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("disposition") === "inline";

  const quote = await prisma.quote.findFirst({
    where: { id, businessId: business.id },
    include: { customer: true, items: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const data: QuotePdfData = {
    quoteNumber: quote.quoteNumber,
    issueDate: quote.issueDate.toLocaleDateString(),
    expiryDate: quote.expiryDate.toLocaleDateString(),
    status: quote.status,
    currency: quote.currency,
    notes: quote.notes,
    subtotal: quote.subtotal.toFixed(2),
    discount: quote.discount.toFixed(2),
    tax: quote.tax.toFixed(2),
    total: quote.total.toFixed(2),
    business: {
      name: business.name,
      email: business.email,
      phone: business.phone,
      address: business.address,
      logoPath: business.logoUrl ? resolveUploadPath(business.logoUrl) : null,
    },
    customer: {
      name: quote.customer.name,
      email: quote.customer.email,
      phone: quote.customer.phone,
      address: quote.customer.address,
    },
    items: quote.items.map((item) => ({
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toFixed(2),
      taxRate: item.taxRate.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };

  const buffer = await renderToBuffer(<QuotePdfDocument data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${quote.quoteNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
