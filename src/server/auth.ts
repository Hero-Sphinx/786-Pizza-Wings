import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ADMIN_LOGIN_PATH, SESSION_COOKIE } from "@/lib/routes";
import { db } from "./db";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./passwords";

export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "staff";
};

const SESSION_HOURS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// Verified against when the email doesn't exist, so response time doesn't reveal valid emails.
let dummyHash: Promise<string> | undefined;

export type LoginResult = { ok: true } | { ok: false; reason: "invalid" | "locked" };

export async function login(emailInput: string, password: string, userAgent: string | null): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const user = await db().admin_users.findUnique({ where: { email } });
  if (!user || !user.is_active) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(await dummyHash, password);
    return { ok: false, reason: "invalid" };
  }
  if (user.locked_until && user.locked_until > new Date()) return { ok: false, reason: "locked" };

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    const failed = user.failed_logins + 1;
    await db().admin_users.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED_LOGINS
          ? { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failed_logins: failed },
    });
    return { ok: false, reason: failed >= MAX_FAILED_LOGINS ? "locked" : "invalid" };
  }

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db().$transaction([
    db().admin_users.update({
      where: { id: user.id },
      data: { failed_logins: 0, locked_until: null, last_login_at: new Date() },
    }),
    db().admin_sessions.create({
      data: { token_hash: sha256(token), admin_user_id: user.id, expires_at: expires, user_agent: userAgent?.slice(0, 200) },
    }),
    db().admin_sessions.deleteMany({ where: { expires_at: { lt: new Date() } } }),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return { ok: true };
}

/** The signed-in staff member, checked against the database (once per request). */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await db().admin_sessions.findUnique({
    where: { token_hash: sha256(token) },
    include: { admin_users: true },
  });
  if (!row || row.expires_at < new Date() || !row.admin_users.is_active) return null;
  const u = row.admin_users;
  return { userId: u.id, email: u.email, displayName: u.display_name, role: u.role };
});

/** For admin pages and server actions: the session, or a redirect to the login page. */
export async function requireAdmin(opts: { role?: "owner" } = {}): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect(ADMIN_LOGIN_PATH);
  if (opts.role === "owner" && session.role !== "owner") redirect("/admin");
  return session;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().admin_sessions.deleteMany({ where: { token_hash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}
