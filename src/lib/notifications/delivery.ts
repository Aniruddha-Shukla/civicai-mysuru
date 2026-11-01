/**
 * Post-insert delivery enhancements. The in-app Notification row is the guaranteed
 * channel and already exists before anything here runs; translation and email are
 * best-effort extras that can fail without affecting the alert itself.
 */
import "server-only";
import { transformNotice } from "@/lib/ai/translate";
import { auditAiRejection } from "@/lib/audit";
import { prisma } from "@/lib/db";

const MAX_TRANSLATIONS_PER_PASS = 6;
const MAX_EMAILS_PER_PASS = 50;

/** Translate Kannada-preference citizens' new alerts (firewall-checked) and send optional emails. */
export async function deliverNotifications(notificationIds: string[]): Promise<{ translated: number; emailed: number }> {
  if (notificationIds.length === 0) return { translated: 0, emailed: 0 };
  const rows = await prisma.notification.findMany({
    where: { id: { in: notificationIds } },
    select: { id: true, eventId: true, message: true, profile: { select: { language: true, email: true } } },
  });

  let translated = 0;
  const cache = new Map<string, string | null>();
  for (const row of rows.filter((r) => r.profile.language === "kn")) {
    if (!cache.has(row.message)) {
      if (cache.size >= MAX_TRANSLATIONS_PER_PASS) continue;
      const result = await transformNotice({
        message: row.message,
        mode: "translate_kn",
        onReject: (rejection) => auditAiRejection(null, "Notification", row.id, rejection),
      });
      cache.set(row.message, result.status === "ok" ? result.text : null);
    }
    const text = cache.get(row.message);
    if (text) {
      await prisma.notification.update({ where: { id: row.id }, data: { translatedMessage: text, translatedLanguage: "kn" } });
      translated++;
    }
  }

  let emailed = 0;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "CivicAI Mysuru <onboarding@resend.dev>";
    for (const row of rows.filter((r) => r.profile.email).slice(0, MAX_EMAILS_PER_PASS)) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [row.profile.email], subject: row.message.split(".")[0], text: row.message }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          await prisma.notification.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
          emailed++;
        }
      } catch (error) {
        console.error("[delivery] email failed", error);
      }
    }
  }
  return { translated, emailed };
}
