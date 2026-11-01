import "server-only";
import { after } from "next/server";
import { audit } from "@/lib/audit";
import { deliverNotifications } from "./delivery";
import { dispatchEventNow } from "./dispatch";

/**
 * Run the immediate notification pass for an event after a state change. In-app rows
 * are written before the response returns; translation/email run after the response
 * (`after`). A failure here never undoes the committed change — the event's version
 * stays ahead of notifiedVersion and the scheduled sync completes the pass.
 */
export async function runImmediatePass(eventId: string, actorId: string, trigger: string) {
  try {
    const outcome = await dispatchEventNow(eventId);
    await audit({
      actorId,
      action: "notification.dispatch",
      entity: "CivicEvent",
      entityId: eventId,
      metadata: { trigger, planned: outcome.planned, inserted: outcome.insertedIds.length, complete: outcome.complete, superseded: outcome.superseded },
    });
    if (outcome.insertedIds.length > 0) {
      after(() => deliverNotifications(outcome.insertedIds).catch((error) => console.error("[delivery]", error)));
    }
    return { notificationsCreated: outcome.insertedIds.length, complete: outcome.complete, supersededByConflict: outcome.superseded };
  } catch (error) {
    console.error("[dispatch] immediate pass failed; the scheduled sync will retry", error);
    return { notificationsCreated: 0, complete: false, deferredToSync: true };
  }
}
