import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { env } from "./env";

export type RateLimitRule = { bucket: string; limit: number; windowSeconds: number };

/** HMAC of an identifier (IP, email) so raw values never sit in the database. */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", env().IP_HASH_SECRET).update(value).digest("base64url").slice(0, 32);
}

/**
 * Fixed-window counter in Postgres, shared by every serverless instance.
 * One atomic upsert per call; old windows are swept occasionally.
 */
export async function rateLimit(rule: RateLimitRule, identifier: string): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const bucket = `${rule.bucket}:${hashIdentifier(identifier)}`;
  const rows = await db().$queryRaw<{ hits: number }[]>`
    INSERT INTO rate_limits (bucket, window_start, hits) VALUES (${bucket}, ${windowStart}, 1)
    ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits`;
  if (Math.random() < 0.02) {
    await db().$executeRaw`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
  }
  const hits = rows[0]?.hits ?? 1;
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000);
  return { ok: hits <= rule.limit, retryAfterSeconds };
}
