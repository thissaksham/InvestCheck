// One-off: import Zerodha tradebook CSVs as stock/ETF instruments + buy/sell
// transactions for the real user. Dry by default; --commit to write.
//
//   npx tsx scripts/import-zerodha.mts "C:/…/fy 22-23.csv" "C:/…/fy 23-24.csv" …
//   npx tsx scripts/import-zerodha.mts <files…> --commit
//
// Safe to re-run: instruments dedupe by name, transactions dedupe by
// (instrument, date, type, units, amount). Every write is scoped to one user_id.

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bucket, InstrumentType } from "../lib/types";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const s: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const COMMIT = process.argv.includes("--commit");
const RESET = process.argv.includes("--reset"); // clear this import's txns first (scoped)
const EMAIL = "thissaksham@gmail.com"; // the real account
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const files = process.argv.slice(2).filter((a) => a.toLowerCase().endsWith(".csv"));
const round2 = (n: number) => Math.round(n * 100) / 100;

// symbol → how the app should file it. All type "stock" (per user: the logging
// flow makes no stock/ETF distinction). Buckets are still precise — the app's
// auto-classifier only knows gold; liquid would be misfiled as equity.
type Meta = { name: string; type: InstrumentType; bucket: Bucket };
const MAP: Record<string, Meta> = {
  NIFTYBEES:  { name: "Nippon India ETF Nifty 50 BeES",             type: "stock", bucket: "indian_equity" },
  JUNIORBEES: { name: "Nippon India ETF Nifty Next 50 Junior BeES", type: "stock", bucket: "indian_equity" },
  MID150BEES: { name: "Nippon India ETF Nifty Midcap 150",          type: "stock", bucket: "indian_equity" },
  GOLDBEES:   { name: "Nippon India ETF Gold BeES",                 type: "stock", bucket: "gold" },
  GOLDCASE:   { name: "Zerodha Gold ETF",                           type: "stock", bucket: "gold" },
  LIQUIDBEES: { name: "Nippon India ETF Liquid BeES",               type: "stock", bucket: "debt_liquid" },
  LIQUIDCASE: { name: "Zerodha Liquid ETF",                         type: "stock", bucket: "debt_liquid" },
  TATASTEEL:  { name: "Tata Steel",                                 type: "stock", bucket: "indian_equity" },
  IDBI:       { name: "IDBI Bank",                                  type: "stock", bucket: "indian_equity" },
  IDFCFIRSTB: { name: "IDFC First Bank",                            type: "stock", bucket: "indian_equity" },
  THYROCARE:  { name: "Thyrocare Technologies",                     type: "stock", bucket: "indian_equity" },
  TRIDENT:    { name: "Trident",                                    type: "stock", bucket: "indian_equity" },
};

type Trade = { symbol: string; date: string; type: "buy" | "sell"; units: number; amount: number; at: string; tradeId: string };

function parse(path: string): Trade[] {
  const lines = readFileSync(path, "utf8").split("\n").slice(1);
  const out: Trade[] = [];
  for (const raw of lines) {
    const c = raw.trim().split(",");
    if (c.length < 13 || !c[0]) continue;
    const [symbol, , date, , , , type, , qty, price, tradeId, , at] = c;
    if (type !== "buy" && type !== "sell") continue;
    const units = Number(qty);
    const p = Number(price);
    if (!(units > 0) || !(p > 0)) continue;
    out.push({ symbol, date, type, units, amount: round2(units * p), at, tradeId });
  }
  return out;
}

