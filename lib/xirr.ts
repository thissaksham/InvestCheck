// XIRR (§12): Newton–Raphson from 10%, bisection fallback on divergence,
// clamped to (−0.99, 10). Returns null when a rate can't be computed.

export interface CashFlow {
  amount: number; // negative = money in (buy), positive = money out (sell/terminal value)
  date: string | Date;
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const LO = -0.99;
const HI = 10;

export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const t0 = toTime(flows[0].date);
  const cf = flows.map((f) => ({ a: f.amount, t: (toTime(f.date) - t0) / YEAR_MS }));
  if (!cf.some((f) => f.a > 0) || !cf.some((f) => f.a < 0)) return null;

  const npv = (r: number) => cf.reduce((s, f) => s + f.a / Math.pow(1 + r, f.t), 0);
  const dnpv = (r: number) => cf.reduce((s, f) => s - (f.t * f.a) / Math.pow(1 + r, f.t + 1), 0);

  // Newton–Raphson
  let r = 0.1;
  for (let i = 0; i < 50; i++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-7) return clamp(r);
    const d = dnpv(r);
    if (d === 0) break;
    const next = r - f / d;
    if (!isFinite(next) || next <= LO || next > HI) break; // diverged → bisection
    if (Math.abs(next - r) < 1e-9) return clamp(next);
    r = next;
  }

  // Bisection on [LO, HI]
  let lo = LO + 1e-9;
  let hi = HI;
  let fLo = npv(lo);
  if (fLo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-9) return clamp(mid);
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return clamp((lo + hi) / 2);
}

function toTime(d: string | Date): number {
  return typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() : d.getTime();
}

function clamp(r: number): number {
  return Math.min(Math.max(r, LO), HI);
}
