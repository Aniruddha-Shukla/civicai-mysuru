import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { requireOperator, requireSignedIn } from "@/lib/rbac";
import { COMPLAINT_PHOTO_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { ComplaintStatusSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/complaints/[id] — the owner or an OPERATOR. 404 (never 500/403) if missing or not owned. */
export const GET = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const profile = await requireSignedIn();
  const { id } = await params;
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      service: { select: { name: true, ward: { select: { name: true } } } },
      event: { select: { id: true, affectedDate: true, reason: true } },
    },
  });
  if (!complaint || (profile.role !== "OPERATOR" && complaint.profileId !== profile.id)) throw Errors.notFound("Complaint");

  let photoSignedUrl: string | null = null;
  if (complaint.photoUrl) {
    const { data } = (await getSupabaseAdmin()?.storage.from(COMPLAINT_PHOTO_BUCKET).createSignedUrl(complaint.photoUrl, 600)) ?? {};
    photoSignedUrl = data?.signedUrl ?? null;
  }
  return json({ complaint: { ...complaint, photoSignedUrl } });
});

/** PATCH /api/complaints/[id] — OPERATOR triage. Body: { status, operatorNote?, expectedUpdatedAt }. */
export const PATCH = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const operator = await requireOperator();
  const { id } = await params;
  const body = await readJson(request, ComplaintStatusSchema);

  const complaint = await prisma.$transaction(async (tx) => {
    const current = await tx.complaint.findUnique({ where: { id } });
    if (!current) throw Errors.notFound("Complaint");
    if (current.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime()) throw Errors.stale();
    const updated = await tx.complaint.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: { status: body.status, ...(body.operatorNote !== undefined ? { operatorNote: body.operatorNote } : {}) },
    });
    if (updated.count === 0) throw Errors.stale();
    await audit(
      { actorId: operator.id, action: "complaint.status_change", entity: "Complaint", entityId: id, metadata: { from: current.status, to: body.status } },
      tx,
    );
    return tx.complaint.findUniqueOrThrow({ where: { id } });
  });
  return json({ complaint });
});
