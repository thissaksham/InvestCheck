// Allocation = one horizontal stacked bar in a warm gold→earth ramp (§3.6:
// single-hue discipline, on-brand for Almanac) with a labeled breakdown list
// below. Plain divs; a chart lib buys nothing at one bar.

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

// warm sequential ramp, gold → deep earth. Distinguishable, on-brand, and clear
// of gain-green / loss-red. Meaning never rests on colour alone — every slice is
// labelled with its value and %.
const RAMP: Record<Bucket, string> = {
  indian_equity: "#e6b24d",
  intl_equity: "#cf9440",
  gold: "#b87333",
  debt_liquid: "#8f6f5a",
  retirement: "#6d6f86",
};

// generic warm ramp for other stacked bars (e.g. NPS schemes)
export const WARM_RAMP = ["#e6b24d", "#b87333", "#6d6f86", "#8f6f5a", "#cf9440"];

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
            style={{ width: `${(s.value / total) * 100}%`, background: RAMP[s.bucket] }}
            title={`${BUCKET_LABELS[s.bucket]} ${formatPct(s.value / total, false)}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {visible.map((s) => (
          <li key={s.bucket} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: RAMP[s.bucket] }} />
            <span className="flex-1 truncate text-ink">{BUCKET_LABELS[s.bucket]}</span>
            <span className="num w-12 text-right text-muted">{formatPct(s.value / total, false)}</span>
            <Money value={s.value} compact className="w-16 text-right text-ink-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
