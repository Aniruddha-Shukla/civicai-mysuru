"use client";

import { ArrowRight, CalendarCheck, CalendarClock, CalendarX, ChevronLeft, ChevronRight, CircleQuestionMark, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { PickupStatus } from "@/lib/pickups";
import { cn } from "@/lib/utils";

/** Pre-formatted on the server (avoids date-format differences between server and browser). */
export interface StripDay {
  key: string;
  status: PickupStatus;
  weekday: string;
  day: string;
  month: string;
  title: string;
  detail: string;
  noticeId?: string;
}

const LOOK: Record<PickupStatus, { tile: string; dot: string; Icon: typeof CalendarCheck }> = {
  normal: { tile: "border-violet-200 bg-violet-50 text-violet-950", dot: "bg-violet-500", Icon: CalendarCheck },
  replacement: { tile: "border-indigo-200 bg-indigo-50 text-indigo-950", dot: "bg-indigo-500", Icon: RefreshCw },
  moved: { tile: "border-amber-300 bg-amber-50 text-amber-900", dot: "bg-amber-500", Icon: CalendarClock },
  maybe: { tile: "border-dashed border-amber-400 bg-amber-50 text-amber-900", dot: "bg-amber-400", Icon: CircleQuestionMark },
  cancelled: { tile: "border-rose-300 bg-rose-50 text-rose-900", dot: "bg-rose-500", Icon: CalendarX },
};

/**
 * Tappable two-week strip: each pickup day is a coloured tile; tapping shows what happens that day.
 * Mouse users get arrow buttons, keyboard users get ←/→/Home/End, touch users just swipe.
 */
export function PickupStrip({ days }: { days: StripDay[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(days[0]?.key ?? "");
  const [edges, setEdges] = useState({ start: true, end: false });
  const scroller = useRef<HTMLDivElement>(null);
  const tiles = useRef<Map<string, HTMLButtonElement>>(new Map());

  const index = Math.max(0, days.findIndex((d) => d.key === selected));
  const current = days[index];

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges]);

  if (!current) return null;
  const look = LOOK[current.status];

  const select = (i: number, focus: boolean) => {
    const day = days[Math.min(days.length - 1, Math.max(0, i))]!;
    setSelected(day.key);
    const tile = tiles.current.get(day.key);
    if (focus) tile?.focus();
    tile?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8 });

  return (
    <div className="space-y-3">
      <div className="group/strip relative">
        <div
          ref={scroller}
          onScroll={updateEdges}
          role="listbox"
          aria-label={t("home.twoWeeks")}
          aria-orientation="horizontal"
          onKeyDown={(e) => {
            const move = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: days.length - 1 }[e.key];
            if (move === undefined) return;
            e.preventDefault();
            select(move, true);
          }}
          className={cn(
            "-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto scroll-smooth px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:px-1 [&::-webkit-scrollbar]:hidden",
            // fade out the edge where more days are hidden
            !edges.start && !edges.end && "[mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
            edges.start && !edges.end && "[mask-image:linear-gradient(90deg,#000_88%,transparent)]",
            !edges.start && edges.end && "[mask-image:linear-gradient(90deg,transparent,#000_12%)]",
          )}
        >
          {days.map((d, i) => {
            const l = LOOK[d.status];
            const active = i === index;
            return (
              <button
                key={d.key}
                ref={(el) => {
                  if (el) tiles.current.set(d.key, el);
                  else tiles.current.delete(d.key);
                }}
                type="button"
                role="option"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                aria-label={`${d.weekday} ${d.day} ${d.month}: ${t(`home.status.${d.status}`)}`}
                onClick={() => select(i, false)}
                className={cn(
                  "flex min-w-[4.75rem] snap-start flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 transition-all duration-300",
                  l.tile,
                  active ? "-translate-y-1 scale-[1.04] border-current shadow-lg" : "opacity-90 hover:-translate-y-0.5 hover:opacity-100 hover:shadow-md",
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide">{d.weekday}</span>
                <span className="text-2xl font-extrabold leading-none">{d.day}</span>
                <span className="text-[11px]">{d.month}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
                  <span className={cn("size-2 rounded-full", l.dot, active && "motion-safe:animate-pulse")} aria-hidden />
                  {t(`home.status.${d.status}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Arrow buttons for mouse users (touch screens swipe) */}
        {(["left", "right"] as const).map((side) => {
          const hidden = side === "left" ? edges.start : edges.end;
          const Icon = side === "left" ? ChevronLeft : ChevronRight;
          return (
            <button
              key={side}
              type="button"
              tabIndex={-1}
              aria-label={side === "left" ? t("home.scrollLeft") : t("home.scrollRight")}
              onClick={() => page(side === "left" ? -1 : 1)}
              className={cn(
                "absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-primary shadow-lg transition-all hover:scale-110 [@media(hover:hover)]:flex",
                side === "left" ? "-left-3" : "-right-3",
                hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/strip:opacity-100",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          );
        })}
      </div>

      <div
        key={current.key}
        aria-live="polite"
        className={cn("flex items-start gap-3 rounded-2xl border p-4 animate-in fade-in-0 slide-in-from-top-1 duration-300", look.tile)}
      >
        <look.Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold">{current.title}</p>
          <p className="text-sm">{current.detail}</p>
          {current.noticeId ? (
            <a href={`#notice-${current.noticeId}`} className="group mt-1 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
              {t("home.seeNotice")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
