// Allocation = one horizontal stacked bar in a grayscale ramp (monochrome
// identity — meaning never rests on colour, every slice is labelled with value
// and %) plus a labeled breakdown list. Plain divs; a chart lib buys nothing.
// The ramp is CSS vars so it inverts correctly between light and dark.

import { Money } from "@/components/ui/money";
import { formatPct } from "@/lib/format";
import type { Bucket } from "@/lib/types";

export const BUCKET_LABELS: Record<Bucket, string> = {
  indian_equity: "Indian Equity",
  intl_equity: "Intl Equity",
  gold: "Gold",
  debt_liquid: "Debt & Liquid",
  retirement: "Retirement",
};

// grayscale ramp, mapped to per-theme CSS vars (see globals.css)
export const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

const BUCKET_RAMP: Record<Bucket, string> = {
  indian_equity: RAMP[0],
  intl_equity: RAMP[1],
  gold: RAMP[2],
  debt_liquid: RAMP[3],
  retirement: RAMP[4],
};

export function AllocationBar({ slices }: { slices: { bucket: Bucket; value: number }[] }) {
  const visible = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = visible.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="text-sm text-muted">Allocation appears once holdings have value.</p>;

  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {visible.map((s) => (
          <div
            key={s.bucket}
            style={{ width: `${(s.value / total) * 100}%`, background: BUCKET_RAMP[s.bucket] }}
            title={`${BUCKET_LABELS[s.bucket]} ${formatPct(s.value / total, false)}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {visible.map((s) => (
          <li key={s.bucket} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: BUCKET_RAMP[s.bucket] }} />
            <span className="flex-1 truncate text-ink">{BUCKET_LABELS[s.bucket]}</span>
            <span className="num w-12 text-right text-muted">{formatPct(s.value / total, false)}</span>
            <Money value={s.value} compact className="w-16 text-right text-ink-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
