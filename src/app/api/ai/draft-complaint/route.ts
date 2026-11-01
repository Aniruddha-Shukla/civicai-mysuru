import { isAiConfigured } from "@/lib/ai/client";
import { draftComplaint } from "@/lib/ai/draft";
import { auditAiRejection } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCitizen, requireWard } from "@/lib/rbac";
import { DraftComplaintSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/ai/draft-complaint — CITIZEN only. Returns a draft for the citizen to
 * review and edit. It never submits anything; submission is a separate, explicit
 * POST /api/complaints made by the citizen.
 */
export const POST = route(async (request: Request) => {
  const citizen = requireWard(await requireCitizen());
  const body = await readJson(request, DraftComplaintSchema, 8 * 1024);
  const service = await prisma.service.findUnique({ where: { id: body.serviceId }, include: { ward: { select: { name: true } } } });
  if (!service || service.wardId !== citizen.wardId) {
    throw new HttpError(400, "VALIDATION_FAILED", "Choose a service in your ward.", [{ path: "serviceId", message: "Choose a service in your ward." }]);
  }
  await enforceRateLimit(`ai-draft:${citizen.id}`, 15, 10 * 60 * 1000);

  const result = await draftComplaint({
    notes: body.notes,
    serviceName: service.name,
    wardName: service.ward.name,
    onReject: (rejection) => auditAiRejection(citizen.id, "Profile", citizen.id, rejection),
  });
  return json({ draft: result.text, origin: result.origin, status: result.status, aiAvailable: isAiConfigured() });
});
