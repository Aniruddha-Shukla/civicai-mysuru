import { Sparkle } from "lucide-react";

/** Endless ribbon of short promises. Pauses on hover; stands still for reduced motion. */
export function Marquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-6 px-6 text-sm font-semibold uppercase tracking-[0.18em] sm:text-base">
          {item}
          <Sparkle className="size-4 fill-current text-primary" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden border-y border-primary/10 bg-card/70 py-4 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="marquee">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
