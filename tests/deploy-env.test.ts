import { describe, expect, it } from "vitest";
import { validateDeployEnv } from "../scripts/deploy-env";

const good = {
  DATABASE_URL: "postgresql://postgres.abc:pw@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
  DIRECT_URL: "postgresql://postgres.abc:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc",
  CRON_SECRET: "0123456789abcdef0123",
  DEMO_OPERATOR_PASSWORD: "my-own-operator-password",
  DEMO_CITIZEN_PASSWORD: "my-own-citizen-password",
  GEMINI_API_KEY: "key",
  NEXT_PUBLIC_MAPBOX_TOKEN: "token",
};
const jwtWithRole = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.s`;
const failures = (env: Record<string, string | undefined>) =>
  validateDeployEnv(env)
    .filter((i) => i.level === "fail")
    .map((i) => i.variable);

describe("validateDeployEnv", () => {
  it("accepts a correct configuration with no issues", () => {
    expect(validateDeployEnv(good)).toEqual([]);
  });

  it("fails on missing values, leftover placeholders and local addresses", () => {
    expect(failures({ ...good, CRON_SECRET: "" })).toContain("CRON_SECRET");
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co" })).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(failures({ ...good, DATABASE_URL: "postgresql://postgres@127.0.0.1:54329/civicai" })).toContain("DATABASE_URL");
  });

  it("rejects the IPv6-only direct host, which would break the Vercel build", () => {
    expect(failures({ ...good, DIRECT_URL: "postgresql://postgres:pw@db.abc.supabase.co:5432/postgres" })).toContain("DIRECT_URL");
  });

  it("rejects swapped pooler ports and a missing pgbouncer flag", () => {
    expect(failures({ ...good, DATABASE_URL: good.DIRECT_URL })).toContain("DATABASE_URL");
    expect(failures({ ...good, DIRECT_URL: good.DATABASE_URL })).toContain("DIRECT_URL");
  });

  it("catches a secret key placed in the public variable, in both key formats", () => {
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc" })).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtWithRole("service_role") })).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(failures({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwtWithRole("anon") })).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("warns, without failing, about default demo passwords and optional features", () => {
    const issues = validateDeployEnv({ ...good, DEMO_OPERATOR_PASSWORD: undefined, GEMINI_API_KEY: "" });
    expect(issues.every((i) => i.level === "warn")).toBe(true);
    expect(issues.map((i) => i.variable)).toEqual(["DEMO_OPERATOR_PASSWORD", "GEMINI_API_KEY"]);
  });
});
