import { audit } from "@/lib/audit";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { deliverNotifications } from "@/lib/notifications/delivery";
import { createPrismaNotificationStore } from "@/lib/notifications/prisma-store";
import { runSync } from "@/lib/notifications/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = route(async (request: Request) => {
  if (!isAuthorizedCronRequest(request)) {
    return json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid cron secret." } }, { status: 401 });
  }
  const started = Date.now();
  const summary = await runSync(createPrismaNotificationStore(prisma), { now: new Date() });

  let delivery = { translated: 0, emailed: 0 };
  try {
    delivery = await deliverNotifications(summary.insertedNotificationIds.slice(0, 200));
  } catch (error) {
    console.error("[cron] delivery step failed (in-app notifications are unaffected)", error);
  }

  const result = {
    ok: true,
    expiredEvents: summary.expiredEventIds.length,
    eventsProcessed: summary.examinedEventIds.length,
    notificationsCreated: summary.notificationsCreated,
    incompleteEvents: summary.incompleteEventIds.length,
    budgetExhausted: summary.budgetExhausted,
    translated: delivery.translated,
    emailed: delivery.emailed,
    durationMs: Date.now() - started,
  };
  await audit({ actorId: null, action: "cron.sync", entity: "System", entityId: "cron", metadata: result });
  return json(result);
});

// Vercel Cron issues GET requests; POST is accepted for manual triggering.
export const GET = handler;
export const POST = handler;
