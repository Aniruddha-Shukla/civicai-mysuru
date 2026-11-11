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

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-primary">{t("greeting.hello")}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t(greetingKey(now))}, {profile.name.split(" ")[0] ?? profile.name}
        </h1>
      </div>

      {unread > 0 ? (
        <Link href="/notifications" className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-card p-3 text-sm shadow-soft transition-colors hover:bg-accent">
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bell className="size-5" aria-hidden />
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-white">{unread}</span>
          </span>
          <span className="flex-1 font-medium">{t("dashboard.unreadAlerts", { count: unread })}</span>
          <ChevronRight className="size-5 text-primary" aria-hidden />
        </Link>
      ) : null}

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

      <section className="grid grid-cols-2 gap-3">
        <Link href="/ask" data-spotlight className="spotlight group rounded-3xl border bg-card p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
            <MessageCircleQuestionMark className="size-6" aria-hidden />
          </span>
          <span className="block font-bold">{t("home.askTitle")}</span>
          <span className="block text-xs text-muted-foreground">{t("home.askBody")}</span>
        </Link>
        <Link href="/report" data-spotlight className="spotlight group rounded-3xl border bg-card p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
            <Megaphone className="size-6" aria-hidden />
          </span>
          <span className="block font-bold">{t("home.reportTitle")}</span>
          <span className="block text-xs text-muted-foreground">{t("home.reportBody")}</span>
        </Link>
      </section>

      <section aria-labelledby="notices-heading" className="space-y-3">
        <h2 id="notices-heading" className="text-lg font-bold">
          {t("home.changes")}
        </h2>
        {view.events.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("home.allGood")} body={t("home.allGoodBody")} />
        ) : (
          view.events.map((event, i) => (
            <div key={event.id} data-reveal style={{ "--i": i } as React.CSSProperties}>
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
          ))
        )}
      </section>

      <section aria-labelledby="usual-heading" className="space-y-2">
        <h2 id="usual-heading" className="text-lg font-bold">
          {t("home.usual")}
        </h2>
        {view.services.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("dashboard.noServices")} />
        ) : (
          <ul data-reveal className="divide-y overflow-hidden rounded-3xl border bg-card shadow-soft">
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
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                  {formatTime12h(service.normalTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
