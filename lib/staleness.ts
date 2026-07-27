// Expected freshness (§14). All sources are business-day aware — NAVs, closes,
// and FX rates aren't published on weekends, so a Friday value is still the
// freshest one on Monday and must not read as "stale".

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

export function isPriceStale(priceDate: string, source: PriceSource, todayIso: string): boolean {
  if (source === "manual") return false; // manual prices are deliberate — never nag
  // yahoo publishes a close each market day, so >=1 business day behind is stale.
  if (source === "yahoo") return weekdaysBetween(priceDate, todayIso) >= 1;
  // mfapi / npsnav publish NAVs on business days at ~T+1, so allow one business
  // day of lag — a Friday NAV is fine through Monday; stale from Wednesday on.
  return weekdaysBetween(priceDate, todayIso) >= 2;
}

export function isFxStale(rateDate: string, todayIso: string): boolean {
  return weekdaysBetween(rateDate, todayIso) >= 2;
}
