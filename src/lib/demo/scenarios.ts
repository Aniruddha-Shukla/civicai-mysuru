/**
 * Demo data: illustrative wards/services and the paper's scenarios (fictitious notice
 * references such as "MCC Circular No. 114/2026"), with dates
 * computed relative to "now" so the demo always looks current. Used by
 * `prisma/seed.ts` (local + every Vercel build) and by the operator console's
 * "Refresh demo scenarios" action. Only rows with the fixed demo ids below are
 * touched — operator-created data is never modified.
 *
 * Notifications for the scenarios are produced by the REAL dispatch code
 * (dispatchWithStore + the Prisma store), so they are byte-identical to what the
 * running system sends.
 */
import type { PrismaClient } from "@prisma/client";
import { eventDedupKey } from "@/lib/conflicts";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { dispatchWithStore } from "@/lib/notifications/sync";
import { defaultExpiry } from "@/lib/schedule";
import { addDaysToKey, DAY_MS, endOfIstDay, istDateKey, istMidnight, nextWeekdayKey } from "@/lib/time";
import { DEMO_WARDS } from "./wards";

export const DEMO = {
  ward: { w1: "demo_ward_1", w2: "demo_ward_2", w3: "demo_ward_3", w4: "demo_ward_4" },
  service: { w1: "demo_svc_gc_1", w2: "demo_svc_gc_2", w3: "demo_svc_gc_3", w4: "demo_svc_gc_4", dry1: "demo_svc_dry_1" },
  event: {
    A: "demo_evt_a_verified_alt",
    B: "demo_evt_b_no_alt",
    C: "demo_evt_c_followup",
    D: "demo_evt_d_expired",
    E1: "demo_evt_e1_conflict",
    E2: "demo_evt_e2_conflict",
    F: "demo_evt_f_pending_review",
  },
  arrangement: { A: "demo_arr_a", C: "demo_arr_c", F: "demo_arr_f" },
  complaint: { open: "demo_cmp_open", review: "demo_cmp_review", resolved: "demo_cmp_resolved" },
} as const;

export async function upsertDemoWardsAndServices(db: PrismaClient) {
  for (const ward of DEMO_WARDS) {
    const id = DEMO.ward[ward.key];
    await db.ward.upsert({
      where: { id },
      update: { name: ward.name, zone: ward.zone, geojson: ward.geojson as object },
      create: { id, name: ward.name, zone: ward.zone, geojson: ward.geojson as object },
    });
    const serviceId = DEMO.service[ward.key];
    // The paper's running example: Garbage Collection, weekly, Monday, 07:00.
    await db.service.upsert({
      where: { id: serviceId },
      update: { name: "Garbage Collection", frequency: "WEEKLY", normalWeekdays: [1], normalTime: "07:00", wardId: id },
      create: { id: serviceId, name: "Garbage Collection", wardId: id, frequency: "WEEKLY", normalWeekdays: [1], normalTime: "07:00" },
    });
  }
  // A second service in the demo citizen's ward, used by Scenario C.
  await db.service.upsert({
    where: { id: DEMO.service.dry1 },
    update: { name: "Dry Waste Collection", frequency: "WEEKLY", normalWeekdays: [4], normalTime: "08:00", wardId: DEMO.ward.w1 },
    create: { id: DEMO.service.dry1, name: "Dry Waste Collection", wardId: DEMO.ward.w1, frequency: "WEEKLY", normalWeekdays: [4], normalTime: "08:00" },
  });
}

interface ScenarioEventSpec {
  id: string;
  serviceId: string;
  wardId: string;
  eventType: string;
  affectedKey: string;
  reason: string;
  source: string;
  sourceUrl?: string;
  verified: boolean;
  normalWeekdays: number[];
  status?: "ACTIVE";
  expiry?: Date;
  verifiedAt?: Date;
}

