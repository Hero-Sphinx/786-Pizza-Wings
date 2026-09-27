import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { getSession, type AdminSession } from "./auth";
import { rateLimit, type RateLimitRule } from "./rate-limit";

/** An error that is safe to show the caller. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const MAX_BODY_BYTES = 32 * 1024;

/** Reads and validates a JSON body. Malformed or invalid input is a 400, never a 500. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "Request is too large");
  if (!text.trim()) throw new ApiError(400, "Request body is required");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  return parseWith(schema, data);
}

/** Like readJson, but an empty body is allowed and returns undefined. */
export async function readOptionalJson<T>(req: Request, schema: ZodType<T>): Promise<T | undefined> {
  const text = await req.text();
  if (!text.trim()) return undefined;
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "Request is too large");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  return parseWith(schema, data);
}

export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = z.flattenError(result.error as z.ZodError<unknown>);
    const first = result.error.issues[0];
    throw new ApiError(400, first?.message ?? "Invalid request", fields);
  }
  return result.data;
}

export function clientIp(req: Request): string {
  // On Vercel, x-forwarded-for is set by the platform (the first entry is the client).
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Mutating requests must come from our own pages (defence in depth next to SameSite cookies). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError(403, "Cross-site request blocked");
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError(403, "Missing Origin header");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new ApiError(403, "Cross-site request blocked");
}

function handleError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.details);
  console.error("[api] unexpected error", err);
  return jsonError(500, "Something went wrong. Please try again or call the store.");
}

type RouteContext<P> = { params: Promise<P> };

/** Every staff API route goes through this: a real session check, role check and same-origin check. */
export function withAuth<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: { params: P; session: AdminSession }) => Promise<Response>,
  opts: { role?: "owner" } = {},
) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    try {
      assertSameOrigin(req);
      const session = await getSession();
      if (!session) throw new ApiError(401, "Please sign in");
      if (opts.role === "owner" && session.role !== "owner") throw new ApiError(403, "Only the owner can do that");
      return await handler(req, { params: await ctx.params, session });
    } catch (err) {
      return handleError(err);
    }
  };
}

/** Public API routes (listed in src/lib/routes.ts). Rate limiting is mandatory. */
export function withPublic<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: { params: P; ip: string }) => Promise<Response>,
  opts: { rateLimit: RateLimitRule },
) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    try {
      assertSameOrigin(req);
      const ip = clientIp(req);
      const verdict = await rateLimit(opts.rateLimit, ip);
      if (!verdict.ok) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds), "Cache-Control": "no-store" } },
        );
      }
      return await handler(req, { params: await ctx.params, ip });
    } catch (err) {
      return handleError(err);
    }
  };
}
