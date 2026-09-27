import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Public base URL, used in emails. e.g. https://www.786pizza.com
  APP_URL: z.string().url().default("http://localhost:3000"),
  // Secret for hashing client IPs (HMAC). Any long random string.
  IP_HASH_SECRET: z.string().min(16).default("dev-only-ip-hash-secret-change-me"),
  // Gmail SMTP (app password) for new-order emails. Optional: without it, orders still work.
  SMTP_HOST: optional,
  SMTP_PORT: optional,
  SMTP_USER: optional,
  SMTP_PASS: optional,
  SMTP_FROM: optional,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    if (parsed.data.NODE_ENV === "production" && parsed.data.IP_HASH_SECRET.startsWith("dev-only")) {
      throw new Error("Invalid environment: IP_HASH_SECRET must be set in production");
    }
    cached = parsed.data;
  }
  return cached;
}