async function upsertEvent(db: PrismaClient, spec: ScenarioEventSpec, operatorId: string, now: Date) {
  const affectedDate = istMidnight(spec.affectedKey);
  const data = {
    serviceId: spec.serviceId,
    wardId: spec.wardId,
    eventType: spec.eventType,
    affectedDate,
    reason: spec.reason,
    source: spec.source,
    sourceUrl: spec.sourceUrl ?? null,
    verificationStatus: spec.verified ? ("VERIFIED" as const) : ("UNVERIFIED" as const),
    status: "ACTIVE" as const,
    expiryDate: spec.expiry ?? defaultExpiry(affectedDate, spec.normalWeekdays),
    createdById: operatorId,
    verifiedById: spec.verified ? operatorId : null,
    lastVerifiedAt: spec.verified ? (spec.verifiedAt ?? now) : null,
    withdrawnAt: null,
    withdrawalReason: null,
    version: spec.verified ? 2 : 1,
    notifiedVersion: 0,
    dedupKey: eventDedupKey({ serviceId: spec.serviceId, wardId: spec.wardId, affectedDate, source: spec.source }),
  };
  await db.civicEvent.upsert({ where: { id: spec.id }, update: data, create: { id: spec.id, ...data } });
}

/**
 * (Re)create the demo scenarios relative to `now`:
 *  A — Monday municipal holiday, VERIFIED alternative Wednesday 7:00 AM → exact Case A message.
 *  B — the following Monday, same kind of disruption, zero arrangements → exact Case B message.
 *  C — Thursday dry-waste disruption: a Case B alert was already sent, THEN a verified
 *      alternative was published. The follow-up is left pending for the next sync run, so
 *      the evaluator can trigger /api/cron/sync and watch the citizen receive the update.
 *  D — an old notice past its expiry, still ACTIVE: never shown as current, and archived
 *      (EXPIRED) by the next sync run.
 *  E — two conflicting verified notices for the same ward/service/day (ward 2): not
 *      merged, flagged for operator review; the most recently verified one is shown.
 *  F — an UNVERIFIED notice with an unverified alternative, waiting in the operator queue.
 */
