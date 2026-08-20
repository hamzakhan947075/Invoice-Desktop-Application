import path from "path";

/** Resolves the absolute SQLite file path from DATABASE_URL (e.g. "file:./dev.db" or "file:C:\...\invoiceflow.db"). */
export function getDbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePart = url.replace(/^file:/, "");
  return path.resolve(filePart);
}

/** Where an uploaded restore file is staged until the app restarts and swaps it in (see electron/main.ts). */
export function getPendingRestorePath(): string {
  return path.join(path.dirname(getDbFilePath()), "restore-pending.db");
}

export const SQLITE_MAGIC = "SQLite format 3\u0000";

export function looksLikeSqliteFile(buffer: Buffer): boolean {
  return buffer.subarray(0, 16).toString("latin1") === SQLITE_MAGIC;
}