async function yahooLatest(symbol: string): Promise<{ price: number; date: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!res.ok) return null;
    const j: any = await res.json();
    const r = j?.chart?.result?.[0];
    const ts: number[] = r?.timestamp ?? [];
    const close: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    for (let i = ts.length - 1; i >= 0; i--) {
      if (close[i] != null) return { price: close[i]!, date: new Date(ts[i] * 1000).toISOString().slice(0, 10) };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- run ----------

if (!files.length) {
  console.error("Pass the CSV file paths as arguments.");
  process.exit(1);
}

// resolve the real user
const { data: list } = await s.auth.admin.listUsers();
const user = list.users.find((u) => u.email?.toLowerCase() === EMAIL);
if (!user) {
  console.error(`No auth user with email ${EMAIL}`);
  process.exit(1);
}
const userId = user.id;
console.log(`Target: ${EMAIL}  (${userId})`);
console.log(`Mode:   ${COMMIT ? "COMMIT (writing)" : "DRY RUN (no writes)"}\n`);

// parse all trades
const trades = files.flatMap(parse);
const unknown = [...new Set(trades.filter((t) => !MAP[t.symbol]).map((t) => t.symbol))];
if (unknown.length) {
  console.error(`Unmapped symbols (add to MAP): ${unknown.join(", ")}`);
  process.exit(1);
}
const symbols = [...new Set(trades.map((t) => t.symbol))].sort();

// existing state for this user
const { data: existingInst } = await s.from("instruments").select("id,name").eq("user_id", userId);
const byName = new Map((existingInst ?? []).map((i: any) => [i.name, i.id as string]));

// per-symbol summary
console.log("symbol      type   bucket         buys  sells   net units      buy ₹        sell ₹");
console.log("─".repeat(90));
let totalTxns = 0;
for (const sym of symbols) {
  const ts = trades.filter((t) => t.symbol === sym);
  const buys = ts.filter((t) => t.type === "buy");
  const sells = ts.filter((t) => t.type === "sell");
  const net = buys.reduce((a, t) => a + t.units, 0) - sells.reduce((a, t) => a + t.units, 0);
  const buyRs = buys.reduce((a, t) => a + t.amount, 0);
  const sellRs = sells.reduce((a, t) => a + t.amount, 0);
  const m = MAP[sym];
  const exists = byName.has(m.name) ? " (exists)" : "";
  totalTxns += ts.length;
  console.log(
    `${sym.padEnd(11)} ${m.type.padEnd(6)} ${m.bucket.padEnd(14)} ${String(buys.length).padStart(4)} ${String(sells.length).padStart(6)} ${net.toFixed(3).padStart(11)} ${buyRs.toFixed(0).padStart(11)} ${sellRs.toFixed(0).padStart(12)}  ${m.name}${exists}`
  );
}
console.log("─".repeat(90));
console.log(`${symbols.length} instruments · ${totalTxns} transactions\n`);

if (!COMMIT) {
  console.log("Dry run only. Re-run with --commit to write.");
  process.exit(0);
}

// ---------- write ----------
const instId = new Map<string, string>(); // symbol → instrument id
for (const sym of symbols) {
  const m = MAP[sym];
  if (byName.has(m.name)) {
    instId.set(sym, byName.get(m.name)!);
    console.log(`= ${m.name} (existing)`);
    continue;
  }
  const { data, error } = await s
    .from("instruments")
    .insert({
      user_id: userId,
      name: m.name,
      type: m.type,
      bucket: m.bucket,
      identifier: `${sym}.NS`,
      currency: "INR",
      source: "yahoo",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`instrument ${sym}: ${error.message}`);
  instId.set(sym, data.id as string);
  console.log(`+ ${m.name}`);
}

// optional scoped reset — clears ONLY this import's transactions (these
// instrument ids, this user), so a re-run starts clean without touching MF/EPF/NPS.
if (RESET) {
  const ids = [...instId.values()];
  const { error } = await s.from("transactions").delete().eq("user_id", userId).in("instrument_id", ids);
  if (error) throw new Error(`reset: ${error.message}`);
  console.log(`reset: cleared existing transactions for ${ids.length} instruments`);
}

// transactions — idempotent on Zerodha's unique trade_id (stored in note), so
// genuinely-distinct fills that look identical are never collapsed.
const { data: existingTxns } = await s.from("transactions").select("note").eq("user_id", userId);
const seen = new Set(
  (existingTxns ?? []).map((t: any) => t.note as string).filter((n) => n?.startsWith("zerodha:"))
);

const rows = trades
  .map((t) => ({
    user_id: userId,
    instrument_id: instId.get(t.symbol)!,
    date: t.date,
    type: t.type,
    units: t.units,
    amount: t.amount,
    amount_usd: null,
    contributor: null,
    note: `zerodha:${t.tradeId}`,
    created_at: t.at.length === 19 ? `${t.at}+05:30` : t.at, // IST execution time → intra-day order
  }))
  .filter((r) => {
    if (seen.has(r.note)) return false;
    seen.add(r.note);
    return true;
  });

console.log(`\nInserting ${rows.length} transactions (${trades.length - rows.length} skipped as duplicates)…`);
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await s.from("transactions").insert(rows.slice(i, i + 500));
  if (error) throw new Error(`txns: ${error.message}`);
}

// price them now so holdings value immediately
console.log(`\nFetching latest prices…`);
for (const sym of symbols) {
  const latest = await yahooLatest(`${sym}.NS`);
  if (!latest) {
    console.log(`  ! ${sym}.NS — no Yahoo price (will value at cost until a refresh)`);
    continue;
  }
  const { error } = await s.from("prices").upsert(
    { instrument_id: instId.get(sym)!, date: latest.date, price: latest.price, source: "yahoo", fetched_at: new Date().toISOString() },
    { onConflict: "instrument_id,date" }
  );
  if (error) console.log(`  ! ${sym} price upsert: ${error.message}`);
  else console.log(`  ✓ ${sym.padEnd(11)} ₹${latest.price} (${latest.date})`);
}

console.log(`\nDone. Run  npx tsx scripts/backfill-history.mts  to rebuild the history chart.`);
