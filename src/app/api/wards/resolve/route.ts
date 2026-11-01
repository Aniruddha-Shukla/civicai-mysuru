import { prisma } from "@/lib/db";
import { resolveWardForPoint } from "@/lib/geo";
import { json, readJson, route } from "@/lib/http";
import { requireSignedIn } from "@/lib/rbac";
import { ResolveWardSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/wards/resolve — { lat, lng } → ward resolution (inside / near_boundary /
 * ambiguous / outside). The coordinates are used transiently and never stored or logged.
 */
export const POST = route(async (request: Request) => {
  await requireSignedIn();
  const { lat, lng } = await readJson(request, ResolveWardSchema, 1024);
  const wards = await prisma.ward.findMany({ select: { id: true, name: true, geojson: true } });
  return json({ resolution: resolveWardForPoint(lat, lng, wards) });
});
