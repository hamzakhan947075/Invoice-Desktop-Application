import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CustomersView } from "@/components/customers/customers-view";
import type { CurrencyCode } from "@/lib/currencies";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const customers = await prisma.customer.findMany({
    where: {
      businessId: business.id,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    include: {
      invoices: { select: { balanceDue: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = customers.map((customer) => {
    const outstanding = customer.invoices.reduce(
      (sum, invoice) => sum.plus(invoice.balanceDue),
      new Prisma.Decimal(0)
    );

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      invoiceCount: customer.invoices.length,
      outstanding: outstanding.toFixed(2),
    };
  });

  return (
    <CustomersView
      customers={rows}
      currency={business.currency as CurrencyCode}
      searchQuery={query}
    />
  );
}
