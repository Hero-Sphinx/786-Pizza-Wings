import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { withPublic } from "@/server/http";

export const dynamic = "force-dynamic";

// Uptime monitors send HEAD, browsers send GET: both must work.
const check = withPublic(
  async () => {
    await db().$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  },
  { rateLimit: { bucket: "health", limit: 120, windowSeconds: 60 } },
);

export const GET = check;
export const HEAD = check;
