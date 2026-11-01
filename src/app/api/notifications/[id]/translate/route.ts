import { isAiConfigured } from "@/lib/ai/client";
import { transformNotice } from "@/lib/ai/translate";
import { auditAiRejection } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSignedIn } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/notifications/[id]/translate — on-demand Kannada translation of an alert.
 * The translation is stored only if it passes the hallucination firewall; the
 * deterministic English message is never modified.
 */
export const POST = route(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const profile = await requireSignedIn();
  const { id } = await params;
  const notification = await prisma.notification.findFirst({ where: { id, profileId: profile.id } });
  if (!notification) throw Errors.notFound("Notification");
  if (notification.translatedMessage && notification.translatedLanguage === "kn") {
    return json({ status: "ok", text: notification.translatedMessage });
  }
  if (!isAiConfigured()) return json({ status: "unavailable", text: notification.message });

  await enforceRateLimit(`ai-translate:${profile.id}`, 20, 10 * 60 * 1000);
  const result = await transformNotice({
    message: notification.message,
    mode: "translate_kn",
    onReject: (rejection) => auditAiRejection(profile.id, "Notification", id, rejection),
  });
  if (result.status === "ok") {
    await prisma.notification.update({ where: { id }, data: { translatedMessage: result.text, translatedLanguage: "kn" } });
  }
  return json({ status: result.status, text: result.text });
});
