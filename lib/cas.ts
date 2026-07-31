// CAS reconciliation: parse a casparser JSON dump and diff it against the
// ledger's holdings. Read-only — nothing here writes, it only reports.

export type CasKind = "equity" | "demat_mf" | "mutual_fund" | "nps";

export interface CasHolding {
  name: string;
  isin: string | null;
  units: number;
  value: number;
  kind: CasKind;
  account: string; // DP / AMC / "NPS"
}

export interface CasParsed {
  investor: string | null;
  asOf: string | null;
  totalValue: number | null;
  holdings: CasHolding[];
}

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Pulls every holding out of a casparser dump, whatever section it sits in. */
export function parseCas(input: unknown): CasParsed {
  const root = (input ?? {}) as Record<string, any>;
  const holdings: CasHolding[] = [];

  for (const acc of (root.demat_accounts ?? []) as any[]) {
    const account = str(acc?.dp_name) || "Demat";
    const h = acc?.holdings ?? {};
    for (const [key, kind] of [
      ["equities", "equity"],
      ["demat_mutual_funds", "demat_mf"],
    ] as [string, CasKind][]) {
      for (const row of (h?.[key] ?? []) as any[]) {
        holdings.push({
          name: str(row?.name),
          isin: str(row?.isin) || null,
          units: num(row?.units),
          value: num(row?.value),
          kind,
          account,
        });
      }
    }
  }

  for (const folio of (root.mutual_funds ?? []) as any[]) {
    const account = str(folio?.amc) || "Mutual fund";
    for (const s of (folio?.schemes ?? []) as any[]) {
      holdings.push({
        name: str(s?.name),
        isin: str(s?.isin) || null,
        units: num(s?.units),
        value: num(s?.value),
        kind: "mutual_fund",
        account,
      });
    }
  }

  for (const acc of (root.nps ?? []) as any[]) {
    for (const f of (acc?.funds ?? []) as any[]) {
      holdings.push({
        name: str(f?.name),
        isin: null,
        units: num(f?.units),
        value: num(f?.value),
        kind: "nps",
        account: "NPS",
      });
    }
  }

  return {
    investor: str(root?.investor?.name) || null,
    asOf: str(root?.meta?.statement_period?.to) || str(root?.meta?.generated_at).slice(0, 10) || null,
    totalValue: root?.summary?.total_value != null ? num(root.summary.total_value) : null,
    holdings: mergeByIsin(holdings.filter((h) => h.name)),
  };
}

/**
 * One scheme held across several folios is still one holding — the same Axis
 * NASDAQ FOF appears twice in the CAS (512 + 1513 units) and must be summed to
 * line up with the ledger's single 2025-unit position.
 */
function mergeByIsin(holdings: CasHolding[]): CasHolding[] {
  const out = new Map<string, CasHolding & { accounts: Set<string> }>();
  for (const h of holdings) {
    const key = h.isin || h.name.toUpperCase().replace(/\s+/g, " ").trim();
    const seen = out.get(key);
    if (seen) {
      seen.units += h.units;
      seen.value += h.value;
      seen.accounts.add(h.account);
    } else {
      out.set(key, { ...h, accounts: new Set([h.account]) });
    }
  }
  return [...out.values()].map(({ accounts, ...h }) => ({
    ...h,
    account: accounts.size > 1 ? `${[...accounts][0]} +${accounts.size - 1}` : [...accounts][0],
  }));
}

// ---------- name matching ----------

// Words that appear in nearly every CAS name and carry no signal. Note the
// equity boilerplate ("NEW EQUITY SHARES WITH FACE VALUE RE 1 AFTER
// SUBDIVISION") — stripping it is what leaves "TATA STEEL" to match on.
const NOISE = new Set([
  "LIMITED", "LTD", "PVT", "PRIVATE", "COMPANY", "CO", "AM", "MF", "AMC", "FUND", "FUNDS",
  "EQUITY", "SHARES", "SHARE", "NEW", "WITH", "FACE", "VALUE", "AFTER", "SUBDIVISION",
  "SUB", "DIVISION", "THE", "AND", "OF", "PLAN", "DIRECT", "GROWTH", "OPTION", "REGULAR",
  "SCHEME", "INDIA", "INDIAN", "LIFE", "ASSET", "MANAGEMENT", "TIER", "POP", "FORMERLY",
  "RE", "PASSIVE", "SPECIFIC", "US", "TAX", "SAVER",
]);

