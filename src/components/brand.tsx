import { Recycle } from "lucide-react";
import Link from "next/link";

export function Brand({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2 font-semibold">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Recycle className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 truncate">
        CivicAI <span className="text-primary">Mysuru</span>
        {subtitle ? <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
