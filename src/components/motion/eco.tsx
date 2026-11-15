import { BrushCleaning, CupSoda, Leaf, Milk, Newspaper, Recycle, Sparkles, Sprout, Trash, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type Floater = {
  Icon: typeof Leaf;
  /** position in % of the parent */
  top: number;
  left: number;
  /** parallax depth (inside a [data-parallax] parent) */
  depth: number;
  rotate: number;
  delay: number;
  size: "sm" | "md" | "lg";
  tint: string;
  /** hide on small screens to keep phones calm */
  wideOnly?: boolean;
};

const FLOATERS: Floater[] = [
  { Icon: Recycle, top: 8, left: 6, depth: 26, rotate: -14, delay: 0, size: "lg", tint: "text-lime-300" },
  { Icon: Leaf, top: 70, left: 4, depth: 34, rotate: 18, delay: -2, size: "md", tint: "text-emerald-200" },
  { Icon: Trash, top: 18, left: 88, depth: 30, rotate: 12, delay: -4, size: "md", tint: "text-teal-200" },
  { Icon: Milk, top: 78, left: 90, depth: 22, rotate: -20, delay: -1, size: "sm", tint: "text-sky-200", wideOnly: true },
  { Icon: Newspaper, top: 46, left: 94, depth: 18, rotate: 8, delay: -3, size: "sm", tint: "text-amber-100", wideOnly: true },
  { Icon: CupSoda, top: 88, left: 30, depth: 14, rotate: -8, delay: -5, size: "sm", tint: "text-rose-200", wideOnly: true },
  { Icon: Sprout, top: 4, left: 46, depth: 20, rotate: 6, delay: -2.5, size: "sm", tint: "text-lime-200", wideOnly: true },
  { Icon: Sparkles, top: 40, left: 2, depth: 40, rotate: 0, delay: -3.5, size: "sm", tint: "text-yellow-200", wideOnly: true },
];

const SIZE = { sm: "size-11 rounded-xl [&_svg]:size-5", md: "size-14 rounded-2xl [&_svg]:size-6", lg: "size-16 rounded-2xl [&_svg]:size-8" };

/**
 * Floating 3D "clean city" objects (recycling badge, leaf, bin, bottle, newspaper…) drifting
 * around a dark hero. Each tile bobs and turns in 3D and shifts with the pointer for depth.
 */
export function EcoFloaters({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 [perspective:900px]", className)} aria-hidden>
      {FLOATERS.map((f, i) => (
        <div
          key={i}
          className={cn("plx absolute", f.wideOnly && "hidden md:block")}
          style={{ top: `${f.top}%`, left: `${f.left}%`, "--d": f.depth } as React.CSSProperties}
        >
          <div
            className={cn(
              "eco-float flex items-center justify-center bg-white/10 shadow-xl shadow-black/20 ring-1 ring-white/20 backdrop-blur-md",
              SIZE[f.size],
              f.tint,
            )}
            style={{ "--r": `${f.rotate}deg`, animationDelay: `${f.delay}s` } as React.CSSProperties}
          >
            <f.Icon aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Litter positions along the sweep line (in % of its width). */
const LITTER = [
  { at: 18, Icon: Leaf, cls: "text-lime-300" },
  { at: 38, Icon: Newspaper, cls: "text-amber-100" },
  { at: 58, Icon: CupSoda, cls: "text-rose-200" },
  { at: 78, Icon: Leaf, cls: "text-emerald-200" },
];
const SWEEP = 5; // seconds per sweep
/** Shift each piece's cycle so it is pushed away exactly when the broom reaches it. */
const contactDelay = (at: number, contactAt: number) => `${(((at + 10) / 120 - contactAt) * SWEEP - SWEEP).toFixed(2)}s`;

/** A broom sweeps across, pushing litter off and leaving sparkles behind. */
export function SweepLine({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-10 overflow-hidden", className)} aria-hidden>
      <span className="absolute inset-x-0 bottom-1.5 h-px bg-current opacity-20" />
      {LITTER.map(({ at, Icon, cls }) => (
        <span key={at} className="absolute bottom-2" style={{ left: `${at}%` }}>
          <Icon className={cn("sweep-litter size-4", cls)} style={{ animationDelay: contactDelay(at, 0.3) }} />
          <Sparkles className="sweep-spark absolute left-0 top-0 size-4 text-yellow-200" style={{ animationDelay: contactDelay(at, 0.5) }} />
        </span>
      ))}
      <BrushCleaning className="sweep-broom absolute bottom-1 size-7 text-lime-300" />
    </div>
  );
}

/** Small truck that drives along the bottom edge of a card. */
export function TruckLane({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 h-7 overflow-hidden", className)} aria-hidden>
      <Truck className="truck-lane absolute bottom-0 size-6" />
    </div>
  );
}
