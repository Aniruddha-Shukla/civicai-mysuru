import { Recycle } from "lucide-react";
import { SweepLine } from "@/components/motion/eco";
import { Skeleton } from "@/components/ui/skeleton";

export default function OperatorLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="bg-hero flex size-12 items-center justify-center rounded-2xl text-lime-300 shadow-lg shadow-primary/30">
          <Recycle className="size-6 motion-safe:animate-spin [animation-duration:2.4s]" aria-hidden />
        </span>
        <SweepLine className="w-48 text-primary" />
      </div>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}
