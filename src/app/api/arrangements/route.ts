import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { requireOperator } from "@/lib/rbac";
import { istDateKey, istMidnight } from "@/lib/time";
import { CreateArrangementSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/arrangements — OPERATOR only. Records an alternative arrangement as
 * UNVERIFIED. Citizens are notified only after it is verified
 * (POST /api/arrangements/[id]/verify).
 */
export const POST = route(async (request: Request) => {
  const operator = await requireOperator();
  const body = await readJson(request, CreateArrangementSchema);

  const event = await prisma.civicEvent.findUnique({ where: { id: body.eventId }, select: { id: true, status: true } });
  if (!event) throw Errors.notFound("Notice");
  if (event.status !== "ACTIVE") {
    throw new HttpError(409, "INVALID_STATE", "Alternatives can only be added while the notice is active.");
  }
  if (body.alternativeDate < istDateKey(new Date())) {
    throw new HttpError(400, "VALIDATION_FAILED", "The alternative date cannot be in the past.", [
      { path: "alternativeDate", message: "The alternative date cannot be in the past." },
    ]);
  }

  const arrangement = await prisma.$transaction(async (tx) => {
    const created = await tx.alternativeArrangement.create({
      data: {
        eventId: event.id,
        alternativeDate: istMidnight(body.alternativeDate),
        alternativeTime: body.alternativeTime,
        affectedArea: body.affectedArea,
        source: body.source,
      },
    });
    await audit(
      { actorId: operator.id, action: "arrangement.create", entity: "AlternativeArrangement", entityId: created.id, metadata: { eventId: event.id } },
      tx,
    );
    return created;
  });

  return json({ arrangement }, { status: 201 });
});