/**
 * Significant uppercase tokens. The whole string is tokenised — never split on
 * '#', because the marker sits on either side depending on the section: MF
 * names put the AMC before it ("NIPPON LIFE…#NIPPON INDIA ETF…") while equities
 * put the company before it ("TATA STEEL LIMITED #NEW EQUITY SHARES…").
 */
export function tokens(name: string): Set<string> {
  return new Set(
    name
      .toUpperCase()
      .replace(/[\r\n]+/g, " ")
      .replace(/^[A-Z0-9]{3,6}\s*-\s*/, "") // leading scheme code, e.g. "001ZG - "
      .replace(/[^A-Z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !NOISE.has(t))
  );
}

/**
 * Overlap relative to the LONGER name. Dividing by the shorter one lets a
 * subset score a perfect 1.0 — "Nifty 50 BeES" scored 1.0 against both itself
 * and "Nifty Next 50 Junior BeES", so the two swapped holdings. Against the
 * longer name the exact match wins outright (1.0 vs 0.71).
 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

// ---------- reconciliation ----------

export interface AppHolding {
  id: string;
  name: string;
  units: number;
  value: number;
}

export type ReconStatus = "match" | "units_differ" | "only_cas" | "only_app";

export interface ReconRow {
  key: string;
  name: string;       // app name when matched, else CAS name
  casName: string | null;
  account: string | null;
  kind: CasKind | null;
  casUnits: number | null;
  appUnits: number | null;
  casValue: number | null;
  appValue: number | null;
  status: ReconStatus;
}

/** Below this a holding is closed, not missing. */
const UNIT_TOLERANCE = 0.001;

/**
 * Units agree when they're this close. The ledger rounds units to 2dp while a
 * CAS carries 3, so 11.713 vs 11.73 is the same holding, not a discrepancy.
 * Scaled slightly for large unit counts.
 */
const matchTolerance = (a: number, b: number) => Math.max(0.05, 0.0001 * Math.max(Math.abs(a), Math.abs(b)));

/**
 * Greedy best-score pairing on name similarity: every CAS×app pair is scored,
 * the strongest legitimate pairs claim each other first, so a near-miss can't
 * steal a holding from its exact match (Nifty 50 BeES vs Nifty Midcap 150).
 */
export function reconcile(casRows: CasHolding[], appRows: AppHolding[], threshold = 0.45): ReconRow[] {
  const cas = casRows.filter((c) => Math.abs(c.units) > UNIT_TOLERANCE);
  // fully-exited positions aren't "missing from the CAS" — they're just closed
  const app = appRows.filter((a) => Math.abs(a.units) > UNIT_TOLERANCE);

  const pairs: { ci: number; ai: number; score: number }[] = [];
  cas.forEach((c, ci) =>
    app.forEach((a, ai) => {
      const score = similarity(c.name, a.name);
      if (score >= threshold) pairs.push({ ci, ai, score });
    })
  );
  pairs.sort((x, y) => y.score - x.score);

  const casTaken = new Set<number>();
  const appTaken = new Set<number>();
  const rows: ReconRow[] = [];

  for (const p of pairs) {
    if (casTaken.has(p.ci) || appTaken.has(p.ai)) continue;
    casTaken.add(p.ci);
    appTaken.add(p.ai);
    const c = cas[p.ci];
    const a = app[p.ai];
    rows.push({
      key: a.id,
      name: a.name,
      casName: c.name,
      account: c.account,
      kind: c.kind,
      casUnits: c.units,
      appUnits: a.units,
      casValue: c.value,
      appValue: a.value,
      status: Math.abs(c.units - a.units) <= matchTolerance(c.units, a.units) ? "match" : "units_differ",
    });
  }

  cas.forEach((c, ci) => {
    if (casTaken.has(ci)) return;
    rows.push({
      key: `cas-${ci}`,
      name: c.name,
      casName: c.name,
      account: c.account,
      kind: c.kind,
      casUnits: c.units,
      appUnits: null,
      casValue: c.value,
      appValue: null,
      status: "only_cas",
    });
  });

  app.forEach((a, ai) => {
    if (appTaken.has(ai)) return;
    rows.push({
      key: a.id,
      name: a.name,
      casName: null,
      account: null,
      kind: null,
      casUnits: null,
      appUnits: a.units,
      casValue: null,
      appValue: a.value,
      status: "only_app",
    });
  });

  const order: Record<ReconStatus, number> = { units_differ: 0, only_cas: 1, only_app: 2, match: 3 };
  return rows.sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name));
}
