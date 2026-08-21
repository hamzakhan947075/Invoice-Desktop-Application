import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { LogsView } from "@/components/logs/logs-view";

// Keeps the page fast even after months of activity — the log is meant for
// "what just happened", not a full forensic export. Raise this if that changes.
const MAX_ROWS = 300;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const business = await requireCurrentBusiness();
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";

  const [entries, entityTypes] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        businessId: business.id,
        ...(type ? { entityType: type } : {}),
        ...(query ? { summary: { contains: query } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
    prisma.activityLog.findMany({
      where: { businessId: business.id },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const rows = entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    summary: entry.summary,
    changes: entry.changes
      ? (JSON.parse(entry.changes) as { field: string; from: unknown; to: unknown }[])
      : null,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <LogsView
      entries={rows}
      entityTypes={entityTypes.map((e) => e.entityType)}
      filters={{ q: query, type: type ?? "" }}
      truncated={entries.length === MAX_ROWS}
    />
  );
}
