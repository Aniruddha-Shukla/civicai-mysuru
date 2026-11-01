import { beforeEach, describe, expect, it } from "vitest";
import { planEventNotifications } from "@/lib/notifications/plan";
import { runSync, type StoredEvent } from "@/lib/notifications/sync";
import { endOfIstDay, istMidnight } from "@/lib/time";
import { MemoryStore } from "../helpers/memory-store";

const NOW = new Date("2026-11-01T04:30:00.000Z"); // Sunday 1 Nov 2026, 10:00 IST

function makeEvent(overrides: Partial<StoredEvent> = {}): StoredEvent & { expiryDate: Date | null } {
  return {
    id: "evt-1",
    wardId: "ward-1",
    serviceId: "svc-1",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    affectedDate: istMidnight("2026-11-02"), // Monday, inside the 7-day lookahead
    reason: "a municipal holiday",
    version: 2,
    notifiedVersion: 0,
    lastVerifiedAt: new Date("2026-11-01T03:00:00.000Z"),
    expiryDate: endOfIstDay(istMidnight("2026-11-08")),
    service: { name: "Garbage Collection" },
    arrangements: [],
    ...overrides,
  } as StoredEvent & { expiryDate: Date | null };
}

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
  store.citizens = [
    { id: "c1", wardId: "ward-1" },
    { id: "c2", wardId: "ward-1" },
    { id: "c3", wardId: "ward-2" },
  ];
});

describe("cron sync", () => {
  it("running sync twice on unchanged data does not create duplicate notifications", async () => {
    store.events.set("evt-1", makeEvent());
    const first = await runSync(store, { now: NOW });
    expect(first.notificationsCreated).toBe(2); // c1, c2 — not c3 (other ward)
    const second = await runSync(store, { now: NOW });
    expect(second.notificationsCreated).toBe(0);
    expect(store.notifications).toHaveLength(2);
  });

  it("dedup holds even if notifiedVersion was never bumped (e.g. two overlapping runs)", async () => {
    store.events.set("evt-1", makeEvent());
    await runSync(store, { now: NOW });
    store.events.get("evt-1")!.notifiedVersion = 0; // simulate a run that crashed before step 5
    const rerun = await runSync(store, { now: NOW });
    expect(rerun.notificationsCreated).toBe(0);
    expect(store.notifications).toHaveLength(2);
  });

  it("contentHash uniqueness also blocks a racing insert of the same planned rows", async () => {
    const event = makeEvent();
    const plan = planEventNotifications({ event, citizensInWard: store.citizens, history: [] });
    expect(await store.insertNotifications(plan)).toHaveLength(2);
    expect(await store.insertNotifications(plan)).toHaveLength(0);
  });

  it("alternative published after a 'no alternative yet' alert → follow-up Case A update, sent once", async () => {
    store.events.set("evt-1", makeEvent());
    await runSync(store, { now: NOW });
    expect(store.notifications.every((n) => n.templateKey === "no_alternative_published")).toBe(true);

    const e = store.events.get("evt-1")!;
    e.arrangements = [
      {
        alternativeDate: istMidnight("2026-11-04"),
        alternativeTime: "07:00",
        verificationStatus: "VERIFIED",
        lastVerifiedAt: NOW,
        createdAt: NOW,
      },
    ];
    e.version += 1;

    const followUp = await runSync(store, { now: NOW });
    expect(followUp.notificationsCreated).toBe(2);
    const updates = store.notifications.filter((n) => n.templateKey === "update");
    expect(updates).toHaveLength(2);
    expect(updates[0]!.message).toContain("Alternative collection: Wednesday, 7:00 AM.");
    expect((await runSync(store, { now: NOW })).notificationsCreated).toBe(0);
  });

  it("withdrawn notice → retraction to everyone already notified, exactly once", async () => {
    store.events.set("evt-1", makeEvent());
    await runSync(store, { now: NOW });
    const e = store.events.get("evt-1")!;
    e.status = "WITHDRAWN";
    e.version += 1;
    store.citizens = [{ id: "c1", wardId: "ward-9" }, { id: "c2", wardId: "ward-1" }]; // c1 moved ward meanwhile

    const run = await runSync(store, { now: NOW });
    expect(run.notificationsCreated).toBe(2);
    expect(store.notifications.filter((n) => n.templateKey === "retraction").map((n) => n.profileId).sort()).toEqual(["c1", "c2"]);
    expect((await runSync(store, { now: NOW })).notificationsCreated).toBe(0);
  });

  it("unverified notices are never announced", async () => {
    store.events.set("evt-1", makeEvent({ verificationStatus: "UNVERIFIED", version: 1 }));
    expect((await runSync(store, { now: NOW })).notificationsCreated).toBe(0);
  });

  it("events past expiry are archived first and never announced", async () => {
    store.events.set("evt-1", makeEvent({ expiryDate: new Date(NOW.getTime() - 1000) } as Partial<StoredEvent>));
    const run = await runSync(store, { now: NOW });
    expect(run.expiredEventIds).toEqual(["evt-1"]);
    expect(store.events.get("evt-1")!.status).toBe("EXPIRED");
    expect(run.notificationsCreated).toBe(0);
  });

  it("events beyond the 7-day lookahead are left for a later run", async () => {
    store.events.set("evt-1", makeEvent({ affectedDate: istMidnight("2026-11-16") }));
    expect((await runSync(store, { now: NOW })).examinedEventIds).toEqual([]);
  });

  it("respects the per-invocation row budget and finishes on the next run", async () => {
    store.citizens = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, wardId: "ward-1" }));
    store.events.set("evt-1", makeEvent());
    const first = await runSync(store, { now: NOW, rowBudget: 5 });
    expect(first.notificationsCreated).toBe(5);
    expect(first.incompleteEventIds).toEqual(["evt-1"]);
    const second = await runSync(store, { now: NOW, rowBudget: 5 });
    expect(second.notificationsCreated).toBe(2);
    expect(store.notifications).toHaveLength(7);
  });

  it("conflicting notices: only the most recently verified one is announced", async () => {
    store.events.set("evt-old", makeEvent({ id: "evt-old", reason: "road work", lastVerifiedAt: new Date("2026-11-01T01:00:00Z") }));
    store.events.set("evt-new", makeEvent({ id: "evt-new", reason: "a municipal holiday", lastVerifiedAt: new Date("2026-11-01T03:00:00Z") }));
    await runSync(store, { now: NOW });
    expect(new Set(store.notifications.map((n) => n.eventId))).toEqual(new Set(["evt-new"]));
  });
});
