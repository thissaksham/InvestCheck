// Expected freshness (§14): yahoo 1 market day, mfapi/npsnav 2 calendar days, FX 2 days.

import type { PriceSource } from "./types";

function weekdaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  let count = 0;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d < to) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function isPriceStale(priceDate: string, source: PriceSource, todayIso: string): boolean {
  if (source === "yahoo") return weekdaysBetween(priceDate, todayIso) >= 1;
  if (source === "manual") return false; // manual prices are deliberate — never nag
  return daysBetween(priceDate, todayIso) > 2;
}

export function isFxStale(rateDate: string, todayIso: string): boolean {
  return daysBetween(rateDate, todayIso) > 2;
}
