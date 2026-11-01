import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireSignedIn } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/wards — ward list with (illustrative demo) boundaries for the ward picker. */
export const GET = route(async () => {
  await requireSignedIn();
  const wards = await prisma.ward.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, zone: true, geojson: true } });
  return json({ wards });
});
