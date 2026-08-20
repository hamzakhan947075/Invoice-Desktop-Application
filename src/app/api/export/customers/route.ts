import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  const business = await requireCurrentBusiness();

  const customers = await prisma.customer.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
  });

  const csv = toCsv(
    ["Name", "Email", "Phone", "Address", "Notes"],
    customers.map((c) => [c.name, c.email, c.phone, c.address, c.notes])
  );

  return new Response(csv, { headers: csvResponseHeaders("customers.csv") });
}
