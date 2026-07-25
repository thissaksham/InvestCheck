import { cn } from "@/lib/utils";

// A horizontal strip of label→value stats, hairline-divided. Replaces the
// row-of-boxed-tiles cliché: reads as one composed line, not four cards.
// Mobile: 2-col grid. sm+: equal-width flex columns split by vertical rules.
export function StatRail({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:gap-0 sm:divide-x sm:divide-hairline",
        className
      )}
    >
      {items.map((it, i) => (
        <div key={i} className={cn("sm:flex-1 sm:px-5", i === 0 && "sm:pl-0")}>
          <div className="eyebrow">{it.label}</div>
          <div className="num mt-1.5 text-[19px] font-medium tracking-tight text-ink-2">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
