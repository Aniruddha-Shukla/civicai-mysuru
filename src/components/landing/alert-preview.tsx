"use client";

import { BellRing, CalendarCheck, CalendarClock, CalendarX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PreviewState {
  key: "normal" | "moved" | "none";
  label: string;
  pill: string;
  title: string;
  struck?: string;
  sub: string;
  /** Exact alert wording produced by the real notification templates (paper Case A / Case B). */
  message?: string;
}

const LOOK = {
  normal: { card: "bg-hero", Icon: CalendarCheck, dot: "bg-violet-500" },
  moved: { card: "bg-gradient-to-br from-amber-500 to-orange-600", Icon: CalendarClock, dot: "bg-amber-500" },
  none: { card: "bg-gradient-to-br from-rose-600 to-red-700", Icon: CalendarX, dot: "bg-rose-500" },
} as const;

/**
 * "Try it before you sign in": pick a situation and the phone shows exactly what a resident sees.
 * Cycles on its own until someone interacts (never for reduced-motion users).
 */
export function AlertPreview({ states, example, appName }: { states: PreviewState[]; example: string; appName: string }) {
  const [index, setIndex] = useState(1);
  const [auto, setAuto] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % states.length), 4500);
    return () => window.clearInterval(id);
  }, [auto, states.length]);

  const choose = (i: number, focus = false) => {
    setAuto(false);
    setIndex(i);
    if (focus) tabs.current[i]?.focus();
  };
  const state = states[index]!;
  const look = LOOK[state.key];

  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]" onPointerEnter={() => setAuto(false)}>
      <div
        role="tablist"
        aria-label={example}
        className="flex flex-col gap-2"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") choose((index + 1) % states.length, true);
          else if (e.key === "ArrowUp" || e.key === "ArrowLeft") choose((index - 1 + states.length) % states.length, true);
          else return;
          e.preventDefault();
        }}
      >
        {states.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`preview-tab-${s.key}`}
              aria-selected={active}
              aria-controls="preview-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => choose(i)}
              data-spotlight
              className={cn(
                "spotlight group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all",
                active ? "border-primary/40 shadow-soft" : "border-transparent bg-card/60 hover:bg-card",
              )}
            >
              <span className={cn("size-3 shrink-0 rounded-full transition-transform", LOOK[s.key].dot, active && "scale-125")} aria-hidden />
              <span className="flex-1 font-semibold">{s.label}</span>
              {/* progress bar while the preview is cycling by itself */}
              {active && auto ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-[grow_4.5s_linear] bg-primary motion-reduce:hidden" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Phone */}
      <div className="mx-auto w-[17.5rem] rounded-[2.6rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl shadow-primary/30" data-tilt="8">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-background">
          <span className="glare z-10" aria-hidden />
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-slate-900" aria-hidden />
          <div id="preview-panel" role="tabpanel" aria-labelledby={`preview-tab-${state.key}`} aria-live="polite" className="space-y-3 p-3 pb-6">
            {state.message ? (
              <div key={`msg-${state.key}`} className="animate-in fade-in-0 slide-in-from-top-4 duration-500 rounded-2xl bg-card/95 p-3 text-[11px] leading-snug shadow-lg ring-1 ring-black/5">
                <p className="mb-1 flex items-center gap-1.5 font-bold text-primary">
                  <BellRing className="size-3.5" aria-hidden /> {appName}
                </p>
                <p className="text-foreground/90">{state.message}</p>
              </div>
            ) : null}
            <div key={`card-${state.key}`} className={cn("animate-in fade-in-0 zoom-in-95 duration-500 rounded-3xl p-4 text-white shadow-lg", look.card)}>
              <div className="flex items-center justify-between gap-2">
                <look.Icon className="size-6" aria-hidden />
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold">{state.pill}</span>
              </div>
              {state.struck ? <p className="mt-3 text-sm font-semibold line-through opacity-80">{state.struck}</p> : null}
              <p className={cn("text-xl font-extrabold leading-tight", !state.struck && "mt-3")}>{state.title}</p>
              <p className="mt-1 text-xs opacity-90">{state.sub}</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn("h-12 rounded-xl border-2", i === 0 ? "border-current opacity-90" : "opacity-40", state.key === "normal" ? "border-violet-300 bg-violet-50" : state.key === "moved" ? "border-amber-300 bg-amber-50" : "border-rose-300 bg-rose-50")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
