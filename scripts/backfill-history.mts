// Backfills the snapshots table with what the portfolio was ACTUALLY worth on
// every past date, from real price history — not a curve fitted to XIRR.
//
//   npx tsx scripts/backfill-history.mts            # all users
//   npx tsx scripts/backfill-history.mts --dry      # report, write nothing
//
// Sources: MFapi full NAV history, Yahoo daily closes, NPS NAVs observed in the
// user's own transactions (npsnav has no history endpoint), EPF from its ledger.

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CorporateAction, EpfEntry, Instrument, Transaction } from "../lib/types";
import { BUCKETS, MARKET_TYPES } from "../lib/valuation";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const s: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const DRY = process.argv.includes("--dry");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

type Point = { date: string; price: number };
const round2 = (n: number) => Math.round(n * 100) / 100;
const addDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries transient failures (network errors, 429 rate-limit, 5xx) with backoff
// so one blip from mfapi/yahoo doesn't abort the whole run or leave a holding
// valued at cost. Returns null when it ultimately can't fetch.
async function fetchRetry(url: string, opts: RequestInit = {}, tries = 4): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...opts, cache: "no-store" });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return res; // non-retryable (404 etc.)
    } catch {
      /* network/timeout — retry */
    }
    if (i < tries - 1) await sleep(2500 * (i + 1) * (i + 1)); // 2.5s, 10s, 22.5s
  }
  return null;
}

// ---------- price history sources ----------

