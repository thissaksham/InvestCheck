// Shared portfolio loader — one place every screen gets its rows + positions from.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EpfEntry, FxRate, Instrument, PriceRow, Transaction } from "./types";
import { computePositions, epfByComponent, type Fx, type LatestPrice, type Position } from "./valuation";

export interface Portfolio {
  instruments: Instrument[];
  transactions: Transaction[]; // date desc
  positions: Position[];
  latestPrices: Map<string, LatestPrice>;
  /** instrument id → last ~30d of prices, ascending (sparklines). */
  priceHistory: Map<string, { date: string; price: number }[]>;
  fx: Fx | null;
  epfEntries: EpfEntry[]; // date asc
  epf: ReturnType<typeof epfByComponent>;
  lastFetchedAt: string | null;
}

export async function getPortfolio(supabase: SupabaseClient, userId: string): Promise<Portfolio> {
  // ponytail: prices capped + deduped in JS; move to a DISTINCT ON rpc if
  // instruments × history ever exceeds the cap. The !inner join keeps the
  // query independent of the instruments result so all five run in parallel.
  const [instrumentsRes, txnsRes, fxRes, epfRes, pricesRes] = await Promise.all([
    supabase.from("instruments").select("*").eq("user_id", userId).order("name"),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("fx_rates").select("*").eq("pair", "USDINR").order("date", { ascending: false }).limit(1),
    supabase.from("epf_entries").select("*").eq("user_id", userId).order("date").order("created_at"),
    supabase
      .from("prices")
      .select("*, instruments!inner(user_id)")
      .eq("instruments.user_id", userId)
      .order("date", { ascending: false })
      .limit(5000),
  ]);

  const instruments = (instrumentsRes.data ?? []) as Instrument[];
  const transactions = (txnsRes.data ?? []) as Transaction[];
  const fxRow = (fxRes.data?.[0] as FxRate | undefined) ?? null;
  const fx: Fx | null = fxRow ? { rate: Number(fxRow.rate), date: fxRow.date } : null;
  const epfEntries = (epfRes.data ?? []) as EpfEntry[];
  const priceRows = (pricesRes.data ?? []) as PriceRow[];

  const latestPrices = new Map<string, LatestPrice>();
  const priceHistory = new Map<string, { date: string; price: number }[]>();
  const cutoff = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  let lastFetchedAt: string | null = null;
  for (const row of priceRows) {
    const price = Number(row.price);
    if (!latestPrices.has(row.instrument_id)) {
      latestPrices.set(row.instrument_id, { price, date: row.date, source: row.source });
    }
    if (row.date >= cutoff) {
      const list = priceHistory.get(row.instrument_id) ?? [];
      list.push({ date: row.date, price });
      priceHistory.set(row.instrument_id, list);
    }
    if (!lastFetchedAt || row.fetched_at > lastFetchedAt) lastFetchedAt = row.fetched_at;
  }
  for (const list of priceHistory.values()) list.reverse(); // ascending

  const positions = computePositions(instruments, transactions, latestPrices, fx);

  return {
    instruments,
    transactions,
    positions,
    latestPrices,
    priceHistory,
    fx,
    epfEntries,
    epf: epfByComponent(epfEntries),
    lastFetchedAt,
  };
}
