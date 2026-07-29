// Valuation engine (§7). Positions are always computed from the ledger — never stored.

import type {
  Bucket,
  BucketSlice,
  EpfEntry,
  FixedDeposit,
  Instrument,
  InstrumentType,
  PriceSource,
  Transaction,
} from "./types";

export interface LatestPrice {
  price: number;
  date: string;
  source: PriceSource;
}

export interface Fx {
  rate: number;
  date: string;
}

export interface Position {
  instrument: Instrument;
  units: number;
  invested: number; // ₹ actually deployed
  avgCost: number | null;
  realized: number; // realized P&L to date (drawer only, never headline)
  price: number | null; // native currency
  priceDate: string | null;
  priceSource: PriceSource | null;
  /** ₹ value. Falls back to invested when no price (or no FX for USD) exists. */
  value: number;
  hasPrice: boolean;
  /** USD instrument with no FX rate at all — display "—" (§14). */
  fxMissing: boolean;
  unrealised: number;
  ret: number | null;
  weight: number;
}

export function computePosition(
  instrument: Instrument,
  txns: Transaction[], // this instrument's, any order
  latest: LatestPrice | null,
  fx: Fx | null
): Position {
  const sorted = [...txns].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
  );
  let units = 0;
  let invested = 0;
  let realized = 0;
  for (const t of sorted) {
    const u = t.units;
    if (t.type === "sell") {
      // a sell releases cost at average
      const released = units > 0 ? u * (invested / units) : 0;
      invested -= released;
      realized += t.amount - released;
      units -= u;
    } else if (t.type === "fee") {
      // NPS fee: units redeemed to pay the charge. Invested is untouched, so
      // value falls with the units — the fee shows as a drag on P&L. The ₹
      // amount is reference only (like amount_usd), never enters cost math.
      units -= u;
    } else {
      units += u;
      invested += t.amount;
    }
  }
  // guard float dust
  if (Math.abs(units) < 1e-9) units = 0;
  if (Math.abs(invested) < 0.005) invested = 0;

  const isUsd = instrument.currency === "USD";
  const fxMissing = isUsd && !fx;
  const hasPrice = latest != null && !fxMissing;
  const value = hasPrice && latest ? units * latest.price * (isUsd && fx ? fx.rate : 1) : invested;
  const unrealised = value - invested;

  return {
    instrument,
    units,
    invested,
    avgCost: units > 0 ? invested / units : null,
    realized,
    price: latest?.price ?? null,
    priceDate: latest?.date ?? null,
    priceSource: latest?.source ?? null,
    value,
    hasPrice,
    fxMissing,
    unrealised,
    ret: invested > 0 ? unrealised / invested : null,
    weight: 0,
  };
}

export function computePositions(
  instruments: Instrument[],
  transactions: Transaction[],
  latestPrices: Map<string, LatestPrice>,
  fx: Fx | null
): Position[] {
  const byInstrument = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byInstrument.get(t.instrument_id) ?? [];
    list.push(t);
    byInstrument.set(t.instrument_id, list);
  }
  const positions = instruments.map((i) =>
    computePosition(i, byInstrument.get(i.id) ?? [], latestPrices.get(i.id) ?? null, fx)
  );
  // weight = value / Σ market values (market = all priced instruments; EPF is not a position)
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  for (const p of positions) p.weight = totalValue > 0 ? p.value / totalValue : 0;
  return positions;
}

export function totals(positions: Position[]): BucketSlice {
  return {
    invested: positions.reduce((s, p) => s + p.invested, 0),
    value: positions.reduce((s, p) => s + p.value, 0),
  };
}

export function rollup(
  positions: Position[],
  key: (p: Position) => string
): Record<string, BucketSlice> {
  const out: Record<string, BucketSlice> = {};
  for (const p of positions) {
    const k = key(p);
    out[k] ??= { invested: 0, value: 0 };
    out[k].invested += p.invested;
    out[k].value += p.value;
  }
  return out;
}

export const rollupByBucket = (positions: Position[]) => rollup(positions, (p) => p.instrument.bucket);
export const rollupByType = (positions: Position[]) => rollup(positions, (p) => p.instrument.type);

// ===== EPF (§7): balance = Σ signed entries; never price-fetched =====

export interface EpfBalance {
  balance: number;
  contributions: number; // opening + contribution
  interest: number; // balance − contributions
}

export function epfBalance(entries: EpfEntry[]): EpfBalance {
  let balance = 0;
  let contributions = 0;
  for (const e of entries) {
    balance += e.amount;
    if (e.type === "opening" || e.type === "contribution") contributions += e.amount;
  }
  return { balance, contributions, interest: balance - contributions };
}

export function epfByComponent(entries: EpfEntry[]) {
  return {
    employee: epfBalance(entries.filter((e) => e.component === "employee")),
    employer: epfBalance(entries.filter((e) => e.component === "employer")),
    self: epfBalance(entries.filter((e) => e.component === "self")),
    combined: epfBalance(entries),
  };
}

