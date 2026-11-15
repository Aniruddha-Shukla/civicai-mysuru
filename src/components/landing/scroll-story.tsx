"use client";

import { useEffect, useRef, useState } from "react";
import { AlertPreview, Phone, type PreviewState } from "@/components/landing/alert-preview";
import { cn } from "@/lib/utils";

const DOT = { normal: "bg-violet-500", moved: "bg-amber-500", none: "bg-rose-500" } as const;
const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Scroll-driven story: the section pins to the screen while you scroll, the phone swings round
 * in 3D and its screen steps through the situations. Each step can also be tapped to jump to it.
 * People who prefer reduced motion get the plain tap-to-switch preview instead.
 */
export function ScrollStory({
  states,
  details,
  title,
  hint,
  example,
  appName,
}: {
  states: PreviewState[];
  details: string[];
  title: string;
  hint: string;
  example: string;
  appName: string;
}) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  const n = states.length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el || !stage.current) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp(-r.top / Math.max(1, r.height - vh));
      // continuous values go straight to CSS (no re-render per frame)
      stage.current.style.setProperty("--e", clamp((vh - r.top) / vh).toFixed(4));
      stage.current.style.setProperty("--s", progress.toFixed(4));
      setActive(Math.min(n - 1, Math.floor(progress * n)));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [n]);

  if (still) {
    return (
      <section className="container max-w-4xl py-16">
        <h2 className="mb-6 text-center text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <AlertPreview states={states} example={example} appName={appName} />
      </section>
    );
  }

  const jumpTo = (i: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / n) * travel, behavior: "smooth" });
  };

  return (
    <section ref={section} aria-labelledby="story-heading" className="relative" style={{ height: `${n * 90 + 60}vh` }}>
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div
          ref={stage}
          className="container grid max-w-5xl items-center gap-4 md:grid-cols-2 md:gap-14"
          style={{ "--e": 1, "--s": 0 } as React.CSSProperties}
        >
          <div className="order-2 md:order-1">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:block">{hint}</p>
            <h2 id="story-heading" className="text-xl font-extrabold tracking-tight sm:mt-2 sm:text-4xl">
              {title}
            </h2>

            <div className="relative mt-3 pl-5 md:mt-8">
              {/* progress rail */}
              <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-secondary" aria-hidden />
              <span
                className="absolute left-0 top-1 w-1 origin-top rounded-full bg-gradient-to-b from-violet-500 via-amber-500 to-rose-500"
                style={{ height: "calc(100% - 0.5rem)", transform: "scaleY(var(--s))" }}
                aria-hidden
              />
              <ol className="space-y-1 sm:space-y-2">
                {states.map((s, i) => {
                  const on = i === active;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => jumpTo(i)}
                        aria-current={on ? "step" : undefined}
                        className={cn(
                          "w-full rounded-2xl px-3 py-2 text-left transition-all duration-500 sm:p-3 md:p-4",
                          on ? "bg-card shadow-soft ring-1 ring-primary/15" : "opacity-45 hover:opacity-80",
                        )}
                      >
                        <span className="flex items-center gap-2.5 font-bold md:text-lg">
                          <span className={cn("size-3 shrink-0 rounded-full transition-transform", DOT[s.key], on && "scale-125")} aria-hidden />
                          {s.label}
                        </span>
                        <span
                          className={cn(
                            "grid transition-all duration-500",
                            on ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                          )}
                        >
                          <span className="overflow-hidden text-sm text-muted-foreground">{details[i]}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="order-1 flex justify-center [perspective:1400px] md:order-2">
            <div
              className="relative transition-transform duration-300 ease-out [transform-style:preserve-3d]"
              style={{
                transform:
                  "rotateY(calc((1 - var(--e)) * -55deg + (var(--s) - 0.5) * 18deg)) rotateX(calc((1 - var(--e)) * 22deg)) translateZ(calc(var(--e) * 20px))",
              }}
            >
              <Phone state={states[active]!} appName={appName} tilt={false} className="w-[12.5rem] sm:w-[17.5rem]" />
              <span className="absolute -bottom-6 left-1/2 h-6 w-3/4 -translate-x-1/2 rounded-full bg-primary/25 blur-xl" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
