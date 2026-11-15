import { Leaf, Recycle, Sprout } from "lucide-react";

const ICONS = [Leaf, Recycle, Sprout];

/** Endless ribbon of short promises. Pauses on hover; stands still for reduced motion. */
export function Marquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => {
        const Icon = ICONS[i % ICONS.length]!;
        return (
          <li key={item} className="flex items-center gap-6 px-6 text-sm font-bold uppercase tracking-[0.18em] sm:text-base">
            {item}
            <Icon className="size-5 text-primary transition-transform duration-500 hover:rotate-180" aria-hidden />
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="relative overflow-hidden border-y border-primary/10 bg-lime-200/40 py-4 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="marquee">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
