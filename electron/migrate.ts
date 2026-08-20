import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";

/**
 * A minimal SQL migration runner for the packaged app, applying
 * prisma/migrations/*.sql files directly via the libsql client. This avoids
 * bundling the full `prisma` CLI (a devDependency, correctly excluded from
 * the production package by electron-builder) just to run `migrate deploy`
 * at runtime — the migrations themselves are plain SQL either way.
 */
export async function runMigrations(databaseUrl: string, migrationsDir: string): Promise<void> {
  const client = createClient({ url: databaseUrl });

  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
    );

    const applied = new Set(
      (await client.execute("SELECT name FROM _app_migrations")).rows.map((r) => String(r.name))
    );

    const entries = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const name of entries) {
      if (applied.has(name)) continue;

      const sqlPath = path.join(migrationsDir, name, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");
      const statements = sql
        .split(";")
        .map((chunk) =>
          chunk
            .split("\n")
            .filter((line) => !line.trim().startsWith("--"))
            .join("\n")
            .trim()
        )
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await client.execute(statement);
      }

      await client.execute({
        sql: "INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)",
        args: [name, new Date().toISOString()],
      });
    }
  } finally {
    client.close();
  }
}
