// Fails if prisma/schema.prisma no longer matches the live database built from db/schema.sql.
// CI runs it after applying the schema to a throwaway Postgres. Fix: `npm run db:pull` and commit.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const normalise = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();

const pulled = execSync("npx prisma db pull --print", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const committed = readFileSync("prisma/schema.prisma", "utf8");

if (normalise(pulled) !== normalise(committed)) {
  const a = normalise(committed).split("\n");
  const b = normalise(pulled).split("\n");
  const at = a.findIndex((line, i) => line !== b[i]);
  console.error(`prisma/schema.prisma is out of date with db/schema.sql (first difference at line ${at + 1}):`);
  console.error(`  committed: ${a[at] ?? "<end>"}`);
  console.error(`  database:  ${b[at] ?? "<end>"}`);
  console.error("Run `npm run db:pull` against a database built from db/schema.sql and commit the result.");
  process.exit(1);
}
console.log("prisma/schema.prisma matches the database.");
