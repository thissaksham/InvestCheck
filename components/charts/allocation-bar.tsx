// Allocation = one horizontal stacked bar, navy→teal ramp — not a donut (§3.6).
// Plain divs; a chart lib buys nothing at one bar.

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

const RAMP: Record<Bucket, string> = {
  indian_equity: "#0F2C3F",
  intl_equity: "#14485C",
  gold: "#136370",
  debt_liquid: "#0F7E7E",
  retirement: "#0E9488",
};

export function AllocationBar({ slices }: { slices: { bucket: Bucket; value: number }[] }) {
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="text-sm text-muted">Allocation appears once holdings have value.</p>;

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {visible.map((s) => (
          <div
            key={s.bucket}
            style={{ width: `${(s.value / total) * 100}%`, background: RAMP[s.bucket] }}
            title={`${BUCKET_LABELS[s.bucket]} ${formatPct(s.value / total, false)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {visible.map((s) => (
          <span key={s.bucket} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RAMP[s.bucket] }} />
            {BUCKET_LABELS[s.bucket]}
            <Money value={s.value} compact className="text-ink" />
            <span className="num">{formatPct(s.value / total, false)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
