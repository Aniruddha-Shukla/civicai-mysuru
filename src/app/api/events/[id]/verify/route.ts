import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { runImmediatePass } from "@/lib/notifications/after-dispatch";
import { requireOperator } from "@/lib/rbac";
import { endOfIstDay } from "@/lib/time";
import { VerifyDecisionSchema } from "@/lib/validation/schemas";
import { checkEventVerification } from "@/lib/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/events/[id]/verify — OPERATOR only.
 * Body: { expectedUpdatedAt, decision?: "VERIFIED" | "UNAVAILABLE" }.
 * Optimistic concurrency: a stale `expectedUpdatedAt` returns 409 instead of overwriting.
 * On VERIFIED, the notification pass runs immediately (the cron is only a safety net).
 */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const operator = await requireOperator();
  const { id } = await params;
  const body = await readJson(request, VerifyDecisionSchema);

  const event = await prisma.$transaction(async (tx) => {
    const current = await tx.civicEvent.findUnique({ where: { id } });
    if (!current) throw Errors.notFound("Notice");
    const check = checkEventVerification({
      actorRole: operator.role,
      eventStatus: current.status,
      from: current.verificationStatus,
      to: body.decision,
      source: current.source,
    });
    if (!check.ok) throw new HttpError(check.code === "NOT_AUTHORIZED" ? 403 : 409, check.code, check.message);
    if (current.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime()) throw Errors.stale();

    const now = new Date();
    const updated = await tx.civicEvent.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data:
        body.decision === "VERIFIED"
          ? { verificationStatus: "VERIFIED", verifiedById: operator.id, lastVerifiedAt: now, version: { increment: 1 } }
          : { verificationStatus: "UNAVAILABLE", version: { increment: 1 } },
    });
    if (updated.count === 0) throw Errors.stale();

    await audit(
      {
        actorId: operator.id,
        action: body.decision === "VERIFIED" ? "event.verify" : "event.mark_unavailable",
        entity: "CivicEvent",
        entityId: id,
        metadata: { from: current.verificationStatus, to: body.decision, source: current.source },
      },
      tx,
    );
    return tx.civicEvent.findUniqueOrThrow({ where: { id } });
  });

  let conflicts: { id: string; reason: string; verificationStatus: string }[] = [];
  let dispatch = null;
  if (body.decision === "VERIFIED") {
    conflicts = await prisma.civicEvent.findMany({
      where: {
        id: { not: id },
        serviceId: event.serviceId,
        wardId: event.wardId,
        status: "ACTIVE",
        affectedDate: { gte: event.affectedDate, lte: endOfIstDay(event.affectedDate) },
      },
      select: { id: true, reason: true, verificationStatus: true },
    });
    if (conflicts.length > 0) {
      await audit({
        actorId: operator.id,
        action: "event.conflict_detected",
        entity: "CivicEvent",
        entityId: id,
        metadata: { conflictingEventIds: conflicts.map((c) => c.id), rule: "most recently verified is shown to citizens" },
      });
    }
    dispatch = await runImmediatePass(id, operator.id, "event.verify");
  }

  const { dedupKey: _dedupKey, ...rest } = event;
  return json({ event: rest, conflicts, dispatch });
});