async function mfapiHistory(code: string): Promise<Point[]> {
  const res = await fetchRetry(`https://api.mfapi.in/mf/${code}`);
  if (!res || !res.ok) return [];
  const j = (await res.json()) as { data?: { date: string; nav: string }[] };
  return (j.data ?? [])
    .map((r) => {
      const [dd, mm, yyyy] = r.date.split("-");
      return { date: `${yyyy}-${mm}-${dd}`, price: Number(r.nav) };
    })
    .filter((p) => isFinite(p.price) && p.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function yahooHistory(symbol: string): Promise<Point[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d`;
  const res = await fetchRetry(url, { headers: { "User-Agent": UA } });
  if (!res || !res.ok) return [];
  const j = (await res.json()) as {
    chart?: { result?: [{ timestamp?: number[]; indicators?: { quote?: [{ close?: (number | null)[] }] } }] };
  };
  const r = j.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const close = r?.indicators?.quote?.[0]?.close ?? [];
  const out: Point[] = [];
  ts.forEach((t, i) => {
    const c = close[i];
    if (c != null) out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), price: c });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** NPS: npsnav serves only today's NAV, so use the NAVs implied by the user's
 *  own transactions (amount/units) and interpolate between them. */
function navsFromTransactions(txns: Transaction[], latest: Point | null): Point[] {
  const pts = txns
    .filter((t) => Number(t.units) > 0 && Number(t.amount) > 0)
    .map((t) => ({ date: t.date, price: Number(t.amount) / Number(t.units) }))
    .filter((p) => isFinite(p.price) && p.price > 0);
  if (latest) pts.push(latest);
  const byDate = new Map<string, number>();
  for (const p of pts) byDate.set(p.date, p.price);
  return [...byDate.entries()].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Straight-line fill between observed points so gaps don't look like flat steps. */
function interpolate(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    out.push(a);
    const days = Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86400000);
    for (let d = 1; d < days; d++) {
      out.push({ date: addDay(out[out.length - 1].date), price: a.price + ((b.price - a.price) * d) / days });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// ---------- per-user backfill ----------

async function backfillUser(userId: string, label: string) {
  const [{ data: instRows }, { data: txnRows }, { data: epfRows }, { data: caRows }] = await Promise.all([
    s.from("instruments").select("*").eq("user_id", userId),
    s.from("transactions").select("*").eq("user_id", userId).order("date"),
    s.from("epf_entries").select("*").eq("user_id", userId).order("date"),
    s.from("corporate_actions").select("*").eq("user_id", userId).order("ex_date"),
  ]);
  const instruments = (instRows ?? []) as Instrument[];
  const transactions = (txnRows ?? []) as Transaction[];
  const epfEntries = (epfRows ?? []) as EpfEntry[];
  // splits/bonuses keyed by ex-date → applied to held units as the walk crosses
  const actionsByDate = new Map<string, { instrumentId: string; factor: number }[]>();
  for (const a of (caRows ?? []) as CorporateAction[]) {
    const list = actionsByDate.get(a.ex_date) ?? [];
    list.push({ instrumentId: a.instrument_id, factor: Number(a.factor) });
    actionsByDate.set(a.ex_date, list);
  }
  if (!transactions.length && !epfEntries.length) {
    console.log(`${label}: nothing to backfill`);
    return;
  }

  // price history per instrument
  const history = new Map<string, Point[]>();
  for (const i of instruments) {
    const its = transactions.filter((t) => t.instrument_id === i.id);
    let pts: Point[] = [];
    if (i.identifier && i.source === "mfapi") pts = await mfapiHistory(i.identifier);
    else if (i.identifier && i.source === "yahoo") pts = await yahooHistory(i.identifier);
    else if (i.source === "npsnav") {
      const { data: p } = await s
        .from("prices").select("date,price").eq("instrument_id", i.id).order("date", { ascending: false }).limit(1);
      const latest = p?.[0] ? { date: p[0].date as string, price: Number(p[0].price) } : null;
      pts = interpolate(navsFromTransactions(its, latest));
    } else {
      const { data: p } = await s.from("prices").select("date,price").eq("instrument_id", i.id).order("date");
      pts = (p ?? []).map((x) => ({ date: x.date as string, price: Number(x.price) }));
    }
    history.set(i.id, pts);
    console.log(`   ${i.name.slice(0, 44).padEnd(44)} ${String(pts.length).padStart(5)} price points`);
  }

  // walk every day from first activity to today
  const firstDate = [
    ...transactions.map((t) => t.date),
    ...epfEntries.map((e) => e.date),
  ].sort()[0];

  const state = new Map<string, { units: number; invested: number }>();
  for (const i of instruments) state.set(i.id, { units: 0, invested: 0 });
  let ti = 0, ei = 0, epfBalance = 0, epfContrib = 0;
  const cursor = new Map<string, number>(); // per-instrument index into its history
  for (const i of instruments) cursor.set(i.id, 0);

  const rows: Record<string, unknown>[] = [];
  for (let d = firstDate; d <= today; d = addDay(d)) {
    // corporate actions first: an ex-date split grows units held from BEFORE it;
    // trades dated on the ex-date are already post-split (applied just below).
    for (const a of actionsByDate.get(d) ?? []) {
      const st = state.get(a.instrumentId);
      if (st) st.units *= a.factor;
    }
    // apply transactions dated on or before d
    while (ti < transactions.length && transactions[ti].date <= d) {
      const t = transactions[ti++];
      const st = state.get(t.instrument_id);
      if (!st) continue;
      const u = Number(t.units), a = Number(t.amount);
      if (t.type === "sell") {
        const released = st.units > 0 ? u * (st.invested / st.units) : 0;
        st.invested -= released; st.units -= u;
      } else if (t.type === "fee") st.units -= u;
      else { st.units += u; st.invested += a; }
    }
    while (ei < epfEntries.length && epfEntries[ei].date <= d) {
      const e = epfEntries[ei++];
      epfBalance += Number(e.amount);
      if (e.type !== "interest") epfContrib += Number(e.amount);
    }

    const byBucket: Record<string, { invested: number; value: number }> = {};
    const byType: Record<string, { invested: number; value: number }> = {};
    for (const b of BUCKETS) byBucket[b] = { invested: 0, value: 0 };
    for (const t of MARKET_TYPES) byType[t] = { invested: 0, value: 0 };

    let invested = 0, value = 0;
    for (const i of instruments) {
      const st = state.get(i.id)!;
      if (st.units === 0 && st.invested === 0) continue;
      const pts = history.get(i.id) ?? [];
      let k = cursor.get(i.id)!;
      while (k + 1 < pts.length && pts[k + 1].date <= d) k++;
      cursor.set(i.id, k);
      const price = pts.length && pts[k].date <= d ? pts[k].price : null;
      const v = price != null ? st.units * price : st.invested;
      invested += st.invested; value += v;
      byBucket[i.bucket].invested += st.invested; byBucket[i.bucket].value += v;
      byType[i.type].invested += st.invested; byType[i.type].value += v;
    }
    byBucket.retirement.invested += epfContrib;
    byBucket.retirement.value += epfBalance;
    byType.epf = { invested: epfContrib, value: epfBalance };

    rows.push({
      user_id: userId, date: d,
      invested: round2(invested + epfContrib),
      current_value: round2(value + epfBalance),
      by_bucket: byBucket, by_type: byType,
    });
  }

  console.log(`${label}: ${rows.length} days ${firstDate} → ${today}`);
  const first = rows[0], last = rows[rows.length - 1];
  console.log(`   first ₹${Math.round(Number(first.current_value))} · last ₹${Math.round(Number(last.current_value))}`);
  if (DRY) return;

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await s.from("snapshots").upsert(rows.slice(i, i + 500), { onConflict: "user_id,date" });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  console.log(`   wrote ${rows.length} snapshots`);
}

const { data: profiles } = await s.from("profiles").select("id");
for (const p of profiles ?? []) {
  const { data: inst } = await s.from("instruments").select("name").eq("user_id", p.id).limit(1);
  await backfillUser(p.id, `user ${p.id.slice(0, 8)} (${inst?.[0]?.name?.slice(0, 24) ?? "empty"})`);
}
