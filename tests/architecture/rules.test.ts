// Runs the house rules against the real source tree. A failure message says how to fix it.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_RULES, noSecrets, type SourceFile } from "./rules";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".dev-db", ".git", ".vercel", "generated", "coverage"]);
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|sql|md|yml|yaml|css|txt|example|prisma)$|^\.env/;

function trackedFiles(): string[] | null {
  try {
    const out = execSync("git ls-files", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString();
    return out.split("\n").filter(Boolean);
  } catch {
    return null; // not a git checkout yet
  }
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(path.relative(ROOT, full).replace(/\\/g, "/"));
  }
  return acc;
}

const tracked = trackedFiles();
const paths = (tracked ?? walk(ROOT)).filter((p) => TEXT.test(p.split("/").pop()!) && !p.includes("package-lock.json"));
const files: SourceFile[] = paths.map((p) => ({ path: p, content: readFileSync(path.join(ROOT, p), "utf8") }));

describe("house rules", () => {
  it.each(ALL_RULES.map((rule) => [rule.name, rule] as const))("%s", (_name, rule) => {
    const violations = rule(files);
    expect(violations.map((x) => `${x.file}: ${x.message}`)).toEqual([]);
  });

  it("noSecrets", () => {
    const violations = noSecrets(files, tracked);
    expect(violations.map((x) => `${x.file}: ${x.message}`)).toEqual([]);
  });

  it("keeps local env files out of git", () => {
    const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it("actually scanned the source tree", () => {
    expect(files.some((f) => f.path === "src/server/http.ts")).toBe(true);
    expect(files.filter((f) => f.path.endsWith("route.ts")).length).toBeGreaterThan(5);
  });
});
