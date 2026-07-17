// The second signature (§3.1): every numeral is IBM Plex Mono tabular; ₹ and
// decimals at ~70% opacity. Never render a raw number.

import { cn } from "@/lib/utils";
import { formatCompactINR, formatINR, formatPct, formatUnits, formatUSD } from "@/lib/format";

interface MoneyProps {
  value: number;
  /** 'INR' (default) or 'USD'. */
  currency?: "INR" | "USD";
  compact?: boolean;
  /** prefix +/− and color gain/loss */
  signed?: boolean;
  decimals?: 0 | 2;
  className?: string;
}

export function Money({ value, currency = "INR", compact, signed, decimals = 0, className }: MoneyProps) {
  const negative = value < 0;
  const abs = Math.abs(value);
  const color = signed ? (negative ? "text-loss" : "text-gain") : undefined;
  const sign = signed ? (negative ? "−" : "+") : negative ? "−" : "";

  if (compact) {
    return (
      <span className={cn("num font-medium", color, className)}>
        {signed && !negative ? "+" : ""}
        {formatCompactINR(negative ? -abs : abs)}
      </span>
    );
  }

  const formatted = currency === "USD" ? formatUSD(abs).slice(1) : formatINR(abs, decimals);
  const [int, dec] = formatted.split(".");
  return (
    <span className={cn("num", signed && "font-medium", color, className)}>
      {sign}
      <span className="opacity-70">{currency === "USD" ? "$" : "₹"}</span>
      {int}
      {dec != null && <span className="opacity-70">.{dec}</span>}
    </span>
  );
}

export function Pct({ value, signed = true, className }: { value: number; signed?: boolean; className?: string }) {
  return (
    <span
      className={cn("num", signed && "font-medium", signed && (value < 0 ? "text-loss" : "text-gain"), className)}
    >
      {formatPct(value, signed)}
    </span>
  );
}

export function Units({ value, className }: { value: number; className?: string }) {
  return <span className={cn("num", className)}>{formatUnits(value)}</span>;
}
