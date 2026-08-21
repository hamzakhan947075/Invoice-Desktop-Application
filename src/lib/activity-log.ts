import { prisma, type PrismaTransactionClient } from "@/lib/prisma";

export type ActivityFieldChange = { field: string; from: unknown; to: unknown };

/**
 * Records one row on the Logs page (see (app)/logs). Pass the transaction
 * client when called from inside `prisma.$transaction` so the log entry
 * commits atomically with the change it describes; otherwise pass `prisma`
 * directly. Never throws — a logging failure must not roll back or mask the
 * real action it's describing.
 */
export async function logActivity(
  client: PrismaTransactionClient | typeof prisma,
  params: {
    businessId: string;
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
    changes?: ActivityFieldChange[];
  }
): Promise<void> {
  try {
    await client.activityLog.create({
      data: {
        businessId: params.businessId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        summary: params.summary,
        changes: params.changes && params.changes.length > 0 ? JSON.stringify(params.changes) : null,
      },
    });
  } catch (error) {
    console.error("Failed to record activity log entry:", error);
  }
}

/** Builds the `changes` list for logActivity by diffing two flat field maps, skipping fields that didn't change. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ActivityFieldChange[] {
  const changes: ActivityFieldChange[] = [];
  for (const field of Object.keys(after)) {
    const from = before[field];
    const to = after[field];
    if (String(from) !== String(to)) {
      changes.push({ field, from: from ?? null, to: to ?? null });
    }
  }
  return changes;
}
