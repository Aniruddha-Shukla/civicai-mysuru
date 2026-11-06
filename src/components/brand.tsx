import { Recycle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", subtitle, light = false }: { href?: string; subtitle?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2.5 font-bold">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
          light ? "bg-white/20 ring-1 ring-white/30" : "bg-hero shadow-primary/30",
        )}
      >
        <Recycle className="size-5" aria-hidden />
      </span>
      <span className={cn("min-w-0 truncate text-lg", light && "text-white")}>
        CivicAI <span className={light ? "text-violet-200" : "text-primary"}>Mysuru</span>
        {subtitle ? (
          <span className={cn("ml-2 hidden text-xs font-medium sm:inline", light ? "text-white/70" : "text-muted-foreground")}>{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
