/**
 * Seed / refresh demo data. Idempotent: safe to run on every deploy.
 *   npx prisma db seed             (local)
 *   tsx prisma/seed.ts --from-build (Vercel build; skips gracefully if not configured)
 *
 * Set SEED_DEMO_DATA=false to disable on a non-demo deployment.
 */
import { PrismaClient, type Role } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CITIZEN_EMAIL, DEMO_OPERATOR_EMAIL } from "../src/lib/demo/accounts";
import { DEMO, refreshDemoScenarios, upsertDemoWardsAndServices } from "../src/lib/demo/scenarios";

const fromBuild = process.argv.includes("--from-build");
const BUCKET = "complaint-photos";

interface DemoAccount {
  role: Role;
  name: string;
  email: string;
  password: string;
  wardId: string | null;
}

const accounts: DemoAccount[] = [
  {
    role: "OPERATOR",
    name: "Demo Operator (MCC Control Room)",
    email: DEMO_OPERATOR_EMAIL,
    password: process.env.DEMO_OPERATOR_PASSWORD?.trim() || "CivicAI-Operator-2026",
    wardId: null,
  },
  {
    role: "CITIZEN",
    name: "Demo Citizen",
    email: DEMO_CITIZEN_EMAIL,
    password: process.env.DEMO_CITIZEN_PASSWORD?.trim() || "CivicAI-Citizen-2026",
    wardId: DEMO.ward.w1,
  },
];

function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function ensureAuthUser(admin: SupabaseClient, account: DemoAccount): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { name: account.name },
  });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === account.email.toLowerCase());
    if (found) {
      await admin.auth.admin.updateUserById(found.id, { password: account.password, email_confirm: true });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw created.error ?? new Error(`Could not create or find auth user ${account.email}`);
}

async function ensureBucket(admin: SupabaseClient) {
  const existing = await admin.storage.getBucket(BUCKET);
  if (existing.data) return;
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 4 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) console.warn(`  ! could not create storage bucket "${BUCKET}": ${error.message}`);
}

async function main() {
  if (process.env.SEED_DEMO_DATA?.trim().toLowerCase() === "false") {
    console.log("SEED_DEMO_DATA=false — skipping demo seed.");
    return;
  }
  if (!process.env.DATABASE_URL) {
    if (fromBuild) {
      console.warn("DATABASE_URL is not set — skipping demo seed.");
      return;
    }
    throw new Error("DATABASE_URL is not set.");
  }

  const db = new PrismaClient();
  try {
    console.log("Seeding CivicAI demo data…");
    await upsertDemoWardsAndServices(db);

    const admin = supabaseAdmin();
    if (!admin) {
      console.warn(
        "  ! Supabase admin credentials are not set: demo profiles are created with placeholder ids and cannot log in.\n" +
          "    Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run the seed again.",
      );
    } else {
      await ensureBucket(admin);
    }

    const ids: Record<Role, string> = { OPERATOR: "", CITIZEN: "" };
    for (const account of accounts) {
      const id = admin ? await ensureAuthUser(admin, account) : `local-demo-${account.role.toLowerCase()}`;
      await db.profile.upsert({
        where: { id },
        update: { role: account.role, name: account.name, email: account.email, wardId: account.wardId, language: "en" },
        create: { id, role: account.role, name: account.name, email: account.email, wardId: account.wardId, language: "en" },
      });
      ids[account.role] = id;
    }

    const dates = await refreshDemoScenarios(db, { operatorId: ids.OPERATOR, citizenId: ids.CITIZEN });

    console.log("\nDemo scenarios (IST):");
    console.log(`  A  verified alternative   — Garbage Collection, Monday ${dates.mondayA}`);
    console.log(`  B  no alternative yet     — Garbage Collection, Monday ${dates.mondayB}`);
    console.log(`  C  follow-up pending      — Dry Waste Collection, Thursday ${dates.thursdayC} (run the cron to send it)`);
    console.log("  D  past expiry            — archived by the next cron run");
    console.log("  E  conflicting notices    — Ward 2, flagged for operator review");
    console.log("  F  awaiting verification  — Ward 3, in the operator queue");
    console.log("\nDemo accounts:");
    for (const account of accounts) {
      const shown = fromBuild ? "(see README / DEMO_*_PASSWORD)" : account.password;
      console.log(`  ${account.role.padEnd(8)} ${account.email.padEnd(28)} ${shown}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  if (fromBuild) {
    // Demo data is optional: a seed problem must never stop the real app from deploying.
    console.warn("Demo seed failed — continuing the deployment without refreshed demo data.");
    return;
  }
  process.exit(1);
});
