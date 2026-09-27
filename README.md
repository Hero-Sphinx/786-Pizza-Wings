# 786 Pizza & Wings

Website and online ordering for 786 Pizza & Wings (400 Queen St W, Brampton). It replaces the old
786pizza.com brochure site and its third-party ordering page, which shows "Online ordering is
unavailable".

- **Customers:** browse the menu, build pizzas, wings and combo deals with live prices, and order for
  pickup or delivery (ASAP or scheduled). They pay cash or card in person and follow their order on
  a live status page.
- **Staff:** a live order board for the kitchen tablet (new-order chime, accept, ready, done, print
  ticket), sold-out switches, and a pause button for online ordering.
- **Owner:** also edits prices, extra-topping prices, delivery fee, minimum and area, opening hours,
  holiday closures, home-page slides and the new-order email address.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (React 19, App Router) on Node 22 | React UI and Node API in one deployable; server components keep the DB off the client |
| Database | PostgreSQL (Neon in production) | Relational data (orders, items, variants) with CHECK constraints doing real enforcement |
| ORM | Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`) | Typed queries; the schema is **introspected** from `db/schema.sql`, never hand-written |
| Validation | zod 4 | Every request body and the deal definitions |
| Auth | Own sessions: argon2id + DB-backed, hashed session tokens | Small staff-only surface; no third-party auth to configure |
| Styling | Tailwind CSS 4 | Brand tokens in `src/app/globals.css` |
| Tests | Vitest | Pricing, hours, status flow, seed data, and the architecture rules |

## Run it locally

Needs Node 22+. No Docker needed: `npm run dev:db` runs a real PostgreSQL from `node_modules`.

```bash
npm install
cp .env.example .env            # then fill IP_HASH_SECRET (the file says how)
npm run dev:db                  # terminal 1: local Postgres on port 54329 (leave running)
npm run db:apply                # create tables (safe to re-run)
npm run db:seed                 # load the menu (safe to re-run)
npm run admin:create -- you@example.com "Your Name" owner   # asks for a password (12+ chars)
npm run dev                     # terminal 2: http://localhost:3000, staff at /admin
```

Before pushing, run what CI runs: `npm run check` (typegen, tsc, lint, tests, build).

## How ordering works

1. The browser keeps the cart in `localStorage` and previews prices with `src/lib/pricing.ts`.
2. Checkout calls `POST /api/quote`, which re-prices on the server with fresh, uncached menu data.
3. `POST /api/orders` re-validates everything: the store is open or the time is a real slot, the
   delivery area, day-only deals, pickup-only and cash-only deals, and sold-out items. It then
   prices the order again and saves it with snapshots of names and prices. The browser never sends
   prices.
4. Staff see the order on `/admin` within about 8 seconds (a chime plays if sound is on) and get an
   email if SMTP is configured.
5. The customer's `/order/<token>` page refreshes itself as staff move the order along.

Tax is Ontario HST (13%) on standard items and the delivery fee. Purchases of $4.00 or less pay only
the 5% federal part (Ontario's prepared-food rebate). Deals marked *tax included* or *no tax* get
no extra tax. All rates live in `store_settings`.

## House rules (enforced by `tests/architecture/`)

These run in CI, so a change that breaks them cannot ship. Each failure message says how to fix it.

- Every API route handler is `withAuth(...)` (staff) or `withPublic(..., { rateLimit })`. Public API
  routes and public pages are listed in **one place**, `src/lib/routes.ts`. Adding one is a reviewed
  change.
- Request bodies go through `readJson(req, zodSchema)`. Never `req.json()`. Malformed JSON is a 400.
- Every `/admin` page calls `await requireAdmin()` itself; `src/proxy.ts` only sees that a cookie
  exists. Server actions must call it too.
- Every file in `src/server/` starts with `import "server-only"`. Client components may not import
  server code, the Prisma client or secrets, and may only read `NEXT_PUBLIC_*` env vars.
- Banned: `dangerouslySetInnerHTML`, `eval`, `new Function`, `$queryRawUnsafe`/`$executeRawUnsafe`,
  `Prisma.raw`, and string-built SQL.
- No secrets in the repo: no `.env*` except `.env.example`, and a scan for provider keys and real
  Postgres passwords.
- `officer.test.ts` plants one violation of each kind and proves every rule catches it.

Other protections: a per-request CSP nonce (no inline scripts), HSTS, `frame-ancestors 'none'`,
same-origin checks on every mutating request, Postgres-backed rate limits (per IP, plus per phone
number for orders), a checkout honeypot, idempotency keys against double-tapped orders, account
lockout after 5 wrong passwords, and IP addresses stored only as HMACs.

## Database changes

`db/schema.sql` is the source of truth. For any change:

1. Edit `db/schema.sql`, and add `db/migrations/NNN_name.sql` with the same change, written to be
   idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE ... IF NOT EXISTS`, upserts).
