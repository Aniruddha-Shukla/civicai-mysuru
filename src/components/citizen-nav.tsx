"use client";

import { Bell, House, Megaphone, MessageCircleQuestionMark } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white ring-2 ring-emerald-950 motion-safe:animate-in motion-safe:zoom-in-50",
        className,
      )}
    >
      {count}
    </span>
  );
}

/**
 * Citizen navigation as a dark floating dock with a lime pill that slides to the current page.
 * "top" sits in the header on wide screens; "bottom" is the thumb-friendly dock on phones.
 */
export function CitizenNav({ unread, variant }: { unread: number; variant: "top" | "bottom" | "side" }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: t("nav.home"), hint: t("nav.homeHint"), icon: House },
    { href: "/notifications", label: t("nav.alerts"), hint: t("nav.alertsHint"), icon: Bell, badge: unread },
    { href: "/ask", label: t("nav.ask"), hint: t("nav.askHint"), icon: MessageCircleQuestionMark },
    { href: "/report", label: t("nav.report"), hint: t("nav.reportHint"), icon: Megaphone },
  ];
  const activeIndex = items.findIndex((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  // Measure the active link so the pill can glide to it.
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

  if (variant === "side") {
    return (
      <nav aria-label="Main" className="relative flex flex-col gap-1">
        {pill ? (
          <span
            aria-hidden
            className="absolute inset-x-0 rounded-2xl bg-lime-300 shadow-lg shadow-lime-300/20 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ top: pill.top, height: pill.height }}
          />
        ) : null}
        {items.map((item, i) => {
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
                  {item.badge ? <Badge count={item.badge} /> : null}
                </span>
                <span className={cn("block truncate text-xs", active ? "text-emerald-900/80" : "text-white/50")}>{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="relative hidden items-center gap-1 rounded-full bg-white/5 p-1 md:flex lg:hidden">
        {pill ? (
          <span
            aria-hidden
            className="absolute inset-y-1 rounded-full bg-lime-300 shadow-lg shadow-lime-300/25 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ left: pill.left, width: pill.width }}
          />
        ) : null}
        {items.map((item, i) => {
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
                "relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300",
                active ? "text-emerald-950" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.badge ? <Badge count={item.badge} /> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 z-40 rounded-[1.75rem] border border-white/10 bg-emerald-950/95 p-1.5 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <ul className="relative grid grid-cols-4">
        {pill ? (
          <span
            aria-hidden
            className="absolute inset-y-0 rounded-[1.35rem] bg-lime-300 shadow-lg shadow-lime-300/25 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ left: pill.left, width: pill.width }}
          />
        ) : null}
        {items.map((item, i) => {
          const active = i === activeIndex;
          return (
            <li key={item.href}>
              <Link
                ref={(el) => {
                  links.current[i] = el;
                }}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-[1.35rem] py-2 text-xs font-semibold transition-colors duration-300 active:scale-95",
                  active ? "text-emerald-950" : "text-white/70",
                )}
              >
                <item.icon className={cn("size-5 transition-transform duration-300", active && "-translate-y-0.5 scale-110")} aria-hidden />
                {item.label}
                {item.badge ? <Badge count={item.badge} className="absolute right-[calc(50%-1.6rem)] top-0.5" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
