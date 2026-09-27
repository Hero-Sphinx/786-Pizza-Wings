// Creates a staff account, or resets the password of an existing one.
// Usage: npm run admin:create -- owner@example.com "Display Name" owner|staff
// The password is typed at a hidden prompt, so it never lands in shell history.
import "dotenv/config";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/passwords";
import { db } from "../src/server/db";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) write.call(rl, s);
      else write.call(rl, "*".repeat(s.length));
    };
    rl.question(question, (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const [emailArg, name, roleArg = "staff"] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    throw new Error('Usage: npm run admin:create -- <email> "<Display Name>" [owner|staff]');
  }
  if (roleArg !== "owner" && roleArg !== "staff") throw new Error("Role must be owner or staff");

  const password = process.env.ADMIN_PASSWORD ?? (await askHidden(`Password for ${email} (min ${MIN_PASSWORD_LENGTH} chars): `));
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (!process.env.ADMIN_PASSWORD) {
    const again = await askHidden("Repeat password: ");
    if (again !== password) throw new Error("Passwords don't match");
  }

  const passwordHash = await hashPassword(password);
  const user = await db().admin_users.upsert({
    where: { email },
    create: { email, display_name: name, password_hash: passwordHash, role: roleArg },
    update: { display_name: name, password_hash: passwordHash, role: roleArg, is_active: true, failed_logins: 0, locked_until: null },
  });
  // A password reset signs the account out everywhere.
  await db().admin_sessions.deleteMany({ where: { admin_user_id: user.id } });
  console.log(`Saved ${roleArg} account for ${email}.`);
  await db().$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await db().$disconnect();
  process.exit(1);
});
