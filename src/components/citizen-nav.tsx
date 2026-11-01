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
                "relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                active ? "bg-secondary text-primary" : "text-muted-foreground",
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
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
                {item.badge ? (
                  <span className="absolute right-[calc(50%-1.25rem)] top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-white">
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
