import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { RecurringInvoicesView } from "@/components/recurring-invoices/recurring-invoices-view";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import type { CurrencyCode } from "@/lib/currencies";

export default async function RecurringInvoicesPage() {
  const business = await requireCurrentBusiness();

  const templates = await prisma.recurringInvoice.findMany({
    where: { businessId: business.id },
    include: {
      customer: { select: { name: true } },
      items: { select: { quantity: true, unitPrice: true, discount: true, taxRate: true } },
    },
    orderBy: { nextRunDate: "asc" },
  });

  const rows = templates.map((template) => {
    const totals = calculateInvoiceTotals(
      template.items.map((item) => ({
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discount: item.discount.toNumber(),
        taxRate: item.taxRate.toNumber(),
      }))
    );
    return {
      id: template.id,
      customerName: template.customer.name,
      frequency: template.frequency,
      nextRunDate: template.nextRunDate.toISOString(),
      status: template.status,
      amountPerInvoice: totals.total.toFixed(2),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/recurring-invoices/new">
            <Plus className="h-4 w-4" />
            New recurring invoice
          </Link>
        </Button>
      </div>
      <RecurringInvoicesView templates={rows} currency={business.currency as CurrencyCode} />
    </div>
  );
}
