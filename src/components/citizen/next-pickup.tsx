import { ArrowRight, CalendarCheck, CalendarClock, CalendarX, CircleQuestionMark, Clock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatDayFor, getT, type Lang } from "@/lib/i18n";
import type { PickupDay } from "@/lib/pickups";
import { formatTime12h } from "@/lib/time";
import { cn } from "@/lib/utils";

const STYLE = {
  normal: { card: "bg-hero", Icon: CalendarCheck },
  replacement: { card: "bg-hero", Icon: RefreshCw },
  moved: { card: "bg-gradient-to-br from-amber-500 to-orange-600", Icon: CalendarClock },
  maybe: { card: "bg-gradient-to-br from-amber-500 to-amber-700", Icon: CircleQuestionMark },
  cancelled: { card: "bg-gradient-to-br from-rose-600 to-red-700", Icon: CalendarX },
} as const;

/** The one-glance answer to "when is my next pickup?" — big, coloured, plain words. */
export function NextPickup({ day, lang }: { day: PickupDay | null; lang: Lang }) {
  const t = getT(lang);
  if (!day) {
    return (
      <div className="bg-hero rounded-3xl p-5 text-white shadow-lg shadow-primary/30">
        <p className="text-sm font-medium opacity-90">{t("home.nextPickup")}</p>
        <p className="mt-2 text-xl font-bold">{t("home.nothingScheduled")}</p>
      </div>
    );
  }

  const style = STYLE[day.status];
  const pill = {
    normal: t("home.onSchedule"),
    replacement: t("home.replacement"),
    moved: t("home.pickupMoved"),
    maybe: t("home.mayChange"),
    cancelled: t("home.noPickup"),
  }[day.status];

  return (
    <section
      aria-label={t("home.nextPickup")}
      className={cn("relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-primary/25 sm:p-6", style.card)}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-sm font-medium opacity-90">{t("home.nextPickup")}</p>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{pill}</span>
      </div>

      <div className="relative mt-4 flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <style.Icon className="size-8" aria-hidden />
        </div>
        <div className="min-w-0">
          {day.status === "moved" && day.alternative ? (
            <>
              <p className="text-lg font-semibold line-through decoration-2 opacity-80">{formatDayFor(lang, day.date)}</p>
              <p className="flex flex-wrap items-center gap-2 text-2xl font-extrabold leading-tight sm:text-3xl">
                <ArrowRight className="size-6 shrink-0" aria-hidden />
                {formatDayFor(lang, day.alternative.date)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-medium">
                <Clock className="size-4" aria-hidden /> {formatTime12h(day.alternative.time)} · {day.serviceName}
              </p>
            </>
          ) : (
            <>
              <p className={cn("text-2xl font-extrabold leading-tight sm:text-3xl", day.status === "cancelled" && "line-through decoration-2")}>
                {formatDayFor(lang, day.date)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-medium">
                <Clock className="size-4" aria-hidden /> {formatTime12h(day.time)} · {day.serviceName}
              </p>
            </>
          )}
        </div>
      </div>

      <p className="relative mt-4 rounded-2xl bg-black/15 p-3 text-sm leading-relaxed">
        {day.status === "cancelled"
          ? t("home.noNewDate")
          : day.status === "maybe"
            ? t("home.notConfirmed")
            : day.status === "replacement" && day.originalDate
              ? `${t("home.replaces", { date: formatDayFor(lang, day.originalDate) })}. ${t("home.keepReady", { time: formatTime12h(day.time) })}`
              : t("home.keepReady", { time: formatTime12h(day.status === "moved" && day.alternative ? day.alternative.time : day.time) })}
      </p>

      {day.eventId && day.status !== "replacement" ? (
        <Link href={`#notice-${day.eventId}`} className="relative mt-3 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
          {t("home.seeNotice")} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
