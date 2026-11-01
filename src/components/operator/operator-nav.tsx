"use client";

import { ClipboardList, LayoutDashboard, ListChecks, Plus, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/operator", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/operator/events", label: "Notices", icon: ListChecks, exact: true },
  { href: "/operator/events/new", label: "New notice", icon: Plus, exact: true },
  { href: "/operator/complaints", label: "Complaints", icon: ClipboardList, exact: false },
  { href: "/operator/audit-log", label: "Audit log", icon: ScrollText, exact: false },
];

export function OperatorNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Operator" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href || (item.href === "/operator/events" && /^\/operator\/events\/(?!new)/.test(pathname))
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
              active ? "bg-secondary text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
