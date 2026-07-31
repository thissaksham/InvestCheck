// Regression test for CAS matching. Every case here is a bug that actually
// shipped during development — run after touching lib/cas.ts.
//   npx tsx scripts/check-cas.mts
import assert from "node:assert";
import { holdingsAsOf, parseCas, reconcile, similarity, type AppHolding } from "../lib/cas";

// 0. A CAS covers a closed period, so the ledger must be replayed to that date —
//    comparing a 30-Jun statement against today reported every July trade as a
//    discrepancy.
{
  const inst = [{ id: "x", name: "X" }];
  const txns = [
    { instrument_id: "x", date: "2026-06-10", type: "buy", units: 100 },
    { instrument_id: "x", date: "2026-06-20", type: "sell", units: 30 },
    { instrument_id: "x", date: "2026-07-05", type: "buy", units: 50 }, // after the statement
  ];
  assert.equal(holdingsAsOf(inst, txns, "2026-06-30")[0].units, 70);
  assert.equal(holdingsAsOf(inst, txns, "2026-07-31")[0].units, 120);
  assert.equal(holdingsAsOf(inst, txns, "2026-06-15")[0].units, 100); // mid-period
}

// 1. A subset name must not tie with its exact match. Scoring overlap against
//    the shorter name gave both 1.0 and swapped 943 units with 61.
assert.ok(
  similarity("NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIA ETF NIFTY 50 BEES", "Nippon India ETF Nifty 50 BeES") >
    similarity("NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIA ETF NIFTY 50 BEES", "Nippon India ETF Nifty Next 50 Junior BeES"),
  "Nifty 50 must score higher against itself than against Nifty Next 50"
);

// 2. Equities put the company BEFORE the '#'; splitting on it lost the name.
assert.ok(
  similarity("TATA STEEL LIMITED #NEW EQUITY SHARES WITH FACE VALUE RE. 1/- AFTER SUBDIVISION", "Tata Steel") > 0.9,
  "equity boilerplate must be stripped down to the company name"
);
assert.ok(similarity("IDFC FIRST BANK LIMITED # EQUITY SHARES", "IDFC First Bank") > 0.9);

const cas = parseCas({
  meta: { statement_period: { to: "2026-06-30" } },
  investor: { name: "TEST" },
  summary: { total_value: 100 },
  demat_accounts: [
    {
      dp_name: "ZERODHA",
      holdings: {
        equities: [{ isin: "INE081A01020", name: "TATA STEEL LIMITED #NEW EQUITY SHARES WITH FACE VALUE RE. 1/- AFTER SUBDIVISION", units: 20, value: 3763 }],
        demat_mutual_funds: [
          { isin: "INF204KB14I2", name: "NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIA ETF NIFTY 50 BEES", units: 943, value: 256505 },
          { isin: "INF732E01045", name: "NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIA ETF NIFTY NEXT 50 JUNIOR BEES", units: 64, value: 49569 },
        ],
      },
    },
  ],
  // same ISIN across two folios — one holding, must be summed
  mutual_funds: [
    { amc: "Axis", schemes: [{ isin: "INF846K012K9", name: "NQDG - Axis NASDAQ 100 US Specific Equity Passive FOF - Direct Growth", units: 512.195, value: 15442 }] },
    { amc: "Axis", schemes: [{ isin: "INF846K012K9", name: "NQDG - Axis NASDAQ 100 US Specific Equity Passive FOF - Direct Growth", units: 1513.057, value: 45618 }] },
  ],
});

assert.equal(cas.asOf, "2026-06-30");
const axis = cas.holdings.find((h) => h.isin === "INF846K012K9")!;
assert.ok(Math.abs(axis.units - 2025.252) < 1e-6, "duplicate folios of one scheme must merge");

const app: AppHolding[] = [
  { id: "nifty", name: "Nippon India ETF Nifty 50 BeES", units: 985, value: 267142 },
  { id: "junior", name: "Nippon India ETF Nifty Next 50 Junior BeES", units: 61, value: 47354 },
  { id: "tata", name: "Tata Steel", units: 20, value: 3653 },
  { id: "axis", name: "Axis NASDAQ 100 US Specific Equity Passive FOF - Direct Growth", units: 2025.26, value: 61060 },
  { id: "closed", name: "Nippon India ETF Gold BeES", units: 0, value: 0 },
];

const rows = reconcile(cas.holdings, app);
const by = (id: string) => rows.find((r) => r.key === id)!;

// 3. the swap: each ETF must pair with its own CAS line
assert.equal(by("nifty").casUnits, 943);
assert.equal(by("junior").casUnits, 64);

// 4. exact agreement, incl. the post-split Tata Steel count
assert.equal(by("tata").status, "match");

// 5. 2025.252 vs 2025.26 is rounding, not a discrepancy
assert.equal(by("axis").status, "match");

// 6. a fully-exited holding isn't "missing from the CAS"
assert.ok(!rows.some((r) => r.key === "closed"), "zero-unit positions are excluded");

// 7. The three NPS schemes differ only by a single letter (E/C/G). Dropping
//    1-char tokens made them tokenize identically, so they paired by array
//    order and swapped. Assert every ordering resolves correctly.
{
  const names = ["E", "C", "G"].map((k) => `ICICI PRUDENTIAL PENSION FUND SCHEME ${k} -\rTIER I POP`);
  const unitsFor: Record<string, number> = { E: 1157.39, C: 250.191, G: 447.759 };
  const npsCas = parseCas({
    meta: { statement_period: { to: "2026-06-30" } },
    nps: [{ funds: ["E", "C", "G"].map((k, i) => ({ name: names[i], units: unitsFor[k], value: 1 })) }],
  });
  for (const order of [["E", "C", "G"], ["G", "C", "E"], ["C", "G", "E"]]) {
    const npsApp: AppHolding[] = order.map((k) => ({
      id: k,
      name: `ICICI PRUDENTIAL PENSION FUND SCHEME ${k} - TIER I POP`,
      units: unitsFor[k],
    }));
    for (const r of reconcile(npsCas.holdings, npsApp)) {
      assert.equal(r.status, "match", `NPS ${r.key} mispaired with app order ${order.join("")}`);
      assert.ok(r.casName!.includes(`SCHEME ${r.key} `), `NPS ${r.key} paired with ${r.casName}`);
    }
  }
}

console.log(`all CAS checks passed (${rows.length} rows, ${rows.filter((r) => r.status === "match").length} matching)`);
