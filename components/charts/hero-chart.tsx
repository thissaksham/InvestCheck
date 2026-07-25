"use client";

// The signature element (§3.1): portfolio history with the current value set
// inside it. Two series — what it's worth, and what you put in — so the gap
// between them is the gain, readable at a glance. Single-hue discipline (§3.6).

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { Money, Pct } from "@/components/ui/money";
import { formatCompactINR, formatDate } from "@/lib/format";
import { fyStart } from "@/lib/fy";
import { cn } from "@/lib/utils";

const RANGES = ["1M", "3M", "1Y", "FY", "All"] as const;
type Range = (typeof RANGES)[number];
const WINDOW: Record<"1M" | "3M" | "1Y", number> = { "1M": 30, "3M": 91, "1Y": 365 };

export interface HeroPoint {
  date: string;
  value: number;
  invested: number;
}

export function HeroChart({
  snapshots,
  currentValue,
  delta,
}: {
  snapshots: HeroPoint[];
  currentValue: number;
  delta: { abs: number; pct: number } | null;
}) {
  const [range, setRange] = useState<Range>("All");

  const spanDays = useMemo(() => {
    if (snapshots.length < 2) return 0;
    const a = Date.parse(`${snapshots[0].date}T00:00:00Z`);
    const b = Date.parse(`${snapshots[snapshots.length - 1].date}T00:00:00Z`);
    return Math.round((b - a) / 86400000);
  }, [snapshots]);

  // a window shorter than the history we have would just repeat "All"
  const available = useMemo(
    () => RANGES.filter((r) => (r === "All" ? true : r === "FY" ? spanDays > 25 : spanDays > WINDOW[r])),
    [spanDays]
  );

  const data = useMemo(() => {
    let rows = snapshots;
    if (range !== "All") {
      const now = new Date();
      const cutoff =
        range === "FY"
          ? fyStart(now)
          : new Date(now.getTime() - WINDOW[range] * 86400000).toISOString().slice(0, 10);
      rows = snapshots.filter((s) => s.date >= cutoff);
    }
    // keep the line smooth without handing recharts thousands of points
    if (rows.length > 420) {
      const step = Math.ceil(rows.length / 420);
      const thinned = rows.filter((_, i) => i % step === 0);
      if (thinned[thinned.length - 1] !== rows[rows.length - 1]) thinned.push(rows[rows.length - 1]);
      return thinned;
    }
    return rows;
  }, [snapshots, range]);

  const windowGain = useMemo(() => {
    if (data.length < 2) return null;
    const a = data[0], b = data[data.length - 1];
    const netFlow = b.invested - a.invested; // money added during the window
    const abs = b.value - a.value - netFlow;
    const base = a.value + netFlow;
    return base > 0 ? { abs, pct: abs / base } : null;
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Portfolio value</div>
          <div className="num mt-1.5 text-[36px] font-semibold leading-none tracking-tight text-ink-2 sm:text-[52px]">
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

        <div className="flex flex-col items-end gap-1.5">
          {available.length > 1 && (
            <div className="flex gap-1">
              {available.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "num rounded-full px-2.5 py-1 text-[12px] transition-colors",
                    range === r ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {windowGain && (
            <span className="text-[11px] text-muted">
              {range === "All" ? "since start" : range} growth{" "}
              <Money value={windowGain.abs} signed compact />
              <span className="mx-1">·</span>
              <Pct value={windowGain.pct} />
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 h-56 sm:h-64">
        {snapshots.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-(--radius-field) border border-dashed border-hairline px-4 text-center">
            <p className="text-sm text-muted">
              History starts now. Come back tomorrow — a snapshot is saved every night.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--hairline)" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => {
                  const dt = new Date(`${d}T00:00:00`);
                  return spanDays > 400
                    ? dt.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
                    : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                }}
                tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--font-plex)" }}
                axisLine={{ stroke: "var(--hairline)" }}
                tickLine={false}
                minTickGap={56}
              />
              <YAxis
                width={54}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => formatCompactINR(v)}
                tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--font-plex)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
              {/* what you put in — the floor the value is measured against */}
              <Line
                type="monotone"
                dataKey="invested"
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={1.75}
                fill="url(#valueFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {snapshots.length >= 2 && (
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent" />
            Value
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed border-muted" />
            Invested
          </span>
          {snapshots.length < 7 && <span>· {snapshots.length} days recorded so far</span>}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const value = payload.find((p) => p.dataKey === "value")?.value ?? 0;
  const invested = payload.find((p) => p.dataKey === "invested")?.value ?? 0;
  const gain = value - invested;
  return (
    <div className="rounded-(--radius-field) border border-hairline bg-surface px-3 py-2 shadow-sm">
      <div className="text-[11px] text-muted">{formatDate(label)}</div>
      <div className="num mt-0.5 text-[13px] font-medium">{formatCompactINR(value)}</div>
      <div className="num text-[11px] text-muted">invested {formatCompactINR(invested)}</div>
      {invested > 0 && (
        <div className="num text-[11px]">
          <Money value={gain} signed compact />
          <span className="mx-1 text-muted">·</span>
          <Pct value={gain / invested} />
        </div>
      )}
    </div>
  );
}
