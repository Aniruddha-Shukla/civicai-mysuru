import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { runImmediatePass } from "@/lib/notifications/after-dispatch";
import { requireOperator } from "@/lib/rbac";
import { endOfIstDay } from "@/lib/time";
import { VerifyDecisionSchema } from "@/lib/validation/schemas";
import { checkArrangementVerification } from "@/lib/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/arrangements/[id]/verify — OPERATOR only.
 * Body: { expectedUpdatedAt, decision?: "VERIFIED" | "UNAVAILABLE" }.
 * Verifying bumps the parent event's version so citizens who were told "no alternative
 * yet" get a follow-up immediately (and via the cron, should the immediate pass fail).
 */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const operator = await requireOperator();
  const { id } = await params;
  const body = await readJson(request, VerifyDecisionSchema);

  const arrangement = await prisma.$transaction(async (tx) => {
    const current = await tx.alternativeArrangement.findUnique({ where: { id }, include: { event: true } });
    if (!current) throw Errors.notFound("Arrangement");
    const check = checkArrangementVerification({
      actorRole: operator.role,
      eventStatus: current.event.status,
      eventVerification: current.event.verificationStatus,
      from: current.verificationStatus,
      to: body.decision,
      source: current.source,
    });
    if (!check.ok) throw new HttpError(check.code === "NOT_AUTHORIZED" ? 403 : 409, check.code, check.message);
    if (current.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime()) throw Errors.stale();

    const now = new Date();
    const updated = await tx.alternativeArrangement.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data:
        body.decision === "VERIFIED"
          ? { verificationStatus: "VERIFIED", verifiedById: operator.id, lastVerifiedAt: now }
          : { verificationStatus: "UNAVAILABLE" },
    });
    if (updated.count === 0) throw Errors.stale();

    if (body.decision === "VERIFIED") {
      const altEnd = endOfIstDay(current.alternativeDate);
      await tx.civicEvent.update({
        where: { id: current.eventId },
        data: {
          version: { increment: 1 },
          // Keep the notice current at least until the alternative collection has happened.
          ...(current.event.expiryDate && current.event.expiryDate < altEnd ? { expiryDate: altEnd } : {}),
        },
      });
    }
    await audit(
      {
        actorId: operator.id,
        action: body.decision === "VERIFIED" ? "arrangement.verify" : "arrangement.mark_unavailable",
        entity: "AlternativeArrangement",
        entityId: id,
        metadata: { eventId: current.eventId, from: current.verificationStatus, to: body.decision, source: current.source },
      },
      tx,
    );
    return tx.alternativeArrangement.findUniqueOrThrow({ where: { id } });
  });

  const dispatch =
    body.decision === "VERIFIED" ? await runImmediatePass(arrangement.eventId, operator.id, "arrangement.verify") : null;
  return json({ arrangement, dispatch });
});