export async function refreshDemoScenarios(db: PrismaClient, opts: { operatorId: string; citizenId: string | null; now?: Date }) {
  const now = opts.now ?? new Date();
  const eventIds = Object.values(DEMO.event);

  // Reset only demo rows (children first).
  await db.complaint.deleteMany({ where: { id: { in: Object.values(DEMO.complaint) } } });
  await db.notification.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.alternativeArrangement.deleteMany({ where: { eventId: { in: eventIds } } });
  // Release dedup keys first so re-dated demo events never collide with each other.
  await db.civicEvent.updateMany({ where: { id: { in: eventIds } }, data: { dedupKey: null } });

  const mondayA = nextWeekdayKey(now, 1, 1);
  const mondayB = addDaysToKey(mondayA, 7);
  const thursdayC = nextWeekdayKey(now, 4, 1);
  const wednesdayA = addDaysToKey(mondayA, 2);
  const saturdayC = addDaysToKey(thursdayC, 2);
  const oldKey = addDaysToKey(istDateKey(now), -14);

  const op = opts.operatorId;
  const gc = [1];

  await upsertEvent(db, {
    id: DEMO.event.A, serviceId: DEMO.service.w1, wardId: DEMO.ward.w1, eventType: "holiday", affectedKey: mondayA,
    reason: "a municipal holiday", source: "MCC Circular No. 114/2026 (Health Section)", verified: true, normalWeekdays: gc,
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.B, serviceId: DEMO.service.w1, wardId: DEMO.ward.w1, eventType: "holiday", affectedKey: mondayB,
    reason: "a municipal holiday", source: "MCC Circular No. 121/2026 (Health Section)", verified: true, normalWeekdays: gc,
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.C, serviceId: DEMO.service.dry1, wardId: DEMO.ward.w1, eventType: "breakdown", affectedKey: thursdayC,
    reason: "a collection vehicle breakdown", source: "MCC Zone 1 Office — Vehicle Section notice", verified: true, normalWeekdays: [4],
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.D, serviceId: DEMO.service.w1, wardId: DEMO.ward.w1, eventType: "weather", affectedKey: oldKey,
    reason: "heavy rain and waterlogging", source: "MCC Disaster Cell bulletin", verified: true, normalWeekdays: gc,
    expiry: endOfIstDay(new Date(istMidnight(oldKey).getTime() + 7 * DAY_MS)),
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.E1, serviceId: DEMO.service.w2, wardId: DEMO.ward.w2, eventType: "road_closure", affectedKey: mondayA,
    reason: "road resurfacing work on the collection route", source: "MCC Zone 1 Engineering notice",
    verified: true, normalWeekdays: gc, verifiedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.E2, serviceId: DEMO.service.w2, wardId: DEMO.ward.w2, eventType: "holiday", affectedKey: mondayA,
    reason: "a municipal holiday", source: "MCC Circular No. 114/2026 (Health Section)",
    verified: true, normalWeekdays: gc, verifiedAt: new Date(now.getTime() - 60 * 60 * 1000),
  }, op, now);
  await upsertEvent(db, {
    id: DEMO.event.F, serviceId: DEMO.service.w3, wardId: DEMO.ward.w3, eventType: "special_event", affectedKey: mondayA,
    reason: "the Dasara procession route closure", source: "Phone call from Zone 2 supervisor (unconfirmed)",
    verified: false, normalWeekdays: gc,
  }, op, now);

  const verifiedAt = now;
  await db.alternativeArrangement.create({
    data: {
      id: DEMO.arrangement.A, eventId: DEMO.event.A, alternativeDate: istMidnight(wednesdayA), alternativeTime: "07:00",
      affectedArea: "All streets in Ward 1", source: "MCC Circular No. 114/2026 (Health Section)",
      verificationStatus: "VERIFIED", verifiedById: op, lastVerifiedAt: verifiedAt,
    },
  });
  await db.civicEvent.update({ where: { id: DEMO.event.A }, data: { expiryDate: endOfIstDay(istMidnight(wednesdayA)) } });
  await db.alternativeArrangement.create({
    data: {
      id: DEMO.arrangement.F, eventId: DEMO.event.F, alternativeDate: istMidnight(addDaysToKey(mondayA, 1)), alternativeTime: "06:30",
      affectedArea: "Procession route streets, Ward 3", source: "Phone call from Zone 2 supervisor (unconfirmed)",
    },
  });

  // Send the alerts exactly as the live system would.
  const store = createPrismaNotificationStore(db);
  for (const id of [DEMO.event.A, DEMO.event.B, DEMO.event.C, DEMO.event.E1, DEMO.event.E2]) {
    await dispatchWithStore(store, id, { now, rowBudget: 1000 });
  }

  // Scenario C: AFTER the Case B alert went out, a verified alternative is published.
  // The follow-up (Case A) is intentionally left for the next scheduled sync to send.
  await db.alternativeArrangement.create({
    data: {
      id: DEMO.arrangement.C, eventId: DEMO.event.C, alternativeDate: istMidnight(saturdayC), alternativeTime: "08:00",
      affectedArea: "All streets in Ward 1", source: "MCC Zone 1 Office — Vehicle Section notice",
      verificationStatus: "VERIFIED", verifiedById: op, lastVerifiedAt: now,
    },
  });
  await db.civicEvent.update({
    where: { id: DEMO.event.C },
    data: { version: { increment: 1 }, expiryDate: endOfIstDay(istMidnight(saturdayC)) },
  });

  if (opts.citizenId) {
    const complaints = [
      { id: DEMO.complaint.open, status: "open", description: "Garbage from last week is still piled up near the park gate on 3rd Cross.", note: null },
      { id: DEMO.complaint.review, status: "in_review", description: "The collection vehicle skipped our lane two times this month.", note: "Forwarded to the Zone 1 supervisor for route verification." },
      { id: DEMO.complaint.resolved, status: "resolved", description: "Overflowing community bin near the bus stop needs clearing.", note: "Bin cleared by the Zone 1 team." },
    ];
    for (const c of complaints) {
      await db.complaint.create({
        data: {
          id: c.id, profileId: opts.citizenId, serviceId: DEMO.service.w1, description: c.description,
          status: c.status, operatorNote: c.note,
        },
      });
    }
  }

  return { mondayA, mondayB, thursdayC };
}
