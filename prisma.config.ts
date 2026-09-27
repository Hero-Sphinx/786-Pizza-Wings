import "dotenv/config";
import { defineConfig } from "prisma/config";

// db/schema.sql is the source of truth. Prisma only introspects it (`npm run db:pull`)
// and generates the typed client, so there is no prisma/migrations folder.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // A placeholder keeps `prisma generate` working in CI steps that have no database.
    url: process.env["DATABASE_URL"] ?? "postgresql://placeholder@localhost:5432/placeholder",
  },
});
