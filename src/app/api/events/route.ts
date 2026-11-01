import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { eventDedupKey } from "@/lib/conflicts";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "@/lib/errors";
import { json, parseWith, readJson, route, searchParamsObject } from "@/lib/http";
import { requireOperator, requireSignedIn } from "@/lib/rbac";
import { defaultExpiry } from "@/lib/schedule";
import { endOfIstDay, istDateKey, istMidnight } from "@/lib/time";
import { CreateEventSchema, EventsQuerySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/events — any signed-in user. Citizens only ever see VERIFIED notices. */
export const GET = route(async (request: Request) => {
  const profile = await requireSignedIn();
  const q = parseWith(EventsQuerySchema, searchParamsObject(request));
  const isOperator = profile.role === "OPERATOR";

  const where: Prisma.CivicEventWhereInput = {
    ...(q.wardId ? { wardId: q.wardId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(isOperator ? (q.verification ? { verificationStatus: q.verification } : {}) : { verificationStatus: "VERIFIED" }),
  };

  const rows = await prisma.civicEvent.findMany({
    where,
    orderBy: [{ affectedDate: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: {
      id: true, wardId: true, serviceId: true, eventType: true, affectedDate: true, reason: true, source: true,
      sourceUrl: true, verificationStatus: true, status: true, expiryDate: true, lastVerifiedAt: true,
      createdAt: true, updatedAt: true,
      ward: { select: { name: true } },
      service: { select: { name: true } },
      arrangements: {
        where: isOperator ? {} : { verificationStatus: { in: ["VERIFIED", "UNVERIFIED"] } },
        select: {
          id: true, alternativeDate: true, alternativeTime: true, affectedArea: true, source: true,
          verificationStatus: true, lastVerifiedAt: true, createdAt: true, updatedAt: true,
        },
      },
    },
  });

  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  return json({ items, nextCursor: hasMore ? items.at(-1)!.id : null });
});

/** POST /api/events — OPERATOR only. Creates an UNVERIFIED notice; nothing is sent until it is verified. */
export const POST = route(async (request: Request) => {
  const operator = await requireOperator();
  const body = await readJson(request, CreateEventSchema);
  const now = new Date();

  if (body.affectedDate < istDateKey(now)) {
    throw new HttpError(400, "VALIDATION_FAILED", "The affected date cannot be in the past.", [
      { path: "affectedDate", message: "The affected date cannot be in the past." },
    ]);
  }

  const service = await prisma.service.findUnique({ where: { id: body.serviceId }, select: { id: true, wardId: true, normalWeekdays: true } });
  if (!service) {
    throw new HttpError(400, "VALIDATION_FAILED", "Unknown service.", [{ path: "serviceId", message: "Choose a valid service." }]);
  }

  const affectedDate = istMidnight(body.affectedDate);
  const dedupKey = eventDedupKey({ serviceId: service.id, wardId: service.wardId, affectedDate, source: body.source });
  const duplicate = await prisma.civicEvent.findUnique({ where: { dedupKey }, select: { id: true } });
  if (duplicate) {
    throw Errors.conflict("DUPLICATE_NOTICE", "This announcement has already been recorded for this ward, service and date.", {
      existingEventId: duplicate.id,
    });
  }

  let event;
  try {
    event = await prisma.$transaction(async (tx) => {
      const created = await tx.civicEvent.create({
        data: {
          serviceId: service.id,
          wardId: service.wardId,
          eventType: body.eventType,
          affectedDate,
          reason: body.reason,
          source: body.source,
          sourceUrl: body.sourceUrl ?? null,
          expiryDate: body.expiryDate ? endOfIstDay(istMidnight(body.expiryDate)) : defaultExpiry(affectedDate, service.normalWeekdays),
          createdById: operator.id,
          dedupKey,
        },
      });
      await audit({ actorId: operator.id, action: "event.create", entity: "CivicEvent", entityId: created.id, metadata: { source: body.source } }, tx);
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Errors.conflict("DUPLICATE_NOTICE", "This announcement has already been recorded for this ward, service and date.");
    }
    throw error;
  }

  // Different notices for the same ward/service/day are never merged — flag them for review.
  const conflicts = await prisma.civicEvent.findMany({
    where: {
      id: { not: event.id },
      serviceId: event.serviceId,
      wardId: event.wardId,
      status: "ACTIVE",
      affectedDate: { gte: affectedDate, lte: endOfIstDay(affectedDate) },
    },
    select: { id: true, reason: true, source: true, verificationStatus: true },
  });
  if (conflicts.length > 0) {
    await audit({
      actorId: operator.id,
      action: "event.conflict_detected",
      entity: "CivicEvent",
      entityId: event.id,
      metadata: { conflictingEventIds: conflicts.map((c) => c.id) },
    });
  }

  return json({ event, conflicts }, { status: 201 });
});
