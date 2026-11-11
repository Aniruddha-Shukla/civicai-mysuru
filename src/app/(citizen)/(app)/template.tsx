"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Pages that use the full width on big screens; everything else (forms, lists) keeps a comfortable reading width. */
const WIDE = new Set(["/dashboard"]);

/** Re-mounts on every navigation, so each page glides in instead of popping. */
export default function Template({ children }: { children: React.ReactNode }) {
  const wide = WIDE.has(usePathname());
  return (
    <div className={cn("animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out motion-reduce:animate-none", !wide && "mx-auto max-w-3xl")}>
      {children}
    </div>
  );
}
