import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireSignedIn } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const profile = await requireSignedIn();
  const result = await prisma.notification.updateMany({ where: { profileId: profile.id, status: "sent" }, data: { status: "read" } });
  return json({ updated: result.count });
});
