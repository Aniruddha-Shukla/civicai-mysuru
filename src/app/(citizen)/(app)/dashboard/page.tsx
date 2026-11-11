import { Bell, CalendarDays, ChevronRight, Clock, Megaphone, MessageCircleQuestionMark, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextPickup } from "@/components/citizen/next-pickup";
import { PickupStrip, type StripDay } from "@/components/citizen/pickup-strip";
import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { getSessionProfile } from "@/lib/auth";
import { loadCitizenWardView } from "@/lib/data/citizen";
import { prisma } from "@/lib/db";
import { dayPartsFor, formatDayFor, getT, normalizeLang, weekdayNameFor, type Lang, type TFunction } from "@/lib/i18n";
import { greetingKey } from "@/lib/greeting";
import { buildPickupDays, type PickupDay } from "@/lib/pickups";
import { formatTime12h } from "@/lib/time";

export const metadata: Metadata = { title: "Home" };

function toStripDay(d: PickupDay, lang: Lang, t: TFunction): StripDay {
  const day = formatDayFor(lang, d.date);
  const time = formatTime12h(d.time);
  const base = { key: `${d.dateKey}|${d.serviceId}|${d.status}`, status: d.status, ...dayPartsFor(lang, d.date), noticeId: d.eventId };
  switch (d.status) {
    case "moved":
      return {
        ...base,
        title: t("home.pickupMoved"),
        detail: d.alternative
          ? `${d.serviceName}: ${day} → ${formatDayFor(lang, d.alternative.date)}, ${formatTime12h(d.alternative.time)}`
          : d.serviceName,
      };
    case "cancelled":
      return { ...base, title: `${t("home.noPickup")} · ${day}`, detail: `${d.serviceName}. ${t("home.noNewDate")}` };
    case "maybe":
      return { ...base, title: `${t("home.mayChange")} · ${day}`, detail: `${d.serviceName}. ${t("home.notConfirmed")}` };
    case "replacement":
      return {
        ...base,
        title: `${t("home.replacement")} · ${day}, ${time}`,
        detail: `${d.serviceName}. ${d.originalDate ? t("home.replaces", { date: formatDayFor(lang, d.originalDate) }) : ""}`,
        noticeId: undefined,
      };
    default:
      return { ...base, title: `${day} · ${time}`, detail: `${d.serviceName} · ${t("home.onSchedule")}` };
  }
}

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

  const pickups = buildPickupDays(view.services, view.events, now, 14);
  const strip = pickups.map((d) => toStripDay(d, lang, t));

  const legend = [
    { dot: "bg-violet-500", label: t("home.status.normal") },
    { dot: "bg-indigo-500", label: t("home.status.replacement") },
    { dot: "bg-amber-500", label: t("home.status.moved") },
    { dot: "bg-rose-500", label: t("home.status.cancelled") },
  ];
  const action = "spotlight group flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98] lg:flex-row lg:items-center lg:gap-4";

  return (
    <div className="space-y-7 lg:space-y-8">
      {/* Greeting and unread alerts side by side on wide screens */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{t("greeting.hello")}</p>
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
            {t(greetingKey(now))}, {profile.name.split(" ")[0] ?? profile.name}
          </h1>
        </div>
        {unread > 0 ? (
          <Link
            href="/notifications"
            className="group flex items-center gap-3 rounded-2xl border border-primary/25 bg-card p-3 text-sm shadow-soft transition-colors hover:bg-accent lg:min-w-[22rem]"
          >
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bell className="size-5" aria-hidden />
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-white">{unread}</span>
            </span>
            <span className="flex-1 font-medium">{t("dashboard.unreadAlerts", { count: unread })}</span>
            <ChevronRight className="size-5 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:gap-8">
        {/* Main column: the answer first, then the next two weeks */}
        <div className="min-w-0 space-y-7 lg:col-span-8">
          <NextPickup day={pickups[0] ?? null} lang={lang} now={now} />

          {strip.length > 0 ? (
            <section aria-labelledby="strip-heading" className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="strip-heading" className="text-lg font-bold">
                  {t("home.twoWeeks")}
                </h2>
                <span className="text-xs text-muted-foreground">{t("home.tapDay")}</span>
              </div>
              <PickupStrip days={strip} />
            </section>
          ) : null}
        </div>

        {/* Side panel: what you can do, your usual days, and what the colours mean */}
        <aside className="min-w-0 space-y-7 lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Link href="/ask" data-spotlight className={action}>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                <MessageCircleQuestionMark className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t("home.askTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("home.askBody")}</span>
              </span>
              <ChevronRight className="hidden size-5 text-primary transition-transform group-hover:translate-x-1 lg:block" aria-hidden />
            </Link>
            <Link href="/report" data-spotlight className={action}>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                <Megaphone className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t("home.reportTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("home.reportBody")}</span>
              </span>
              <ChevronRight className="hidden size-5 text-primary transition-transform group-hover:translate-x-1 lg:block" aria-hidden />
            </Link>
          </section>

          <section aria-labelledby="usual-heading" className="space-y-2">
            <h2 id="usual-heading" className="text-lg font-bold">
              {t("home.usual")}
            </h2>
            {view.services.length === 0 ? (
              <EmptyState icon={CalendarDays} title={t("dashboard.noServices")} />
            ) : (
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
                {view.services.map((service) => (
                  <li key={service.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <CalendarDays className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{service.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {service.frequency === "DAILY"
                          ? t("home.everyDay")
                          : t("home.every", { days: service.normalWeekdays.map((d) => weekdayNameFor(lang, d)).join(", ") })}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold">
                      <Clock className="size-4 text-muted-foreground" aria-hidden />
                      {formatTime12h(service.normalTime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="legend-heading" className="rounded-3xl border bg-card p-4 shadow-soft">
            <h2 id="legend-heading" className="mb-3 text-sm font-bold">
              {t("home.legend")}
            </h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {legend.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className={`size-3 shrink-0 rounded-full ${item.dot}`} aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* Full-width row: the notices themselves, two per row on wide screens */}
      <section aria-labelledby="notices-heading" className="space-y-3">
        <h2 id="notices-heading" className="text-lg font-bold">
          {t("home.changes")}
        </h2>
        {view.events.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("home.allGood")} body={t("home.allGoodBody")} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {view.events.map((event, i) => (
              <div key={event.id} data-reveal style={{ "--i": i % 2 } as React.CSSProperties}>
                <EventCard
                  id={`notice-${event.id}`}
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
