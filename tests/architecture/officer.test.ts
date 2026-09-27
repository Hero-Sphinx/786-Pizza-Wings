// Proves the customs officer works: every rule must catch a planted violation.
import { describe, expect, it } from "vitest";
import {
  apiRoutesAreWrapped,
  bannedPatterns,
  clientBoundary,
  noRawJsonBodies,
  noSecrets,
  privatePagesCheckSession,
  routePath,
  serverActionsCheckSession,
  serverModulesAreServerOnly,
} from "./rules";

const file = (path: string, content: string) => ({ path, content });

describe("the officer catches planted violations", () => {
  it("maps files to routes", () => {
    expect(routePath("src/app/api/orders/[token]/route.ts")).toBe("/api/orders/[token]");
    expect(routePath("src/app/(site)/page.tsx")).toBe("/");
    expect(routePath("src/app/admin/(panel)/menu/page.tsx")).toBe("/admin/menu");
  });

  it("unwrapped handlers and plain function exports", () => {
    const v = apiRoutesAreWrapped([
      file("src/app/api/admin/secret/route.ts", "export const GET = async () => Response.json({});"),
      file("src/app/api/admin/other/route.ts", "export async function POST() { return Response.json({}); }"),
    ]);
    expect(v.map((x) => x.rule)).toEqual(["api-wrapper", "api-wrapper", "api-wrapper"]);
    expect(v[0].message).toMatch(/withAuth/);
  });

  it("withPublic outside the allowlist", () => {
    const v = apiRoutesAreWrapped([file("src/app/api/admin/users/route.ts", "export const GET = withPublic(async () => x, { rateLimit });")]);
    expect(v).toHaveLength(1);
    expect(v[0].message).toMatch(/PUBLIC_API_ROUTES/);
  });

  it("accepts wrapped handlers and wrapped aliases", () => {
    expect(
      apiRoutesAreWrapped([
        file("src/app/api/admin/users/route.ts", "export const PATCH = withAuth<{ id: string }>(async () => x);"),
        file("src/app/api/health/route.ts", "const check = withPublic(async () => x, { rateLimit });\nexport const GET = check;\nexport const HEAD = check;"),
      ]),
    ).toEqual([]);
  });

  it("raw req.json()", () => {
    expect(noRawJsonBodies([file("src/app/api/x/route.ts", "const body = await req.json();")])).toHaveLength(1);
  });

  it("admin pages without a session check, and unlisted public pages", () => {
    const v = privatePagesCheckSession([
      file("src/app/admin/(panel)/reports/page.tsx", "export default async function P() { return null }"),
      file("src/app/(site)/secret-deals/page.tsx", "export default function P() { return null }"),
      file("src/app/(site)/menu/page.tsx", "export default function P() { return null }"),
    ]);
    expect(v.map((x) => x.rule)).toEqual(["private-pages", "public-pages"]);
  });

  it("server actions without a session check", () => {
    expect(serverActionsCheckSession([file("src/app/admin/actions.ts", '"use server";\nexport async function wipe() {}')])).toHaveLength(1);
    expect(serverActionsCheckSession([file("src/app/admin/actions.ts", '"use server";\nexport async function ok() { await requireAdmin(); }')])).toEqual([]);
  });

  it("server modules missing server-only", () => {
    expect(serverModulesAreServerOnly([file("src/server/leaky.ts", "export const x = 1;")])).toHaveLength(1);
    expect(serverModulesAreServerOnly([file("src/server/ok.ts", '// note\nimport "server-only";\nexport const x = 1;')])).toEqual([]);
  });

  it("client code importing server code or secrets", () => {
    const v = clientBoundary([
      file("src/components/Bad.tsx", '"use client";\nimport { db } from "@/server/db";\nimport { PrismaClient } from "@/generated/prisma/client";\nconst k = process.env.SMTP_PASS;'),
      file("src/components/Ok.tsx", '"use client";\nimport type { Quote } from "@/lib/pricing";\nconst u = process.env.NEXT_PUBLIC_X;'),
    ]);
    expect(v.map((x) => x.rule)).toEqual(["client-boundary", "client-boundary", "client-env"]);
  });

  it("banned patterns", () => {
    const v = bannedPatterns([
      file("src/a.tsx", "<div dangerouslySetInnerHTML={{ __html: x }} />"),
      file("src/b.ts", "eval(code)"),
      file("src/c.ts", "new Function('return 1')"),
      file("src/d.ts", "db.$queryRawUnsafe(sql)"),
      file("src/e.ts", "db.$queryRaw(`SELECT * FROM t WHERE id = ${id}`)"),
    ]);
    expect(v).toHaveLength(5);
  });

  it("secrets and committed env files", () => {
    // Split so this test file doesn't trip the scanner itself.
    const neon = "postgresql://owner:" + "npg" + "_AbCdEf123456" + "@ep-cool.neon.tech/db";
    const google = "AIza" + "SyA1234567890abcdefghijklmnopqrstuv";
    const v = noSecrets([file("src/config.ts", `const url = "${neon}"; const k = "${google}";`)], [".env", ".env.example", "src/config.ts"]);
    expect(v.map((x) => x.file).sort()).toEqual([".env", "src/config.ts", "src/config.ts", "src/config.ts"]);
    expect(noSecrets([file("README.md", 'DATABASE_URL="postgresql://postgres:postgres@localhost:54329/pizza"')], null)).toEqual([]);
  });
});
