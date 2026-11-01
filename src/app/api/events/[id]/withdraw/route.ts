import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "@/lib/errors";
import { json, readJson, route } from "@/lib/http";
import { runImmediatePass } from "@/lib/notifications/after-dispatch";
import { requireOperator } from "@/lib/rbac";
import { endOfIstDay } from "@/lib/time";
import { WithdrawSchema } from "@/lib/validation/schemas";
import { checkWithdrawal } from "@/lib/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/events/[id]/withdraw — OPERATOR only. Body: { expectedUpdatedAt, reason }.
 * The notice is never silently removed: everyone already notified immediately
 * receives a retraction. The dedup key is released so a corrected notice can be issued.
 */
export const POST = route(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const operator = await requireOperator();
  const { id } = await params;
  const body = await readJson(request, WithdrawSchema);

  const event = await prisma.$transaction(async (tx) => {
    const current = await tx.civicEvent.findUnique({ where: { id } });
    if (!current) throw Errors.notFound("Notice");
    const check = checkWithdrawal({ actorRole: operator.role, eventStatus: current.status });
    if (!check.ok) throw new HttpError(check.code === "NOT_AUTHORIZED" ? 403 : 409, check.code, check.message);
    if (current.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime()) throw Errors.stale();

    const updated = await tx.civicEvent.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
        withdrawalReason: body.reason,
        dedupKey: null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw Errors.stale();
    await audit(
      {
        actorId: operator.id,
        action: "event.withdraw",
        entity: "CivicEvent",
        entityId: id,
        metadata: { reason: body.reason, previousVerification: current.verificationStatus },
      },
      tx,
    );
    return tx.civicEvent.findUniqueOrThrow({ where: { id } });
  });

  const dispatch = await runImmediatePass(id, operator.id, "event.withdraw");

  // If this notice had been winning a conflict, the remaining verified notice for that
  // ward/service/day is now the one citizens should hear about.
  const peers = await prisma.civicEvent.findMany({
    where: {
      id: { not: id },
      serviceId: event.serviceId,
      wardId: event.wardId,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      affectedDate: { gte: event.affectedDate, lte: endOfIstDay(event.affectedDate) },
    },
    select: { id: true },
  });
  for (const peer of peers) await runImmediatePass(peer.id, operator.id, "conflict.peer_withdrawn");

  return json({ event, dispatch });
});
