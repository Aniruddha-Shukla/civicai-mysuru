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
    <nav aria-label="Operator" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
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
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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
