/**
 * Architecture guarantees, checked mechanically over the source tree (complements the
 * ESLint `no-restricted-imports` rules):
 *  - "No AI authority": nothing under src/lib/ai can reach the database.
 *  - Server secrets never appear in client code or behind a NEXT_PUBLIC_ prefix.
 *  - No raw-HTML rendering of content; no string-built SQL.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const files = walk(SRC).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));
const SERVER_SECRETS = ["GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "DATABASE_URL", "DIRECT_URL", "RESEND_API_KEY"];

describe("AI layer has no authority over schedules", () => {
  const aiFiles = files.filter((f) => f.path.startsWith("src/lib/ai/"));

  it("contains the expected modules", () => {
    expect(aiFiles.map((f) => f.path).sort()).toEqual(
      ["answer.ts", "client.ts", "draft.ts", "extract.ts", "guard.ts", "translate.ts"].map((n) => `src/lib/ai/${n}`),
    );
  });

  it.each(aiFiles.map((f) => [f.path, f.text]))("%s imports no database or audit module", (_path, text) => {
    expect(text).not.toMatch(/from\s+["'](@\/lib\/db|@prisma\/client|@\/lib\/audit|@\/lib\/notifications\/[^"']+|@\/lib\/data\/[^"']+)["']/);
    expect(text).not.toMatch(/\bprisma\b\s*\./);
    expect(text).not.toMatch(/civicEvent\.(create|update|upsert|delete)|alternativeArrangement\.(create|update|upsert|delete)/);
  });

  it("only operator-gated route handlers write CivicEvent / AlternativeArrangement rows", () => {
    const writers = files.filter((f) => /\.(civicEvent|alternativeArrangement)\.(create|update|updateMany|upsert|delete|deleteMany)\(/.test(f.text));
    for (const writer of writers) {
      const allowed =
        writer.path.startsWith("src/app/api/") ||
        writer.path === "src/lib/demo/scenarios.ts" ||
        writer.path === "src/lib/notifications/prisma-store.ts";
      expect(allowed, `${writer.path} writes schedule tables`).toBe(true);
      if (writer.path.startsWith("src/app/api/")) {
        expect(writer.text, `${writer.path} must require the OPERATOR role`).toMatch(/requireOperator\(\)/);
      }
    }
  });
});

describe("secrets stay on the server", () => {
  const clientFiles = files.filter((f) => /^\s*["']use client["']/.test(f.text));

  it("finds client components to check", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it.each(clientFiles.map((f) => [f.path, f.text]))("%s does not import server-only modules or read server env vars", (_path, text) => {
    expect(text).not.toMatch(/from\s+["'](@\/lib\/db|@\/lib\/ai\/client|@\/lib\/supabase\/admin|@\/lib\/supabase\/server|@\/lib\/auth|server-only)["']/);
    for (const name of SERVER_SECRETS) expect(text).not.toContain(name);
  });

  it("no server secret is ever referenced with a NEXT_PUBLIC_ prefix", () => {
    for (const f of files) {
      for (const name of SERVER_SECRETS) expect(f.text, f.path).not.toContain(`NEXT_PUBLIC_${name}`);
    }
  });

  it("server-only modules are marked with `server-only`", () => {
    for (const path of ["src/lib/db.ts", "src/lib/ai/client.ts", "src/lib/supabase/admin.ts", "src/lib/supabase/server.ts", "src/lib/auth.ts"]) {
      expect(files.find((f) => f.path === path)?.text, path).toMatch(/import "server-only";/);
    }
  });
});

describe("injection hardening", () => {
  it("never renders raw HTML", () => {
    for (const f of files) expect(f.text, f.path).not.toContain("dangerouslySetInnerHTML");
  });

  it("never builds SQL from strings", () => {
    for (const f of files) expect(f.text, f.path).not.toMatch(/\$(queryRawUnsafe|executeRawUnsafe)/);
  });
});

describe("serverless runtime", () => {
  it("every API route that touches Prisma runs on the Node.js runtime", () => {
    const routes = files.filter((f) => f.path.startsWith("src/app/api/") && f.path.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThan(15);
    for (const r of routes) expect(r.text, r.path).toMatch(/export const runtime = "nodejs";/);
  });
});

describe("operator pages", () => {
  it("every operator page re-checks the OPERATOR role next to its data access", () => {
    const pages = files.filter((f) => f.path.startsWith("src/app/(operator)/") && f.path.endsWith("page.tsx"));
    expect(pages.length).toBe(6);
    for (const page of pages) expect(page.text, page.path).toMatch(/await requireOperatorPage\(\);/);
  });
});

describe("credential forms", () => {
  it("every form with a password field uses POST, so credentials can never land in a URL", () => {
    const source = files.find((f) => f.path === "src/components/auth-card.tsx")!.text;
    const forms = source.split("<form").slice(1);
    expect(forms.length).toBe(2);
    for (const form of forms) {
      expect(form).toContain('type="password"');
      expect(form.slice(0, form.indexOf("onSubmit"))).toContain('method="post"');
    }
  });
});

describe("deployment safety", () => {
  it("every table created by a migration has row-level security enabled (Supabase Data API exposure)", () => {
    const dir = join(ROOT, "prisma", "migrations");
    const sql = readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .sort()
      .map((name) => readFileSync(join(dir, name, "migration.sql"), "utf8"))
      .join("\n");
    const tables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]!);
    expect(tables.length).toBeGreaterThan(8);
    for (const table of tables) expect(sql, table).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it("vercel.json cron runs at most once a day, or the deployment fails on Vercel's Hobby plan", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { crons: { schedule: string }[] };
    for (const { schedule } of config.crons) {
      const [minute, hour] = schedule.split(" ");
      expect(minute, schedule).toMatch(/^\d+$/);
      expect(hour, schedule).toMatch(/^\d+$/);
    }
  });
});
