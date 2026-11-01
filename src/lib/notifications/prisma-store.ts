import type { PrismaClient } from "@prisma/client";
import { endOfIstDay, startOfIstDay } from "@/lib/time";
import type { NotificationStore, StoredEvent } from "./sync";

const eventInclude = {
  service: { select: { name: true } },
  arrangements: {
    select: { alternativeDate: true, alternativeTime: true, verificationStatus: true, lastVerifiedAt: true, createdAt: true },
  },
} as const;

/**
 * Prisma-backed implementation of the notification store used by the cron job, the
 * immediate passes and the demo seed. Takes the client as a parameter (no `server-only`
 * import) so the seed script can reuse exactly the production dispatch logic.
 */
export function createPrismaNotificationStore(db: PrismaClient): NotificationStore {
  return {
    async expireEvents(now, limit) {
      const due = await db.civicEvent.findMany({
        where: { status: "ACTIVE", expiryDate: { lt: now } },
        select: { id: true },
        take: limit,
        orderBy: { expiryDate: "asc" },
      });
      if (due.length === 0) return [];
      const ids = due.map((e) => e.id);
      await db.$transaction([
        db.civicEvent.updateMany({ where: { id: { in: ids }, status: "ACTIVE" }, data: { status: "EXPIRED" } }),
        db.auditLog.createMany({
          data: ids.map((id) => ({ actorId: null, action: "event.expire", entity: "CivicEvent", entityId: id, metadata: { by: "cron" } })),
        }),
      ]);
      return ids;
    },

    async listChangedEventIds(now, until, limit) {
      const rows = await db.civicEvent.findMany({
        where: {
          version: { gt: db.civicEvent.fields.notifiedVersion },
          OR: [
            { status: "ACTIVE", affectedDate: { lte: until }, OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] },
            { status: "WITHDRAWN" },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: limit,
      });
      return rows.map((r) => r.id);
    },

    async loadEvent(eventId) {
      const e = await db.civicEvent.findUnique({ where: { id: eventId }, include: eventInclude });
      return e ? (e satisfies StoredEvent) : null;
    },

    async listConflictPeers(event) {
      return db.civicEvent.findMany({
        where: {
          id: { not: event.id },
          serviceId: event.serviceId,
          wardId: event.wardId,
          status: "ACTIVE",
          affectedDate: { gte: startOfIstDay(event.affectedDate), lte: endOfIstDay(event.affectedDate) },
        },
        select: {
          id: true, serviceId: true, wardId: true, affectedDate: true, status: true,
          verificationStatus: true, lastVerifiedAt: true, expiryDate: true,
        },
      });
    },

    async listCitizensInWard(wardId) {
      return db.profile.findMany({ where: { wardId, role: "CITIZEN" }, select: { id: true, wardId: true } });
    },

    async loadHistory(eventId, profileIds) {
      return db.notification.findMany({
        where: { eventId, ...(profileIds ? { profileId: { in: profileIds } } : {}) },
        select: { profileId: true, message: true, templateKey: true, contentHash: true, sentAt: true },
        orderBy: { sentAt: "asc" },
      });
    },

    async insertNotifications(rows) {
      // UNIQUE(contentHash) + skipDuplicates: even two overlapping cron runs cannot double-send.
      const inserted = await db.notification.createManyAndReturn({ data: rows, skipDuplicates: true, select: { id: true } });
      return inserted.map((r) => r.id);
    },

    async markNotified(eventId, version) {
      await db.civicEvent.updateMany({ where: { id: eventId, version }, data: { notifiedVersion: version } });
    },
  };
}
