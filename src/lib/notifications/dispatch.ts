import "server-only";
import { prisma } from "@/lib/db";
import { createPrismaNotificationStore } from "./prisma-store";
import { dispatchWithStore, type DispatchOutcome } from "./sync";

const IMMEDIATE_ROW_BUDGET = 2000;

/**
 * Immediate notification pass for one event (called right after verify / withdraw /
 * arrangement verification — citizens do not wait for the next cron run). If it
 * cannot finish (row budget), notifiedVersion stays behind and the cron completes it.
 */
export async function dispatchEventNow(eventId: string): Promise<DispatchOutcome> {
  return dispatchWithStore(createPrismaNotificationStore(prisma), eventId, { now: new Date(), rowBudget: IMMEDIATE_ROW_BUDGET });
}

/** After a citizen sets/changes their ward: send them the current verified alerts for their NEW ward only. */
export async function notifyCitizenOfCurrentEvents(profileId: string, wardId: string): Promise<string[]> {
  const now = new Date();
  const events = await prisma.civicEvent.findMany({
    where: { wardId, status: "ACTIVE", verificationStatus: "VERIFIED", OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] },
    select: { id: true },
    take: 20,
  });
  const store = createPrismaNotificationStore(prisma);
  const inserted: string[] = [];
  for (const event of events) {
    const outcome = await dispatchWithStore(store, event.id, { now, rowBudget: 5, onlyProfileId: profileId });
    inserted.push(...outcome.insertedIds);
  }
  return inserted;
}