// ===== FD accrued value (Deposits module only, §7) =====

export interface FdValue {
  value: number;
  label: "accrued" | "principal (start date unknown)" | "principal (monthly payout)";
}

export function fdAccruedValue(fd: FixedDeposit, todayIso: string): FdValue {
  if (fd.payout === "monthly") return { value: fd.principal, label: "principal (monthly payout)" };
  if (!fd.start_date || !fd.maturity_amount) {
    return { value: fd.principal, label: "principal (start date unknown)" };
  }
  const start = Date.parse(fd.start_date);
  const end = Date.parse(fd.maturity_date);
  const now = Date.parse(todayIso);
  const frac = end > start ? Math.min(Math.max((now - start) / (end - start), 0), 1) : 1;
  return { value: fd.principal + (fd.maturity_amount - fd.principal) * frac, label: "accrued" };
}

/** Whole months from a to b, floor (28 Mar → 28 Jun = 3; → 27 Jun = 2). */
function monthsBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`);
  const b = new Date(`${bIso}T00:00:00Z`);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m--;
  return Math.max(0, m);
}

/** Full term in months. Null when the start date was never recorded. */
export function fdTermMonths(fd: FixedDeposit): number | null {
  return fd.start_date ? monthsBetween(fd.start_date, fd.maturity_date) : null;
}

/**
 * Interest earned to date — accrued pro-rata for cumulative FDs, already-paid
 * instalments for monthly-payout ones. Caps at maturity so a matured deposit
 * doesn't keep accruing. Null when it can't be derived (no start date / no
 * maturity amount), never a misleading zero.
 */
export function fdInterestEarned(fd: FixedDeposit, todayIso: string): number | null {
  if (!fd.start_date) return null;
  const asOf = todayIso < fd.maturity_date ? todayIso : fd.maturity_date;
  if (asOf <= fd.start_date) return 0;

  if (fd.payout === "monthly") {
    return fd.monthly_payout != null ? monthsBetween(fd.start_date, asOf) * fd.monthly_payout : null;
  }
  if (fd.maturity_amount == null) return null;
  const start = Date.parse(`${fd.start_date}T00:00:00Z`);
  const end = Date.parse(`${fd.maturity_date}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  const frac = end > start ? (now - start) / (end - start) : 1;
  return (fd.maturity_amount - fd.principal) * frac;
}

export interface FdSummary {
  principal: number;
  maturityAmount: number;
  projectedInterest: number;
  /** interest accrued/received so far across active deposits */
  interestEarned: number;
  weightedRate: number | null;
  activeCount: number;
  nextMaturity: FixedDeposit | null;
}

/** Aggregates count each renewal chain once: active rows only (§4.5). */
export function fdSummary(fds: FixedDeposit[], todayIso: string): FdSummary {
  const active = fds.filter((f) => f.status === "active");
  const principal = active.reduce((s, f) => s + f.principal, 0);
  const maturityAmount = active.reduce((s, f) => s + (f.maturity_amount ?? f.principal), 0);
  const upcoming = active
    .filter((f) => f.maturity_date >= todayIso)
    .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));
  return {
    principal,
    maturityAmount,
    projectedInterest: maturityAmount - principal,
    interestEarned: active.reduce((s, f) => s + (fdInterestEarned(f, todayIso) ?? 0), 0),
    weightedRate: principal > 0 ? active.reduce((s, f) => s + f.principal * f.rate, 0) / principal : null,
    activeCount: active.length,
    nextMaturity: upcoming[0] ?? null,
  };
}

// ===== snapshot payload (shared by cron + first-load fallback) =====

export const BUCKETS: Bucket[] = ["indian_equity", "intl_equity", "gold", "debt_liquid", "retirement"];
export const MARKET_TYPES: InstrumentType[] = ["stock", "etf", "mutual_fund", "nps"];

export function snapshotPayload(positions: Position[], epfEntries: EpfEntry[]) {
  const epf = epfBalance(epfEntries);
  const byBucket = rollupByBucket(positions);
  for (const b of BUCKETS) byBucket[b] ??= { invested: 0, value: 0 };
  byBucket.retirement.invested += epf.contributions;
  byBucket.retirement.value += epf.balance;

  const byType = rollupByType(positions);
  for (const t of MARKET_TYPES) byType[t] ??= { invested: 0, value: 0 };
  byType.epf = { invested: epf.contributions, value: epf.balance };

  const market = totals(positions);
  return {
    invested: round2(market.invested + epf.contributions),
    current_value: round2(market.value + epf.balance),
    by_bucket: roundSlices(byBucket),
    by_type: roundSlices(byType),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const roundSlices = (r: Record<string, BucketSlice>) =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, { invested: round2(v.invested), value: round2(v.value) }])
  );