2. `npm run db:apply`, then `npm run db:pull` to refresh `prisma/schema.prisma`, and commit both.
3. **Apply the migration to production before deploying code that reads it.** Keep new columns
   nullable or defaulted so the old code keeps working during the rollout.

CI proves this on a throwaway Postgres: it applies the schema, re-applies every migration, checks
the Prisma schema has no drift, and seeds twice.

`npm run db:seed` only inserts what's missing, so it never overwrites prices the owner changed in
`/admin`. `npm run db:seed -- --reset-menu` deliberately reloads the menu from `data/menu-seed.ts`
(store settings, hours and accounts are never touched).

## Deploy (Vercel + Neon)

1. **Neon:** create a project. Copy the **pooled** connection string (the host contains `-pooler`).
   From your machine, with `DATABASE_URL` set to it:
   `npm run db:apply && npm run db:seed && npm run admin:create -- owner@... "Owner" owner`.
2. **Vercel:** import the repo. Set `DATABASE_URL`, `APP_URL` (the real domain),
   `IP_HASH_SECRET`, and optionally the `SMTP_*` values (Gmail with an app password). Don't leave
   any env rows empty.
3. **Gate deploys on CI:** in Vercel, Settings → Deployment Checks, add the **App checks** and
   **Database schema** jobs as *Blocking*, and turn on auto-assigning production domains after
   checks pass.
4. Point the domain (786pizza.com) at Vercel once the owner controls its DNS.
5. In `/admin/settings`, set the email that receives new orders. Turn sound on once on the kitchen
   tablet (browsers need one tap before they'll play audio).
6. Optional: an UptimeRobot monitor on `https://<domain>/api/health` (GET and HEAD both work).

> Vercel's free **Hobby** plan is for non-commercial use only. A restaurant taking orders needs
> **Pro** (or another host). Neon's free tier is fine to start.

## Data to confirm with the owner

The menu was transcribed from the live site on 2026-09-26. Every price is exactly as published.
These points need the owner's answer (and can all be changed in `/admin` without a deploy):

- **Web prices are the in-store prices + 8%.** For example, $10.79 = $9.99 × 1.08, and 20 wings
  $19.43 = $17.99 × 1.08. This was probably the old ordering vendor's fee. Keep it, or switch to
  in-store prices?
- **Extra-topping prices** aren't published, so extras beyond what an item includes are blocked
  online until the owner sets them in /admin → Menu.
- **Delivery:** the fee is $4.99 (from the old ordering page). The minimum order isn't published,
  so none is set. The delivery area is a placeholder (`L6X, L6Y, L6V, L6W`).
- **Deal #8:** the banner says "Unlimited toppings" but the menu says "up to 6 per pizza". 6 is used.
- **Deal #10:** the text lists "Large 12″ / Medium 14″" (swapped). We use Medium 12″ / Large 14″
  like the other deals.
- **Wing sauce splits:** allowed 1 sauce per 10 wings, capped at 4. Is that right?
- **Small, X-Large and Party diameters**, and the dipping-sauce flavours.
- **Pop flavours** stay "in-store selection" (customers can add a note).

## Project map

```
db/schema.sql, db/migrations/   source-of-truth SQL (idempotent)
data/menu-seed.ts               the menu as data, with source notes
prisma/schema.prisma            introspected, don't hand-edit models
scripts/                        dev-db, db-apply, seed, create-admin, optimize-images, check-schema-drift
src/lib/                        pure, shared code: pricing, hours, schemas, order status, routes
src/server/                     server-only: db, auth, http wrappers, rate limits, orders, email
src/app/(site)/                 public pages; src/app/admin/ staff pages; src/app/api/ routes
src/components/                 UI (menu builder, cart, checkout, order board, editors)
tests/architecture/             the house-rule checks
```
