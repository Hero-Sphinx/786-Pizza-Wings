// The "customs officer": house security rules checked on every CI run.
// Each rule takes the source files and returns violations with a fix-it message.
// Rules are pure (files in, messages out) so officer.test.ts can prove each one catches a planted violation.
import { PUBLIC_API_ROUTES, PUBLIC_PAGES } from "../../src/lib/routes";

export type SourceFile = { path: string; content: string }; // path is repo-relative with forward slashes
export type Violation = { rule: string; file: string; message: string };

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const isRoute = (f: SourceFile) => /^src\/app\/api\/.+\/route\.tsx?$/.test(f.path);
const isPage = (f: SourceFile) => /^src\/app\/.+\/page\.tsx?$|^src\/app\/page\.tsx?$/.test(f.path);
const isClient = (f: SourceFile) => /^\s*(\/\/[^\n]*\n\s*)*["']use client["']/.test(f.content);
const isServerAction = (f: SourceFile) => /^\s*(\/\/[^\n]*\n\s*)*["']use server["']/.test(f.content);

/** "src/app/api/orders/[token]/route.ts" -> "/api/orders/[token]"; route groups "(x)" are dropped. */
export function routePath(file: string): string {
  const inner = file.replace(/^src\/app/, "").replace(/\/(route|page)\.tsx?$/, "");
  const cleaned = inner
    .split("/")
    .filter((seg) => !/^\(.+\)$/.test(seg))
    .join("/");
  return cleaned === "" ? "/" : cleaned;
}

const v = (rule: string, file: string, message: string): Violation => ({ rule, file, message });

/** Every API handler is wrapped in withAuth (staff) or withPublic (allowlisted, rate-limited). */
export function apiRoutesAreWrapped(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  const publicRoutes = new Set<string>(PUBLIC_API_ROUTES);
  for (const f of files.filter(isRoute)) {
    const path = routePath(f.path);
    if (new RegExp(`export\\s+(async\\s+)?function\\s+(${HTTP_METHODS.join("|")})\\b`).test(f.content)) {
      out.push(v("api-wrapper", f.path, `Export handlers as \`export const GET = withAuth(async (req, ctx) => ...)\`, not as plain functions.`));
    }
    const exported = [...f.content.matchAll(new RegExp(`export\\s+const\\s+(${HTTP_METHODS.join("|")})\\s*=\\s*([^;\\n]+)`, "g"))];
    if (exported.length === 0) out.push(v("api-wrapper", f.path, "A route file must export at least one HTTP handler."));
    for (const [, method, rhs] of exported) {
      // `export const HEAD = check;` is fine when `check` itself is a wrapped handler in this file.
      const alias = /^([A-Za-z_$][\w$]*)\s*;?$/.exec(rhs.trim())?.[1];
      const source = alias ? new RegExp(`const\\s+${alias}\\s*=\\s*([^\\n]+)`).exec(f.content)?.[1] ?? "" : rhs;
      const wrapper = /^\s*(withAuth|withPublic)\s*(<[^>]*>)?\s*\(/.exec(source)?.[1];
      if (!wrapper) {
        out.push(v("api-wrapper", f.path, `${method} must be wrapped: \`withAuth(...)\` for staff routes, or \`withPublic(..., { rateLimit })\` for allowlisted public routes.`));
      } else if (wrapper === "withPublic" && !publicRoutes.has(path)) {
        out.push(
          v("api-public-allowlist", f.path, `${path} uses withPublic but isn't in PUBLIC_API_ROUTES (src/lib/routes.ts). Use withAuth, or add it to the allowlist in a reviewed change.`),
        );
      }
    }
  }
  return out;
}

/** Request bodies go through readJson/readOptionalJson + a zod schema, never raw req.json(). */
export function noRawJsonBodies(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => isRoute(f) && /\b(req|request)\.json\s*\(/.test(f.content))
    .map((f) => v("validated-bodies", f.path, "Don't call req.json() directly. Use `await readJson(req, schema)` from @/server/http so bad input is a 400 with a clear message."));
}

/** Every private (admin) page checks the session itself; the proxy only sees that a cookie exists. */
export function privatePagesCheckSession(files: SourceFile[]): Violation[] {
  const publicPages = new Set<string>(PUBLIC_PAGES);
  const out: Violation[] = [];
  for (const f of files.filter(isPage)) {
    const path = routePath(f.path);
    if (publicPages.has(path)) continue;
    if (!path.startsWith("/admin")) {
      out.push(v("public-pages", f.path, `${path} is a new public page. Add it to PUBLIC_PAGES in src/lib/routes.ts (reviewed), or move it under /admin.`));
    } else if (!/\brequireAdmin\s*\(/.test(f.content)) {
      out.push(v("private-pages", f.path, `Admin page ${path} must call \`await requireAdmin()\` itself.`));
    }
  }
  return out;
}

/** Every server action checks the session. */
export function serverActionsCheckSession(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => isServerAction(f) && !/\brequireAdmin\s*\(/.test(f.content))
    .map((f) => v("server-actions", f.path, "Server actions are public endpoints. Call `await requireAdmin()` at the start of each action."));
}

/** Server modules can't be bundled into the browser by accident. */
export function serverModulesAreServerOnly(files: SourceFile[]): Violation[] {
  return files
    .filter((f) => /^src\/server\/.+\.tsx?$/.test(f.path) && !/\.test\.tsx?$/.test(f.path))
    .filter((f) => !/^import\s+["']server-only["'];?/m.test(f.content.split("\n").find((l) => l.trim() && !l.trim().startsWith("//")) ?? ""))
    .map((f) => v("server-only", f.path, 'Start every file in src/server with `import "server-only";`.'));
}

/** Browser code never imports server code or the DB client, and only reads NEXT_PUBLIC_ env vars. */
export function clientBoundary(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter(isClient)) {
    for (const m of f.content.matchAll(/(?:import|export)[^"']*from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      if (/^@\/server(\/|$)|(^|\/)server\//.test(spec) || /generated\/prisma|@prisma\/client|^pg$|nodemailer|@node-rs\/argon2/.test(spec)) {
        out.push(v("client-boundary", f.path, `Client component imports "${spec}". Move shared types/helpers to src/lib, and fetch data through an API route or a server component.`));
      }
    }
    for (const m of f.content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!m[1].startsWith("NEXT_PUBLIC_") && m[1] !== "NODE_ENV") {
        out.push(v("client-env", f.path, `Client component reads process.env.${m[1]}. Only NEXT_PUBLIC_ variables may reach the browser.`));
      }
    }
  }
  return out;
}

const BANNED: { pattern: RegExp; message: string }[] = [
  { pattern: /dangerouslySetInnerHTML/, message: "dangerouslySetInnerHTML is banned: render text as React children." },
  { pattern: /(^|[^\w.])eval\s*\(/, message: "eval() is banned." },
  { pattern: /new\s+Function\s*\(/, message: "new Function() is banned." },
  { pattern: /\$(queryRaw|executeRaw)Unsafe\b/, message: "Use the tagged-template $queryRaw`...` (parameterised), never $queryRawUnsafe/$executeRawUnsafe." },
  { pattern: /Prisma\.raw\s*\(/, message: "Prisma.raw() builds SQL from strings. Use tagged-template parameters." },
  { pattern: /\$(queryRaw|executeRaw)\s*\(\s*[`'"][^`'"]*\$\{/, message: "Don't build SQL strings. Use the tagged template form: db.$queryRaw`... ${value}`." },
];

export function bannedPatterns(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const f of files.filter((x) => /^(src|scripts)\/.+\.(ts|tsx)$/.test(x.path) && !x.path.startsWith("src/generated/"))) {
    for (const b of BANNED) if (b.pattern.test(f.content)) out.push(v("banned-pattern", f.path, b.message));
  }
  return out;
}

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Neon password", pattern: /npg_[A-Za-z0-9]{10,}/ },
  { name: "Postgres URL with a real password", pattern: /postgres(?:ql)?:\/\/[^:\s"'`]+:(?!postgres@|password@|placeholder@|\$\{)[^@\s"'`]{6,}@(?!localhost|127\.0\.0\.1)/ },
  { name: "Private key", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Stripe secret key", pattern: /sk_(live|test)_[0-9A-Za-z]{16,}/ },
  { name: "Resend API key", pattern: /re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/ },
  { name: "Gmail app password", pattern: /SMTP_PASS\s*=\s*["']?[a-z]{4}\s?[a-z]{4}\s?[a-z]{4}\s?[a-z]{4}["']?/ },
];

/** No secrets in tracked files, and no .env files except .env.example. */
export function noSecrets(files: SourceFile[], trackedPaths: string[] | null): Violation[] {
  const out: Violation[] = [];
  if (trackedPaths) {
    for (const p of trackedPaths) {
      const name = p.split("/").pop()!;
      if (/^\.env/.test(name) && name !== ".env.example") out.push(v("secrets", p, `${p} is committed. Remove it from git (git rm --cached) and rotate every value in it.`));
    }
  }
  for (const f of files) {
    if (/(^|\/)\.env(?!\.example)/.test(f.path)) continue; // untracked local env files hold real secrets by design
    for (const s of SECRET_PATTERNS) {
      if (s.pattern.test(f.content)) out.push(v("secrets", f.path, `Looks like a ${s.name}. Move it to .env / the host's env settings and rotate it.`));
    }
  }
  return out;
}

export const ALL_RULES = [
  apiRoutesAreWrapped,
  noRawJsonBodies,
  privatePagesCheckSession,
  serverActionsCheckSession,
  serverModulesAreServerOnly,
  clientBoundary,
  bannedPatterns,
];
