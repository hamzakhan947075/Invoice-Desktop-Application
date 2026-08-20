import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithSoftDelete | undefined;
};

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

/**
 * Customers, Products, and Invoices are soft-deleted (see the Trash feature)
 * rather than hard-deleted, so a mistaken delete is recoverable — there's no
 * admin to bail anyone out in a single-user desktop app the way there might
 * be in a hosted one. This filters every read on those three models to
 * exclude soft-deleted rows *unless the caller already specified a
 * `deletedAt` condition themselves* — which is exactly what the Trash page
 * (listing `{ deletedAt: { not: null } }`) and the restore/purge actions do.
 * Getting this filter applied centrally, once, means it can't be forgotten
 * in some future page's query the way 30 hand-edited call sites could be.
 */
function withDefaultNotDeleted<A extends { where?: Record<string, unknown> }>(args: A): A {
  if (args.where?.deletedAt !== undefined) return args;
  return { ...args, where: { ...args.where, deletedAt: null } };
}

function basePrismaClient() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      customer: {
        findMany: ({ args, query }) => query(withDefaultNotDeleted(args)),
        findFirst: ({ args, query }) => query(withDefaultNotDeleted(args)),
        count: ({ args, query }) => query(withDefaultNotDeleted(args)),
      },
      product: {
        findMany: ({ args, query }) => query(withDefaultNotDeleted(args)),
        findFirst: ({ args, query }) => query(withDefaultNotDeleted(args)),
        count: ({ args, query }) => query(withDefaultNotDeleted(args)),
      },
      invoice: {
        findMany: ({ args, query }) => query(withDefaultNotDeleted(args)),
        findFirst: ({ args, query }) => query(withDefaultNotDeleted(args)),
        count: ({ args, query }) => query(withDefaultNotDeleted(args)),
        aggregate: ({ args, query }) => query(withDefaultNotDeleted(args)),
      },
    },
  });
}

type PrismaClientWithSoftDelete = ReturnType<typeof basePrismaClient>;

export const prisma: PrismaClientWithSoftDelete = globalForPrisma.prisma ?? basePrismaClient();

/**
 * The extended client's transaction-callback type is structurally distinct
 * from the base `Prisma.TransactionClient`, so helpers that take a `tx`
 * parameter (to be called from inside `prisma.$transaction`) must be typed
 * against this instead of `Prisma.TransactionClient | PrismaClient`.
 */
export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
