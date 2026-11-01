import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { requireSignedIn } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/notifications/[id]/read — owner only; 404 otherwise. Only the status changes, never the message. */
export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const profile = await requireSignedIn();
  const { id } = await params;
  const result = await prisma.notification.updateMany({ where: { id, profileId: profile.id }, data: { status: "read" } });
  if (result.count === 0) throw Errors.notFound("Notification");
  return json({ ok: true });
});
