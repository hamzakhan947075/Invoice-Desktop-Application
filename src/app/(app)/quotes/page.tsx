import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { QuotesView } from "@/components/quotes/quotes-view";
import { getEffectiveQuoteStatus } from "@/lib/quote-status";
import type { CurrencyCode } from "@/lib/currencies";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const quotes = await prisma.quote.findMany({
    where: {
      businessId: business.id,
      ...(query
        ? {
            OR: [
              { quoteNumber: { contains: query } },
              { customer: { name: { contains: query } } },
            ],
          }
        : {}),
    },
    include: { customer: { select: { name: true } } },
    orderBy: { issueDate: "desc" },
  });

  const rows = quotes.map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customer.name,
    issueDate: quote.issueDate.toISOString(),
    total: quote.total.toFixed(2),
    status: getEffectiveQuoteStatus(quote),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/quotes/new">
            <Plus className="h-4 w-4" />
            New quote
          </Link>
        </Button>
      </div>
      <QuotesView quotes={rows} currency={business.currency as CurrencyCode} searchQuery={query} />
    </div>
  );
}
