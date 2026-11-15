import { Bell, BellRing, Inbox, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarkAllReadButton, NotificationCard } from "@/components/citizen/notification-card";
import { EmptyState } from "@/components/empty-state";
import { HeroChip, PageHero } from "@/components/page-hero";
import { isAiConfigured } from "@/lib/ai/client";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateFor, formatDateTimeFor, getT, normalizeLang } from "@/lib/i18n";
import type { TemplateKey } from "@/lib/notifications/templates";
import { addDaysToKey, istDateKey } from "@/lib/time";

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

  // Group by IST day: Today / Yesterday / Earlier
  const today = istDateKey(new Date());
  const yesterday = addDaysToKey(today, -1);
  const groups = [
    { key: "today", label: t("notifications.today"), items: notifications.filter((n) => istDateKey(n.sentAt) === today) },
    { key: "yesterday", label: t("notifications.yesterday"), items: notifications.filter((n) => istDateKey(n.sentAt) === yesterday) },
    { key: "earlier", label: t("notifications.earlier"), items: notifications.filter((n) => istDateKey(n.sentAt) < yesterday) },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHero
        icon={BellRing}
        kicker={t("nav.alerts")}
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        aside={unread > 0 ? <MarkAllReadButton label={t("notifications.markAllRead")} /> : undefined}
      >
        <HeroChip icon={Bell} strong={unread > 0}>
          {t("notifications.statNew", { count: unread })}
        </HeroChip>
        <HeroChip icon={Inbox}>{t("notifications.statTotal", { count: notifications.length })}</HeroChip>
        <HeroChip icon={ShieldCheck}>{t("notifications.exact")}</HeroChip>
      </PageHero>

      {notifications.length === 0 ? (
        <EmptyState icon={BellRing} title={t("notifications.empty")} body={t("notifications.emptyBody")} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <h2 id={`group-${group.key}`} className="mb-3 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {group.label}
                <span className="h-px flex-1 bg-border" aria-hidden />
              </h2>
              {/* timeline */}
              <ol className="relative space-y-4 pl-6 before:absolute before:inset-y-2 before:left-[0.4rem] before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-primary/40 before:to-transparent">
                {group.items.map((n, i) => (
                  <li key={n.id} data-reveal="3d" style={{ "--i": i } as React.CSSProperties}>
                    <NotificationCard
                      id={n.id}
                      templateKey={n.templateKey as TemplateKey}
                      message={n.message}
                      translatedMessage={n.translatedLanguage === "kn" ? n.translatedMessage : null}
                      unread={n.status === "sent"}
                      sentAtLabel={formatDateTimeFor(lang, n.sentAt)}
                      forDateLabel={formatDateFor(lang, n.event.affectedDate)}
                      aiAvailable={isAiConfigured()}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
