import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getPendingRestorePath, looksLikeSqliteFile } from "@/lib/backup";

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup file is empty or too large." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeSqliteFile(buffer)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid InvoiceFlow backup file." },
      { status: 400 }
    );
  }

  // The live database file is open in this same process (and, when packaged,
  // Windows won't let anything overwrite an open file) — stage the upload
  // and swap it in on next launch instead, before the server starts.
  await writeFile(getPendingRestorePath(), buffer);

  return NextResponse.json({
    success: true,
    message: "Backup received. Restart the app to finish restoring it.",
  });
}
