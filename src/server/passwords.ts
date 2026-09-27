import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Kept free of Next.js imports so CLI scripts can use it too.
// OWASP-recommended argon2id settings (19 MiB, 2 passes).
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}
