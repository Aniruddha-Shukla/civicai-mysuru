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
export function CitizenNav({ unread, variant }: { unread: number; variant: "top" | "bottom" }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: t("nav.home"), icon: House },
    { href: "/notifications", label: t("nav.alerts"), icon: Bell, badge: unread },
    { href: "/ask", label: t("nav.ask"), icon: MessageCircleQuestionMark },
    { href: "/report", label: t("nav.report"), icon: Megaphone },
  ];
  const activeIndex = items.findIndex((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  // Measure the active link so the pill can glide to it.
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = links.current[activeIndex];
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, variant]);

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="relative hidden items-center gap-1 rounded-full bg-white/5 p-1 md:flex">
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
