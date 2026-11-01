import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { requireCitizen } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/complaints/[id]/location — the owning citizen erases the precise location they shared. */
export const DELETE = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const citizen = await requireCitizen();
  const { id } = await params;
  const complaint = await prisma.complaint.findUnique({ where: { id }, select: { profileId: true } });
  if (!complaint || complaint.profileId !== citizen.id) throw Errors.notFound("Complaint");
  await prisma.complaint.update({ where: { id }, data: { location: Prisma.DbNull } });
  await audit({ actorId: citizen.id, action: "complaint.location_deleted", entity: "Complaint", entityId: id });
  return json({ ok: true });
});
