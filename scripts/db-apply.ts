// Applies db/schema.sql, then every db/migrations/NNN_*.sql in order.
// Everything is idempotent, so running this twice is safe (CI proves it).
// Usage: npm run db:apply            (schema + migrations)
//        npm run db:apply -- --migrations-only
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const migrationsOnly = process.argv.includes("--migrations-only");

  const root = path.resolve(import.meta.dirname, "..", "db");
  const files: string[] = [];
  if (!migrationsOnly) files.push(path.join(root, "schema.sql"));
  const migrationDir = path.join(root, "migrations");
  for (const name of readdirSync(migrationDir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    files.push(path.join(migrationDir, name));
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(file, "utf8");
      // One transaction per file: a failing migration leaves nothing half-applied.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`applied ${path.relative(process.cwd(), file)}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`failed applying ${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
