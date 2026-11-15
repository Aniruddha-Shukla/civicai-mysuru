import { Recycle } from "lucide-react";
import { SweepLine } from "@/components/motion/eco";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a page loads: a turning recycle badge and a broom tidying up, then the page outline. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col items-center gap-2 py-6">
        <span className="bg-hero flex size-14 items-center justify-center rounded-2xl text-lime-300 shadow-lg shadow-primary/30">
          <Recycle className="size-7 motion-safe:animate-spin [animation-duration:2.4s]" aria-hidden />
        </span>
        <SweepLine className="w-56 text-primary" />
      </div>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-48 w-full rounded-3xl" />
      <Skeleton className="h-32 w-full rounded-3xl" />
    </div>
  );
}
