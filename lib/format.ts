// India formatting rules (§13). All display formatting routes through here —
// no ad-hoc toFixed anywhere else.

const grouped = (decimals: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const INR0 = grouped(0);
const INR2 = grouped(2);

/** ₹8,41,532 — Indian digit grouping, no symbol (the <Money> component adds it). */
export function formatINR(value: number, decimals: 0 | 2 = 0): string {
  return (decimals === 0 ? INR0 : INR2).format(value);
}

/** Compact lakh/crore: ₹9.4L, ₹1.2Cr. Chips/timeline only. */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  return `${sign}₹${INR0.format(abs)}`;
}

/** $ quotes at 2 decimals. */
export function formatUSD(value: number): string {
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

/** 07 Mar 2027 */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T00:00:00`) : iso;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/** +12.3% — signed, 1 decimal. */
export function formatPct(value: number, signed = true): string {
  const pct = (value * 100).toFixed(1);
  if (!signed) return `${pct}%`;
  return value >= 0 ? `+${pct}%` : `−${Math.abs(value * 100).toFixed(1)}%`;
}

/** Units to 3 decimals, trailing zeros trimmed. */
export function formatUnits(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
}

/** NAVs at 4 decimals. */
export function formatNav(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}
