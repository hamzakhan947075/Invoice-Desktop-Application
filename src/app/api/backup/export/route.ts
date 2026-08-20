import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbFilePath } from "@/lib/backup";

export async function GET() {
  // Flush the WAL into the main file first, so the exported copy is a
  // complete, consistent snapshot rather than missing recent writes.
  await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(FULL);");

  const buffer = await readFile(getDbFilePath());
  const filename = `invoiceflow-backup-${new Date().toISOString().slice(0, 10)}.db`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
