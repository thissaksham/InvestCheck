import assert from "node:assert";
import { fdInterestEarned, fdTermMonths } from "../lib/valuation";
import type { FixedDeposit } from "../lib/types";

const base = { id: "1", user_id: "u", deposit_no: "1", bank: "B", holder: "Self", payout: "cumulative",
  monthly_payout: null, status: "active", renewed_into: null, note: null, created_at: "" } as unknown as FixedDeposit;

// 1y cumulative, 1L → 1,07,500. Halfway = half the interest.
const cum: FixedDeposit = { ...base, principal: 100000, rate: 0.075, start_date: "2025-01-01",
  maturity_date: "2026-01-01", maturity_amount: 107500 };
assert.equal(fdTermMonths(cum), 12);
// 2 Jul is day 182 of 365 → just under half the 7,500 interest
assert.ok(Math.abs(fdInterestEarned(cum, "2025-07-02")! - 3750) < 15);
assert.equal(Math.round(fdInterestEarned(cum, "2026-01-01")!), 7500);          // at maturity
assert.equal(Math.round(fdInterestEarned(cum, "2027-01-01")!), 7500);          // capped after
assert.equal(fdInterestEarned(cum, "2025-01-01"), 0);                          // day zero

// monthly payout: whole instalments received
const mon: FixedDeposit = { ...base, payout: "monthly", principal: 100000, rate: 0.075,
  start_date: "2025-01-01", maturity_date: "2026-01-01", maturity_amount: null, monthly_payout: 625 };
assert.equal(fdInterestEarned(mon, "2025-04-15"), 3 * 625);
assert.equal(fdInterestEarned(mon, "2025-04-30"), 3 * 625);                    // not a full 4th month
assert.equal(fdInterestEarned(mon, "2025-05-01"), 4 * 625);

// 18 months → "1y 6m" territory
assert.equal(fdTermMonths({ ...cum, maturity_date: "2026-07-01" }), 18);

// unknowable → null, never a misleading zero
assert.equal(fdTermMonths({ ...cum, start_date: null }), null);
assert.equal(fdInterestEarned({ ...cum, start_date: null }, "2025-07-01"), null);
assert.equal(fdInterestEarned({ ...cum, maturity_amount: null }, "2025-07-01"), null);

console.log("all FD term/interest checks passed");
