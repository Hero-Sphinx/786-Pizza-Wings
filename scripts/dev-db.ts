// Runs a real local PostgreSQL (no Docker needed) for development and tests.
// Data lives in .dev-db/ (gitignored). Leave this running in its own terminal.
// Usage: npm run dev:db
// Then in .env: DATABASE_URL="postgresql://postgres:postgres@localhost:54329/pizza"
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const dir = path.resolve(import.meta.dirname, "..", ".dev-db");
// Postgres's own output, kept only to explain a failed start.
const pgLog: string[] = [];

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    // Match production (Neon): UTF-8, not the Windows code page.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (m) => {
      pgLog.push(String(m));
      if (pgLog.length > 200) pgLog.shift();
    },
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
  // A failed start often rejects with no error at all; the reason is in the Postgres log.
  if (err) console.error(err);
  const reasons = pgLog.join("\n").split("\n").filter((l) => /FATAL|ERROR|could not/.test(l));
  if (reasons.length) console.error(reasons.join("\n"));
  if (reasons.some((l) => /could not (bind|create any TCP)/.test(l))) {
    console.error(
      `\nPort ${PORT} can't be used. On Windows it may sit in a range reserved by Hyper-V/WSL ` +
        `(see: netsh interface ipv4 show excludedportrange protocol=tcp). Set DEV_DB_PORT to a free port ` +
        `(e.g. 15432) and use the same port in DATABASE_URL.`,
    );
  }
  process.exit(1);
});
