"use client";

import { ArrowRight, CalendarCheck, CalendarClock, CalendarX, CircleQuestionMark, RefreshCw } from "lucide-react";
import { useState } from "react";
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

/** Tappable two-week strip: each pickup day is a coloured tile; tapping shows what happens that day. */
export function PickupStrip({ days }: { days: StripDay[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(days[0]?.key ?? "");
  const current = days.find((d) => d.key === selected) ?? days[0];
  if (!current) return null;
  const look = LOOK[current.status];

  return (
    <div className="space-y-3">
      <div role="listbox" aria-label={t("home.twoWeeks")} className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-1">
        {days.map((d) => {
          const l = LOOK[d.status];
          const active = d.key === current.key;
          return (
            <button
              key={d.key}
              type="button"
              role="option"
              aria-selected={active}
              aria-label={`${d.weekday} ${d.day} ${d.month}: ${t(`home.status.${d.status}`)}`}
              onClick={() => setSelected(d.key)}
              className={cn(
                "flex min-w-[4.75rem] snap-start flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 transition-all",
                l.tile,
                active ? "scale-[1.04] border-current shadow-md" : "opacity-90 hover:opacity-100",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide">{d.weekday}</span>
              <span className="text-2xl font-extrabold leading-none">{d.day}</span>
              <span className="text-[11px]">{d.month}</span>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
                <span className={cn("size-2 rounded-full", l.dot)} aria-hidden />
                {t(`home.status.${d.status}`)}
              </span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className={cn("flex items-start gap-3 rounded-2xl border p-4", look.tile)}>
        <look.Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold">{current.title}</p>
          <p className="text-sm">{current.detail}</p>
          {current.noticeId ? (
            <a href={`#notice-${current.noticeId}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
              {t("home.seeNotice")} <ArrowRight className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
