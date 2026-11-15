import type { LucideIcon } from "lucide-react";
import { Leaf, Recycle } from "lucide-react";
import { TruckLane } from "@/components/motion/eco";
import { cn } from "@/lib/utils";

/** A small glass chip for facts shown in a page banner (counts, dates, promises). */
export function HeroChip({ icon: Icon, children, strong = false }: { icon?: LucideIcon; children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        strong ? "bg-lime-300 text-emerald-950 shadow-lg shadow-lime-300/20" : "bg-white/10 text-white ring-1 ring-white/15",
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * Themed banner at the top of each citizen page: dark forest panel, a floating 3D icon tile,
 * drifting leaves and a truck on its round — plus a row of live details.
 */
export function PageHero({
  icon: Icon,
  kicker,
  title,
  subtitle,
  children,
  aside,
}: {
  icon: LucideIcon;
  kicker?: string;
  title: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section
      data-parallax
      className="bg-hero grain relative mb-6 overflow-hidden rounded-[2rem] p-5 text-white shadow-xl shadow-primary/20 sm:p-7"
    >
      {/* decoration */}
      <div className="pointer-events-none absolute inset-0 [perspective:900px]" aria-hidden>
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="plx absolute right-[22%] top-4 hidden sm:block" style={{ "--d": 22 } as React.CSSProperties}>
          <Leaf className="eco-float size-5 text-lime-300/60" style={{ "--r": "20deg" } as React.CSSProperties} />
        </div>
        <div className="plx absolute bottom-8 right-[38%] hidden sm:block" style={{ "--d": 14 } as React.CSSProperties}>
          <Recycle className="eco-float size-4 text-white/30 [animation-delay:-3s]" style={{ "--r": "-15deg" } as React.CSSProperties} />
        </div>
      </div>
      <TruckLane className="bottom-1 text-white/15" />

      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-300">{kicker}</p> : null}
          <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">{subtitle}</p> : null}
          {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
        </div>
        <div className="plx hidden shrink-0 sm:block" style={{ "--d": 10 } as React.CSSProperties}>
          <div
            className="eco-float flex size-20 items-center justify-center rounded-3xl bg-white/10 text-lime-300 shadow-2xl shadow-black/20 ring-1 ring-white/20 backdrop-blur-md"
            style={{ "--r": "-8deg" } as React.CSSProperties}
          >
            <Icon className="size-10" aria-hidden />
          </div>
        </div>
      </div>
      {aside ? <div className="relative mt-4">{aside}</div> : null}
    </section>
  );
}
