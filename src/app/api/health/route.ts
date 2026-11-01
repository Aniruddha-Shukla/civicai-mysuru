import { isAiConfigured } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — deployment check. Reports which integrations are configured, never their values. */
export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return json(
    {
      ok: database,
      database,
      auth: isSupabaseConfigured(),
      storage: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      ai: isAiConfigured() ? "enabled" : "template-only (degraded mode)",
      map: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()),
      email: Boolean(process.env.RESEND_API_KEY?.trim()),
      cron: Boolean(process.env.CRON_SECRET?.trim()),
    },
    { status: database ? 200 : 503 },
  );
}
