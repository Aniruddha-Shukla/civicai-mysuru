/**
 * Integration test against a real PostgreSQL database (runs in CI; locally when
 * TEST_DATABASE_URL is set). Exercises the production Prisma store, the
 * UNIQUE(contentHash) constraint and the seeded demo scenarios end to end.
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO, refreshDemoScenarios, upsertDemoWardsAndServices } from "@/lib/demo/scenarios";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { runSync } from "@/lib/notifications/sync";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("sync against PostgreSQL", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await db.notification.deleteMany();
    await db.complaint.deleteMany();
    await db.alternativeArrangement.deleteMany();
    await db.civicEvent.deleteMany();
    await db.profile.deleteMany();
    await upsertDemoWardsAndServices(db);
    await db.profile.create({ data: { id: "it-operator", role: "OPERATOR", name: "IT Operator" } });
    await db.profile.create({ data: { id: "it-citizen", role: "CITIZEN", name: "IT Citizen", wardId: DEMO.ward.w1 } });
    await refreshDemoScenarios(db, { operatorId: "it-operator", citizenId: "it-citizen" });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("seeds the exact Case A and Case B messages", async () => {
    const a = await db.notification.findFirstOrThrow({ where: { eventId: DEMO.event.A } });
    const b = await db.notification.findFirstOrThrow({ where: { eventId: DEMO.event.B } });
    expect(a.message).toBe(
      "Garbage Collection Update. Your regular Monday collection is affected by a municipal holiday. " +
        "Alternative collection: Wednesday, 7:00 AM. Source: Verified municipal notice. " +
        "Please keep your waste ready according to the updated schedule.",
    );
    expect(b.message).toBe(
      "Garbage Collection Alert. Your regular Monday collection is affected by a municipal holiday. " +
        "No verified alternative collection schedule has been published yet. " +
        "We will notify you when verified information becomes available.",
    );
  });

  it("first run sends Scenario C's follow-up and archives Scenario D; second run is a no-op", async () => {
    const store = createPrismaNotificationStore(db);
    const before = await db.notification.count();

    const first = await runSync(store);
    expect(first.expiredEventIds).toContain(DEMO.event.D);
    const followUp = await db.notification.findMany({ where: { eventId: DEMO.event.C, templateKey: "update" } });
    expect(followUp).toHaveLength(1);
    expect(followUp[0]!.message).toContain("Alternative collection: Saturday, 8:00 AM.");
    expect((await db.civicEvent.findUniqueOrThrow({ where: { id: DEMO.event.D } })).status).toBe("EXPIRED");

    const afterFirst = await db.notification.count();
    expect(afterFirst).toBe(before + 1);

    const second = await runSync(store);
    expect(second.notificationsCreated).toBe(0);
    expect(await db.notification.count()).toBe(afterFirst);
  });

  it("row-level security is on for every table (Supabase Data API exposure)", async () => {
    const open = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`;
    expect(open).toEqual([]);
  });

  it("the database itself rejects a duplicate contentHash", async () => {
    const existing = await db.notification.findFirstOrThrow();
    const { id: _id, sentAt: _sentAt, ...copy } = existing;
    await expect(db.notification.create({ data: copy })).rejects.toThrow();
  });
});
