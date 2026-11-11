"use client";

import { Bell, House, Megaphone, MessageCircleQuestionMark } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

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

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.badge ? <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_hsl(252_62%_40%/0.25)] backdrop-blur-md md:hidden">
      <ul className="relative grid grid-cols-4">
        {/* One pill that slides to the current page */}
        {activeIndex >= 0 ? (
          <span
            aria-hidden
            className="absolute top-2 h-8 w-14 rounded-full bg-primary shadow-md shadow-primary/30 transition-[left] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ left: `calc(${activeIndex * 25 + 12.5}% - 1.75rem)` }}
          />
        ) : null}
        {items.map((item, i) => {
          const active = i === activeIndex;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex flex-col items-center gap-1 py-2 text-xs font-semibold transition-colors active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-300",
                    active ? "text-primary-foreground" : "group-active:bg-accent",
                  )}
                >
                  <item.icon className={cn("size-5 transition-transform duration-300", active && "scale-110")} aria-hidden />
                </span>
                {item.label}
                {item.badge ? (
                  <span className="absolute right-[calc(50%-1.75rem)] top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-white motion-safe:animate-in motion-safe:zoom-in-50">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
