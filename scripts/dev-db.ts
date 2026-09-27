// Runs a real local PostgreSQL (no Docker needed) for development and tests.
// Data lives in .dev-db/ (gitignored). Leave this running in its own terminal.
// Usage: npm run dev:db
// Then in .env: DATABASE_URL="postgresql://postgres:postgres@localhost:54329/pizza"
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dir = path.resolve(import.meta.dirname, "..", ".dev-db");

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    // Match production (Neon): UTF-8, not the Windows code page.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  if (!existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase("pizza");
  } catch {
    // already exists
  }
  console.log(`Postgres ready: postgresql://postgres:postgres@localhost:${PORT}/pizza  (Ctrl+C to stop)`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
