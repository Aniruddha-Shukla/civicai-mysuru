"use client";

import { ClipboardList, LayoutDashboard, ListChecks, Plus, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/operator", label: "Overview", hint: "Today's work at a glance", icon: LayoutDashboard, exact: true, badge: "awaiting" as const },
  { href: "/operator/events", label: "Notices", hint: "Every disruption notice", icon: ListChecks, exact: true },
  { href: "/operator/events/new", label: "New notice", hint: "Enter an official notice", icon: Plus, exact: true },
  { href: "/operator/complaints", label: "Complaints", hint: "Reports from citizens", icon: ClipboardList, exact: false, badge: "complaints" as const },
  { href: "/operator/audit-log", label: "Audit log", hint: "Every action, recorded", icon: ScrollText, exact: false },
];

function isActive(item: (typeof ITEMS)[number], pathname: string) {
  return item.exact
    ? pathname === item.href || (item.href === "/operator/events" && /^\/operator\/events\/(?!new)/.test(pathname))
    : pathname.startsWith(item.href);
}

/**
 * Operator navigation, matching the citizen app: a sidebar with one-line hints on laptops,
 * a horizontal dock row on smaller screens. A lime pill slides to the current page.
 */
export function OperatorNav({
  variant = "top",
  counts = { awaiting: 0, complaints: 0 },
}: {
  variant?: "top" | "side";
  counts?: { awaiting: number; complaints: number };
}) {
  const pathname = usePathname();
  const activeIndex = ITEMS.findIndex((item) => isActive(item, pathname));
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number; top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = links.current[activeIndex];
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, variant]);

  const badge = (key?: "awaiting" | "complaints") => {
    const n = key ? counts[key] : 0;
    return n > 0 ? (
      <span className="min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white ring-2 ring-emerald-950">{n}</span>
    ) : null;
  };

  if (variant === "side") {
    return (
      <nav aria-label="Operator" className="relative flex flex-col gap-1">
        {pill ? (
          <span
            aria-hidden
            className="absolute inset-x-0 rounded-2xl bg-lime-300 shadow-lg shadow-lime-300/20 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ top: pill.top, height: pill.height }}
          />
        ) : null}
        {ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={item.href}
              ref={(el) => {
                links.current[i] = el;
              }}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl p-2.5 transition-colors duration-300",
                active ? "text-emerald-950" : "text-white/75 hover:bg-white/5 hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105",
                  active ? "bg-emerald-950/10" : "bg-white/5 group-hover:bg-white/10",
                )}
              >
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold">
                  {item.label}
                  {badge(item.badge)}
                </span>
                <span className={cn("block truncate text-xs", active ? "text-emerald-900/80" : "text-white/50")}>{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Operator" className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {pill ? (
        <span
          aria-hidden
          className="absolute rounded-full bg-lime-300 shadow-lg shadow-lime-300/20 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ left: pill.left, width: pill.width, top: pill.top, height: pill.height }}
        />
      ) : null}
      {ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <Link
            key={item.href}
            ref={(el) => {
              links.current[i] = el;
            }}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300",
              active ? "text-emerald-950" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
            {badge(item.badge)}
          </Link>
        );
      })}
    </nav>
  );
}
