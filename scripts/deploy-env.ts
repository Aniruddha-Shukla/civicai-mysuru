/** Pure validation of deployment settings. Used by scripts/check-deploy.ts and its unit test. */

export interface EnvIssue {
  level: "fail" | "warn";
  variable: string;
  message: string;
}

const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

const PLACEHOLDER = /YOUR-|your-|replace-with|REGION/;
const LOCAL = /127\.0\.0\.1|localhost/;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** A legacy Supabase key is a JWT whose payload names its role. */
function legacyKeyRole(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export function validateDeployEnv(env: Record<string, string | undefined>): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const fail = (variable: string, message: string) => issues.push({ level: "fail", variable, message });
  const warn = (variable: string, message: string) => issues.push({ level: "warn", variable, message });

  for (const name of REQUIRED) {
    const value = env[name]?.trim();
    if (!value) fail(name, "is not set.");
    else if (PLACEHOLDER.test(value)) fail(name, "still contains the placeholder text from .env.example.");
    else if (LOCAL.test(value)) fail(name, "points at this computer, which Vercel cannot reach.");
  }
  if (issues.some((i) => i.level === "fail")) return issues;

  const pooled = parseUrl(env.DATABASE_URL!);
  if (!pooled) {
    fail("DATABASE_URL", "is not a valid URL. If the password has special characters, percent-encode them.");
  } else {
    if (pooled.port !== "6543") fail("DATABASE_URL", "must be the Transaction pooler string (port 6543).");
    if (pooled.searchParams.get("pgbouncer") !== "true") fail("DATABASE_URL", "must end with ?pgbouncer=true&connection_limit=1.");
    if (pooled.searchParams.get("connection_limit") !== "1") warn("DATABASE_URL", "should include connection_limit=1 to avoid exhausting connections.");
  }

  const direct = parseUrl(env.DIRECT_URL!);
  if (!direct) {
    fail("DIRECT_URL", "is not a valid URL. If the password has special characters, percent-encode them.");
  } else {
    if (/^db\..+\.supabase\.co$/.test(direct.hostname)) {
      fail("DIRECT_URL", 'uses the "Direct connection" host, which is IPv6-only: Vercel cannot reach it. Use the Session pooler string (port 5432).');
    }
    if (direct.port !== "5432") fail("DIRECT_URL", "must be the Session pooler string (port 5432), not the Transaction pooler.");
  }

  const supabase = parseUrl(env.NEXT_PUBLIC_SUPABASE_URL!);
  if (supabase?.protocol !== "https:") fail("NEXT_PUBLIC_SUPABASE_URL", "must be your https://....supabase.co project URL.");

  const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
  const secretKey = env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  if (publicKey.startsWith("sb_secret_") || legacyKeyRole(publicKey) === "service_role") {
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", "holds a SECRET key. This value is public: use the publishable/anon key here.");
  }
  if (secretKey.startsWith("sb_publishable_") || legacyKeyRole(secretKey) === "anon") {
    fail("SUPABASE_SERVICE_ROLE_KEY", "holds the public key. Use the secret/service_role key here.");
  }

  if (env.CRON_SECRET!.trim().length < 16) fail("CRON_SECRET", "must be at least 16 characters (try: openssl rand -hex 32).");

  if (env.SEED_DEMO_DATA?.trim().toLowerCase() !== "false") {
    for (const name of ["DEMO_OPERATOR_PASSWORD", "DEMO_CITIZEN_PASSWORD"]) {
      const value = env[name]?.trim();
      if (!value || /^CivicAI-(Operator|Citizen)-2026$/.test(value)) {
        warn(name, "uses the default demo password written in the README. Set your own on a public site, or anyone could sign in with it.");
      }
    }
  }
  if (!env.GEMINI_API_KEY?.trim()) warn("GEMINI_API_KEY", "is empty: the app works, but translation, Q&A and drafting help stay off.");
  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()) warn("NEXT_PUBLIC_MAPBOX_TOKEN", "is empty: onboarding shows the ward list instead of a map.");

  return issues;
}
