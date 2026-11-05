/**
 * Pre-deployment check. Validates the settings you are about to give Vercel and tests them against
 * your real Supabase project, so mistakes show up here rather than as a failed Vercel build.
 *   npm run check:deploy            (reads .env.vercel)
 *   npm run check:deploy -- <file>
 * It only reads: nothing is created or changed, and no secret value is printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { validateDeployEnv } from "./deploy-env";

const file = process.argv[2] ?? ".env.vercel";
let failed = false;
const ok = (message: string) => console.log(`  ✓ ${message}`);
const warn = (message: string) => console.log(`  ! ${message}`);
const fail = (message: string) => {
  failed = true;
  console.log(`  ✗ ${message}`);
};

async function checkDatabase(label: string, url: string): Promise<boolean> {
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.$queryRaw`SELECT 1`;
    ok(`${label} connects`);
    return true;
  } catch {
    fail(`${label} could not connect. Check the password (percent-encode special characters), host and port.`);
    return false;
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  if (!existsSync(file)) {
    console.error(`${file} not found. Create it from the template first: cp .env.example ${file}`);
    process.exit(1);
  }
  const env = dotenv.parse(readFileSync(file));

  console.log(`Settings in ${file}:`);
  const issues = validateDeployEnv(env);
  for (const issue of issues) (issue.level === "fail" ? fail : warn)(`${issue.variable} ${issue.message}`);
  if (failed) {
    console.log("\nFix the ✗ items above, then run this again.");
    process.exit(1);
  }
  if (issues.length === 0) ok("all look correct");

  console.log("\nLive connections:");
  const pooledOk = await checkDatabase("DATABASE_URL (Transaction pooler)", env.DATABASE_URL!);
  await checkDatabase("DIRECT_URL (Session pooler)", env.DIRECT_URL!);

  const url = env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/$/, "");
  const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
  const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey } }).catch(() => null);
  if (auth?.ok) {
    ok("Supabase Auth accepts the public key");
    const settings = (await auth.json()) as { mailer_autoconfirm?: boolean };
    if (settings.mailer_autoconfirm === false) {
      warn('"Confirm email" is ON: new sign-ups must confirm by email, and Supabase\'s built-in mail is very limited. Turn it off for the demo (DEPLOY.md step 2).');
    }
  } else {
    fail("Supabase Auth rejected the request. Check NEXT_PUBLIC_SUPABASE_URL and the public key.");
  }

  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false, autoRefreshToken: false } });
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (users.error) fail("The secret key was rejected by Supabase Auth. Check SUPABASE_SERVICE_ROLE_KEY.");
  else ok("Secret key works for Auth");
  const buckets = await admin.storage.listBuckets();
  if (buckets.error) fail("The secret key was rejected by Supabase Storage. Check SUPABASE_SERVICE_ROLE_KEY.");
  else ok("Secret key works for Storage");

  // Once migrations have run, the Data API must expose nothing to the public key.
  if (pooledOk) {
    const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL! });
    try {
      const tables = await db.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
        SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`;
      if (tables.length === 0) {
        ok("Database is empty: the first Vercel build will create the tables");
      } else {
        const exposed = tables.filter((t) => !t.rowsecurity).map((t) => t.tablename);
        if (exposed.length > 0) fail(`Row-level security is OFF on: ${exposed.join(", ")}. Run: npx prisma migrate deploy`);
        else ok(`Row-level security is on for all ${tables.length} tables`);
      }
    } finally {
      await db.$disconnect();
    }
  }

  if (env.GEMINI_API_KEY?.trim()) {
    const model = env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
    try {
      await new GoogleGenAI({ apiKey: env.GEMINI_API_KEY.trim() }).models.get({ model });
      ok(`Gemini key works and model ${model} is available`);
    } catch {
      warn(`Gemini check failed for model ${model}. The app still works, but AI help stays off. Check the key and model name.`);
    }
  }

  console.log(
    failed
      ? "\nNOT READY: fix the ✗ items above, then run this again."
      : `\nREADY to deploy. Next: paste ${file} into Vercel's environment variables (DEPLOY.md step 4).`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The check failed unexpectedly.");
  process.exit(1);
});
