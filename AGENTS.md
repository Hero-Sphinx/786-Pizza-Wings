<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# House rules for this repo

Read README.md ("House rules" and "Database changes") before changing code. In short:

- API routes: wrap handlers in `withAuth` or `withPublic` (src/server/http.ts) and read bodies with `readJson(req, zodSchema)`. Public routes/pages are listed only in `src/lib/routes.ts`. Don't add entries there to make a test pass: use `withAuth` instead unless the route truly must be public.
- Admin pages call `await requireAdmin()` themselves. Server code lives in `src/server/` and starts with `import "server-only"`. Client components never import `@/server/*` or the Prisma client. Shared types and pure logic go in `src/lib/`.
- Never trust prices from the browser: `src/lib/pricing.ts` is the single pricing engine, and the server re-runs it on fresh data.
- Money is integer cents. Store-local time goes through `src/lib/hours.ts` (America/Toronto).
- Schema changes: edit `db/schema.sql`, add an idempotent `db/migrations/NNN_*.sql`, then `npm run db:pull`. Never hand-edit Prisma models.
- Before saying work is done: `npm run check` (typegen, tsc, lint, tests, build).
