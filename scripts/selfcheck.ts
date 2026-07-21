// Runnable check for the money paths — the §19 acceptance numbers.
// Run: npx tsx scripts/selfcheck.ts

import assert from "node:assert";
import { computePosition, epfByComponent, fdSummary } from "../lib/valuation";
import { fyLabel } from "../lib/fy";
import { formatINR } from "../lib/format";
import { xirr } from "../lib/xirr";
import type { EpfEntry, FixedDeposit, Instrument, Transaction } from "../lib/types";

const instrument = { id: "i1", currency: "INR" } as Instrument;
const txn = (type: Transaction["type"], units: number, amount: number, date: string): Transaction =>
  ({ id: date + type, instrument_id: "i1", date, type, units, amount, created_at: date } as Transaction);

// P1: opening 100u/₹10,000 + buy 50u/₹6,000 → units 150, invested 16,000, avg 106.67
let p = computePosition(instrument, [txn("opening", 100, 10000, "2026-01-01"), txn("buy", 50, 6000, "2026-02-01")], null, null);
assert.equal(p.units, 150);
assert.equal(p.invested, 16000);
assert.ok(Math.abs(p.avgCost! - 106.6667) < 0.001, `avg ${p.avgCost}`);

// … sell 30u for ₹4,000 → invested 12,800, realized +800
p = computePosition(
  instrument,
  [txn("opening", 100, 10000, "2026-01-01"), txn("buy", 50, 6000, "2026-02-01"), txn("sell", 30, 4000, "2026-03-01")],
  null,
  null
);
assert.equal(p.units, 120);
assert.equal(p.invested, 12800);
assert.ok(Math.abs(p.realized - 800) < 0.001, `realized ${p.realized}`);

// NPS fee: buy 100u/₹10,000 then fee of 2u (₹120) → units 98, invested unchanged 10,000
p = computePosition(
  instrument,
  [txn("buy", 100, 10000, "2026-01-01"), txn("fee", 2, 120, "2026-04-01")],
  { price: 100, date: "2026-04-02", source: "npsnav" },
  null
);
assert.equal(p.units, 98);
assert.equal(p.invested, 10000); // fee never touches cost basis
assert.equal(p.realized, 0);
assert.ok(Math.abs(p.value - 9800) < 1e-6, `value ${p.value}`); // 98 × 100

// P4: FD-A 1,00,000 @7.50% + FD-B 3,00,000 @8.00% → weighted 7.875%; interest of A = +8,000
const fd = (over: Partial<FixedDeposit>): FixedDeposit =>
  ({ status: "active", payout: "cumulative", maturity_date: "2027-01-01", ...over } as FixedDeposit);
const a = fd({ principal: 100000, rate: 0.075, maturity_amount: 108000 });
let s = fdSummary([a], "2026-07-17");
assert.equal(s.principal, 100000);
assert.equal(s.maturityAmount, 108000);
assert.equal(s.projectedInterest, 8000);
assert.ok(Math.abs(s.weightedRate! - 0.075) < 1e-9);
s = fdSummary([a, fd({ principal: 300000, rate: 0.08, maturity_amount: 324000 })], "2026-07-17");
assert.ok(Math.abs(s.weightedRate! - 0.07875) < 1e-9, `weighted ${s.weightedRate}`);
// renewed chains count once
s = fdSummary([{ ...a, status: "renewed" }, fd({ principal: 108000, rate: 0.07, maturity_amount: 115000 })], "2026-07-17");
assert.equal(s.principal, 108000);
assert.equal(s.activeCount, 1);

// P5: EPF opening 50,000 + contribution 5,000 + interest 2,000 → 57,000 / 55,000 / 2,000
const e = (type: EpfEntry["type"], amount: number): EpfEntry =>
  ({ component: "employee", type, amount, date: "2026-01-01" } as EpfEntry);
const epf = epfByComponent([e("opening", 50000), e("contribution", 5000), e("interest", 2000)]);
assert.equal(epf.combined.balance, 57000);
assert.equal(epf.combined.contributions, 55000);
assert.equal(epf.combined.interest, 2000);

// §12: fyLabel(2026-07-17) = FY26-27
assert.equal(fyLabel("2026-07-17"), "FY26-27");
assert.equal(fyLabel("2027-02-01"), "FY26-27");
assert.equal(fyLabel("2027-04-01"), "FY27-28");

// §13: Indian grouping — ₹8,41,532 never 841,532
assert.equal(formatINR(841532), "8,41,532");

// XIRR: −10,000 a year ago → +11,000 today ≈ 10%
const r = xirr([{ amount: -10000, date: "2025-07-17" }, { amount: 11000, date: "2026-07-17" }]);
assert.ok(r != null && Math.abs(r - 0.1) < 0.005, `xirr ${r}`);
// openings-only → caller passes no flows → null
assert.equal(xirr([]), null);

console.log("selfcheck: all acceptance numbers pass ✓");
