import { Recycle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", subtitle, light = false }: { href?: string; subtitle?: string; light?: boolean }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-2.5 font-extrabold tracking-tight">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-105",
          light ? "bg-lime-300 text-emerald-950 shadow-lime-300/30" : "bg-hero text-lime-300 shadow-primary/30",
        )}
      >
        <Recycle className="size-5 transition-transform duration-700 group-hover:rotate-[360deg]" aria-hidden />
      </span>
      <span className={cn("min-w-0 truncate text-lg", light && "text-white")}>
        CivicAI <span className={light ? "text-lime-300" : "text-primary"}>Mysuru</span>
        {subtitle ? (
          <span className={cn("ml-2 hidden text-xs font-medium sm:inline", light ? "text-white/70" : "text-muted-foreground")}>{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
