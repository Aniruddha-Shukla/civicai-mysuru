/**
 * Secret scanner, run in CI after `next build`:
 *  1. No git-tracked file contains a secret-looking value (API keys, service-role JWTs,
 *     database URLs with passwords).
 *  2. The client bundle (.next/static) does not contain any server-only env var name
 *     or — when they are set in the environment — any server secret value.
 * Usage: npm run check:secrets
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SERVER_VARS = ["GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "DATABASE_URL", "DIRECT_URL", "RESEND_API_KEY"];
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ["Google (Gemini) API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Resend API key", /\bre_[A-Za-z0-9]{20,}\b/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ["Postgres URL with password", /postgres(?:ql)?:\/\/[^:\s"'/]+:[^@\s"']{6,}@(?!localhost|127\.0\.0\.1|HOST|host|aws-0-REGION|\[)/],
  ["Service-role JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
];

const problems: string[] = [];

// 1. Tracked files
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
for (const file of tracked) {
  if (file === "package-lock.json" || !existsSync(file) || statSync(file).size > 2_000_000) continue;
  const text = readFileSync(file, "utf8");
  for (const [label, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text)) problems.push(`${file}: looks like it contains a ${label}`);
  }
}
if (tracked.some((f) => /(^|\/)\.env($|\.(?!example$))/.test(f))) problems.push("A .env file is tracked by git");

// 2. Client bundle
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const staticDir = join(".next", "static");
if (existsSync(staticDir)) {
  const values = SERVER_VARS.map((name) => [name, process.env[name]?.trim()] as const).filter(([, v]) => v && v.length >= 8);
  for (const file of walk(staticDir).filter((f) => f.endsWith(".js"))) {
    const text = readFileSync(file, "utf8");
    for (const name of SERVER_VARS) if (text.includes(name)) problems.push(`${file}: client bundle references ${name}`);
    for (const [name, value] of values) if (text.includes(value!)) problems.push(`${file}: client bundle contains the value of ${name}`);
    for (const [label, pattern] of SECRET_PATTERNS) if (pattern.test(text)) problems.push(`${file}: client bundle contains a ${label}`);
  }
} else {
  console.warn("No .next/static directory — run `npm run build` first to scan the client bundle.");
}

if (problems.length > 0) {
  console.error(`Secret check FAILED:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Secret check passed (${tracked.length} tracked files${existsSync(staticDir) ? " + client bundle" : ""}).`);
