import { Bell, CalendarDays, Clock, Megaphone, MessageCircleQuestionMark, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionProfile } from "@/lib/auth";
import { loadCitizenWardView } from "@/lib/data/citizen";
import { prisma } from "@/lib/db";
import { formatDateFor, getT, normalizeLang, weekdayNameFor } from "@/lib/i18n";
import { upcomingCollectionDays } from "@/lib/schedule";
import { formatTime12h, istDateKey, istMidnight } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile?.wardId) redirect("/onboarding");
  const lang = normalizeLang(profile.language);
  const t = getT(lang);
  const now = new Date();

  const [view, unread] = await Promise.all([
    loadCitizenWardView(profile.wardId, now),
    prisma.notification.count({ where: { profileId: profile.id, status: "sent" } }),
  ]);
  if (!view) redirect("/onboarding");

  const affected = new Set(view.events.map((e) => `${e.serviceId}|${istDateKey(e.affectedDate)}`));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{t("dashboard.greeting", { name: profile.name })}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.yourWard")}: {view.ward.name} · {view.ward.zone}
        </p>
      </div>

      {unread > 0 ? (
        <Link href="/notifications" className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-secondary p-3 text-sm">
          <span className="flex items-center gap-2">
            <Bell className="size-4 text-primary" aria-hidden />
            {t("dashboard.unreadAlerts", { count: unread })}
          </span>
          <span className="font-medium text-primary">{t("dashboard.viewAlerts")} →</span>
        </Link>
      ) : null}

      <section aria-labelledby="notices-heading" className="space-y-3">
        <h2 id="notices-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("dashboard.currentNotices")}
        </h2>
        {view.events.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("dashboard.noDisruptions")} body={t("dashboard.noDisruptionsBody")} />
        ) : (
          view.events.map((event) => (
            <EventCard
              key={event.id}
              lang={lang}
              serviceName={event.service.name}
              eventType={event.eventType}
              affectedDate={event.affectedDate}
              reason={event.reason}
              source={event.source}
              sourceUrl={event.sourceUrl}
              verificationStatus={event.verificationStatus}
              lastVerifiedAt={event.lastVerifiedAt}
              alternative={event.alternative}
              hasConflict={event.hasConflict}
            />
          ))
        )}
      </section>

      <section aria-labelledby="schedule-heading" className="space-y-3">
        <h2 id="schedule-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("dashboard.normalSchedule")}
        </h2>
        {view.services.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("dashboard.noServices")} />
        ) : (
          view.services.map((service) => {
            const upcoming = upcomingCollectionDays(now, service.normalWeekdays, 3);
            return (
              <Card key={service.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    {service.name}
                    <Badge variant="secondary">{t(`dashboard.frequency.${service.frequency}`)}</Badge>
                  </CardTitle>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-4" aria-hidden />
                    {service.frequency === "DAILY" ? t("dashboard.frequency.DAILY") : service.normalWeekdays.map((d) => weekdayNameFor(lang, d)).join(", ")} ·{" "}
                    {formatTime12h(service.normalTime)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("dashboard.upcoming")}</p>
                  <ul className="grid gap-2">
                    {upcoming.map((key) => {
                      const isAffected = affected.has(`${service.id}|${key}`);
                      return (
                        <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                          <span className={isAffected ? "line-through decoration-destructive/60" : undefined}>{formatDateFor(lang, istMidnight(key))}</span>
                          {isAffected ? <Badge variant="destructive">{t("dashboard.affected")}</Badge> : null}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-auto justify-start whitespace-normal p-4 text-left">
          <Link href="/ask">
            <MessageCircleQuestionMark className="text-primary" aria-hidden />
            {t("dashboard.askCta")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start whitespace-normal p-4 text-left">
          <Link href="/report">
            <Megaphone className="text-primary" aria-hidden />
            {t("dashboard.reportCta")}
          </Link>
        </Button>
      </section>
    </div>
  );
}
