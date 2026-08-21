import { NextResponse } from "next/server";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

const RESULTS_PER_CATEGORY = 5;

export async function GET(request: Request) {
  // Route Handlers are NOT covered by the (app) layout's auth guard — every
  // route handler must check auth and tenant scope itself.
  const business = await requireCurrentBusiness();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ invoices: [], quotes: [], customers: [], products: [] });
  }

  const [invoices, quotes, customers, products] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        businessId: business.id,
        OR: [
          { invoiceNumber: { contains: query } },
          { customer: { name: { contains: query } } },
        ],
      },
      select: { id: true, invoiceNumber: true, total: true, currency: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: RESULTS_PER_CATEGORY,
    }),
    prisma.quote.findMany({
      where: {
        businessId: business.id,
        OR: [
          { quoteNumber: { contains: query } },
          { customer: { name: { contains: query } } },
        ],
      },
      select: { id: true, quoteNumber: true, total: true, currency: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: RESULTS_PER_CATEGORY,
    }),
    prisma.customer.findMany({
      where: {
        businessId: business.id,
        OR: [{ name: { contains: query } }, { email: { contains: query } }, { phone: { contains: query } }],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: RESULTS_PER_CATEGORY,
    }),
    prisma.product.findMany({
      where: {
        businessId: business.id,
        OR: [{ name: { contains: query } }, { sku: { contains: query } }],
      },
      select: { id: true, name: true, sku: true, price: true },
      orderBy: { name: "asc" },
      take: RESULTS_PER_CATEGORY,
    }),
  ]);

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customer.name,
      total: i.total.toFixed(2),
      currency: i.currency,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer.name,
      total: q.total.toFixed(2),
      currency: q.currency,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price.toFixed(2) })),
  });
}
