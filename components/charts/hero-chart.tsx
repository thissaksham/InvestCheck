"use client";

// The signature element (§3.1): portfolio history with the current value set
// inside it. Single-hue discipline, dashed baseline at invested (§3.6).

import { useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { Money, Pct } from "@/components/ui/money";
import { formatCompactINR, formatDate } from "@/lib/format";
import { fyStart } from "@/lib/fy";
import { cn } from "@/lib/utils";

const RANGES = ["1M", "3M", "1Y", "FY", "All"] as const;
type Range = (typeof RANGES)[number];

export function HeroChart({
  snapshots,
  investedNow,
  currentValue,
  delta,
}: {
  snapshots: { date: string; value: number }[];
  investedNow: number;
  currentValue: number;
  delta: { abs: number; pct: number } | null;
}) {
  const [range, setRange] = useState<Range>("All");

  // How many days of history exist. A range shorter than that would show the
  // same points as "All", so offering it just looks broken — hide those.
  const spanDays = useMemo(() => {
    if (snapshots.length < 2) return 0;
    const first = Date.parse(`${snapshots[0].date}T00:00:00Z`);
    const last = Date.parse(`${snapshots[snapshots.length - 1].date}T00:00:00Z`);
    return Math.round((last - first) / 86400000);
  }, [snapshots]);

  const WINDOW: Record<Exclude<Range, "All" | "FY">, number> = { "1M": 30, "3M": 91, "1Y": 365 };
  const availableRanges = useMemo(
    () =>
      RANGES.filter((r) => {
        if (r === "All") return true;
        if (r === "FY") return spanDays > 25;
        return spanDays > WINDOW[r];
      }),
    [spanDays]
  );

  const data = useMemo(() => {
    if (range === "All") return snapshots;
    const now = new Date();
    const cutoff =
      range === "FY"
        ? fyStart(now)
        : new Date(now.getTime() - WINDOW[range as Exclude<Range, "All" | "FY">] * 86400000)
            .toISOString()
            .slice(0, 10);
    return snapshots.filter((s) => s.date >= cutoff);
  }, [snapshots, range]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Portfolio value</div>
          <div className="num mt-1 text-[32px] font-medium leading-tight sm:text-[40px]">
            <AnimatedMoney value={currentValue} />
          </div>
          {delta && (
            <span
              className={cn(
                "num mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
                delta.abs >= 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
              )}
            >
              <Money value={delta.abs} signed compact className="text-inherit" />
              <span>·</span>
              <Pct value={delta.pct} className="text-inherit" />
              <span className="font-normal opacity-80">today</span>
            </span>
          )}
        </div>
        {availableRanges.length > 1 && (
          <div className="flex gap-1">
            {availableRanges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "num rounded-full px-2.5 py-1 text-[12px]",
                  range === r ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* one state at a time: message until there's a line to draw, then the chart */}
      <div className="mt-4 h-56 sm:h-64">
        {snapshots.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-(--radius-field) border border-dashed border-hairline px-4 text-center">
            <p className="text-sm text-muted">
              History starts now. Come back tomorrow — a snapshot is saved every night.
            </p>
          </div>
        ) : (
          <MiniChart data={data} investedNow={investedNow} full />
        )}
      </div>
      {snapshots.length >= 2 && snapshots.length < 7 && (
        <p className="mt-1.5 text-center text-[11px] text-muted">
          {snapshots.length} days of history so far — a snapshot is saved every night.
        </p>
      )}
    </div>
  );
}

function MiniChart({
  data,
  investedNow,
  full,
}: {
  data: { date: string; value: number }[];
  investedNow: number;
  full?: boolean;
}) {
  if (data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={full ? "100%" : 80}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="date"
          hide={!full}
          tickFormatter={(d: string) => formatDate(d).slice(0, 6)}
          tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--font-plex)" }}
          axisLine={{ stroke: "var(--hairline)" }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis hide domain={["auto", "auto"]} />
        {investedNow > 0 && (
          <ReferenceLine
            y={investedNow}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            ifOverflow="extendDomain"
          />
        )}
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--hairline)" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill="var(--accent)"
          fillOpacity={0.08}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-(--radius-field) border border-hairline bg-surface px-3 py-2">
      <div className="text-[11px] text-muted">{formatDate(label)}</div>
      <div className="num text-[13px] font-medium">{formatCompactINR(payload[0].value)}</div>
    </div>
  );
}
