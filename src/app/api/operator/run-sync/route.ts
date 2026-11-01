import { after } from "next/server";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { deliverNotifications } from "@/lib/notifications/delivery";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { runSync } from "@/lib/notifications/sync";
import { requireOperator } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/operator/run-sync — OPERATOR only: run the scheduled sync job now (same logic as /api/cron/sync). */
export const POST = route(async () => {
  const operator = await requireOperator();
  const summary = await runSync(createPrismaNotificationStore(prisma));
  if (summary.insertedNotificationIds.length > 0) {
    const ids = summary.insertedNotificationIds.slice(0, 200);
    after(() => deliverNotifications(ids).catch((error) => console.error("[delivery]", error)));
  }
  const result = {
    expiredEvents: summary.expiredEventIds.length,
    eventsProcessed: summary.examinedEventIds.length,
    notificationsCreated: summary.notificationsCreated,
    incompleteEvents: summary.incompleteEventIds.length,
  };
  await audit({ actorId: operator.id, action: "cron.sync", entity: "System", entityId: "manual", metadata: result });
  return json({ ok: true, ...result });
});
