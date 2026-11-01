import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarkAllReadButton, NotificationCard } from "@/components/citizen/notification-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateFor, formatDateTimeFor, getT, normalizeLang } from "@/lib/i18n";
import type { TemplateKey } from "@/lib/notifications/templates";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const lang = normalizeLang(profile.language);
  const t = getT(lang);

  const notifications = await prisma.notification.findMany({
    where: { profileId: profile.id },
    orderBy: { sentAt: "desc" },
    take: 100,
    include: { event: { select: { affectedDate: true } } },
  });
  const unread = notifications.filter((n) => n.status === "sent").length;

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={unread > 0 ? <MarkAllReadButton label={t("notifications.markAllRead")} /> : undefined}
      />
      {notifications.length === 0 ? (
        <EmptyState icon={BellRing} title={t("notifications.empty")} body={t("notifications.emptyBody")} />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              id={n.id}
              templateKey={n.templateKey as TemplateKey}
              message={n.message}
              translatedMessage={n.translatedLanguage === "kn" ? n.translatedMessage : null}
              unread={n.status === "sent"}
              sentAtLabel={formatDateTimeFor(lang, n.sentAt)}
              forDateLabel={formatDateFor(lang, n.event.affectedDate)}
              aiAvailable={isAiConfigured()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
