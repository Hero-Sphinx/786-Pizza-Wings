import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/server/auth";
import { ApiError, readJson, withPublic } from "@/server/http";

const bodySchema = z
  .object({
    email: z.string().trim().max(120).pipe(z.email("Enter your email")),
    password: z.string().min(1, "Enter your password").max(200),
  })
  .strict();

// The only way in, so it is public, but tightly rate-limited per IP (accounts also lock after 5 misses).
export const POST = withPublic(
  async (req) => {
    const { email, password } = await readJson(req, bodySchema);
    const result = await login(email, password, req.headers.get("user-agent"));
    if (!result.ok) {
      throw new ApiError(
        result.reason === "locked" ? 423 : 401,
        result.reason === "locked" ? "Too many attempts. Try again in 15 minutes." : "Wrong email or password",
      );
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  },
  { rateLimit: { bucket: "login", limit: 10, windowSeconds: 900 } },
);
