"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { instrumentSchema, type InstrumentInput } from "@/lib/schemas";
import { fetchBySource, fetchMfapi, fetchNpsnav, fetchYahoo, isFetchError } from "@/lib/fetchers";
import { createServiceClient } from "@/lib/supabase/service";
import { searchMfapi } from "@/lib/fetchers/mfapi";
import { searchYahoo } from "@/lib/fetchers/yahoo";
import { searchNse } from "@/lib/fetchers/nse";
import { searchNpsnav } from "@/lib/fetchers/npsnav";
import type { Bucket, Currency, Instrument, InstrumentType, PriceSource } from "@/lib/types";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function revalidateAll() {
  for (const p of ["/", "/holdings", "/transactions", "/retirement", "/settings"]) revalidatePath(p);
}

export async function addInstrument(input: InstrumentInput): Promise<Result<Instrument>> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = instrumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("instruments")
    .insert({ ...parsed.data, identifier: parsed.data.identifier || null, user_id: user.id })
    .select()
    .single();
  if (error) {
    return { ok: false, error: error.code === "23505" ? "You already have an instrument with this name." : error.message };
  }

  const instrument = data as Instrument;
  // Fetch + store the price now so the holding is valued immediately, instead
  // of showing "—" until the nightly cron or a manual refresh runs.
  await storePrice(instrument);

  revalidateAll();
  return { ok: true, data: instrument };
}

/** Fetch an instrument's price and upsert it. `prices` is service-role only. */
async function storePrice(instrument: Instrument): Promise<void> {
  if (!instrument.identifier || instrument.source === "manual") return;
  try {
    const result = await fetchBySource(instrument.source, instrument.identifier);
    if (isFetchError(result)) return; // stale-not-zero: leave it unpriced
    const service = createServiceClient();
    await service.from("prices").upsert(
      {
        instrument_id: instrument.id,
        date: result.asOf,
        price: result.price,
        source: instrument.source,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "instrument_id,date" }
    );
  } catch {
    // never block adding an instrument on a price fetch
  }
}

export async function updateInstrument(
  id: string,
  input: Partial<InstrumentInput> & { is_active?: boolean }
): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = instrumentSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const patch: Record<string, unknown> = { ...parsed.data };
  if ("identifier" in patch) patch.identifier = patch.identifier || null;
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("instruments")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  // a corrected identifier should price the holding right away
  if ("identifier" in patch && data) await storePrice(data as Instrument);
  revalidateAll();
  return { ok: true };
}

/** Deleting an instrument cascades its transactions — requires typing its name (§14). */
export async function deleteInstrument(id: string, confirmName: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: instrument } = await supabase
    .from("instruments")
    .select("name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!instrument) return { ok: false, error: "Instrument not found" };
  if (instrument.name !== confirmName) return { ok: false, error: "Name doesn't match — nothing deleted." };

  const { error } = await supabase.from("instruments").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export interface InstrumentHit {
  label: string;
  sub: string; // "NSE · Stock" | "NASDAQ · ETF" | "Mutual fund"
  identifier: string;
  group: "market" | "mf";
}

/** Categories the Log picker scopes search by. */
export type SearchCategory = "equity_in" | "equity_us" | "mutual_fund" | "nps";

const isIndian = (exchange: string, symbol: string) =>
  exchange === "NSI" || exchange === "BSE" || /\.(NS|BO)$/i.test(symbol);

/** Name search across Yahoo (stocks/ETFs) + MFapi (funds), optionally scoped. */
export async function searchInstruments(
  query: string,
  category?: SearchCategory
): Promise<{ ok: true; hits: InstrumentHit[] } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const q = query.trim();
  if (q.length < 2) return { ok: true, hits: [] };

  // NPS: search the npsnav scheme directory by name or code
  if (category === "nps") {
    const schemes = await searchNpsnav(q);
    return {
      ok: true,
      hits: schemes.map((s) => ({
        label: s.name,
        sub: `NPS · ${s.code}`,
        identifier: s.code,
        group: "market" as const,
      })),
    };
  }

  // Indian equities: NSE's own list has the coverage Yahoo search lacks
  // (small-caps, SME, recent listings). Yahoo still prices them via SYMBOL.NS.
  if (category === "equity_in") {
    const nse = await searchNse(q);
    if (nse.length) {
      return {
        ok: true,
        hits: nse.map((h) => ({
          label: h.name,
          sub: `NSE · ${h.symbol}`,
          identifier: `${h.symbol}.NS`,
          group: "market" as const,
        })),
      };
    }
    // NSE list unreachable — fall back to Yahoo's Indian hits
    const y = (await searchYahoo(q)).filter((h) => isIndian(h.exchange, h.symbol));
    return { ok: true, hits: y.map(toYahooHit) };
  }

  const wantYahoo = !category || category === "equity_us";
  const wantMf = !category || category === "mutual_fund";
  const [yahooRaw, mf] = await Promise.all([
    wantYahoo ? searchYahoo(q) : Promise.resolve([]),
    wantMf ? searchMfapi(q) : Promise.resolve([]),
  ]);
  const yahoo = category === "equity_us" ? yahooRaw.filter((h) => !isIndian(h.exchange, h.symbol)) : yahooRaw;

  const hits: InstrumentHit[] = [
    ...yahoo.map(toYahooHit),
    ...mf.map((h) => ({
      label: h.schemeName,
      sub: "Mutual fund",
      identifier: h.schemeCode,
      group: "mf" as const,
    })),
  ];
  return { ok: true, hits };
}

function toYahooHit(h: { name: string; symbol: string; quoteType: string; exchange: string; exchDisp: string }): InstrumentHit {
  return {
    label: h.name,
    sub: `${h.exchDisp || h.exchange} · ${h.quoteType === "ETF" ? "ETF" : "Stock"} · ${h.symbol}`,
    identifier: h.symbol,
    group: "market" as const,
  };
}

export interface DetectedInstrument {
  identifier: string; // as resolved (e.g. RELIANCE → RELIANCE.NS)
  source: PriceSource;
  type: InstrumentType;
  currency: Currency;
  bucket: Bucket;
  name: string | null;
  price: number;
  asOf: string;
}

/**
 * One identifier in → everything else out. The source APIs already know the
 * name, currency, kind and category — the user shouldn't be asked for them.
 *   6-digit number → MFapi scheme code (bucket from scheme_category)
 *   SMxxxxxx       → npsnav NPS scheme (retirement)
 *   anything else  → Yahoo ticker (.NS retried automatically; stock/etf +
 *                    currency from the quote; USD → intl_equity)
 */
export async function detectInstrument(
  raw: string
): Promise<{ ok: true; data: DetectedInstrument } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const id = raw.trim();
  if (!id) return { ok: false, error: "Enter a ticker or scheme code" };

  // MFapi scheme code
  if (/^\d{4,7}$/.test(id)) {
    const r = await fetchMfapi(id);
    if (isFetchError(r)) return { ok: false, error: r.error };
    return {
      ok: true,
      data: {
        identifier: id,
        source: "mfapi",
        type: "mutual_fund",
        currency: "INR",
        bucket: bucketForMf(`${r.category ?? ""} ${r.name ?? ""}`),
        name: r.name ?? null,
        price: r.price,
        asOf: r.asOf,
      },
    };
  }

  // NPS scheme code
  if (/^SM\d+$/i.test(id)) {
    const code = id.toUpperCase();
    const r = await fetchNpsnav(code);
    if (isFetchError(r)) return { ok: false, error: r.error };
    return {
      ok: true,
      data: {
        identifier: code,
        source: "npsnav",
        type: "nps",
        currency: "INR",
        bucket: "retirement",
        name: r.name ?? null, // resolved from the npsnav scheme directory
        price: r.price,
        asOf: r.asOf,
      },
    };
  }

  // Yahoo ticker — retry with .NS for bare Indian tickers
  let symbol = id.toUpperCase();
  let r = await fetchYahoo(symbol);
  if (isFetchError(r) && /^[A-Z0-9&-]+$/.test(symbol) && !symbol.includes(".")) {
    const ns = `${symbol}.NS`;
    const retry = await fetchYahoo(ns);
    if (!isFetchError(retry)) {
      r = retry;
      symbol = ns;
    }
  }
  if (isFetchError(r)) {
    return { ok: false, error: `${r.error}. NSE tickers end with .NS (RELIANCE.NS); MF codes are numeric.` };
  }

  const quoteCurrency = (r.currency ?? (symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "INR" : "USD")).toUpperCase();
  if (quoteCurrency !== "INR" && quoteCurrency !== "USD") {
    return { ok: false, error: `${symbol} trades in ${quoteCurrency} — only INR and USD are supported.` };
  }
  const text = `${r.name ?? ""} ${symbol}`.toLowerCase();
  // yahoo reports Indian ETFs (NIFTYBEES etc.) as EQUITY — fall back to the name
  const looksEtf = r.quoteType === "ETF" || /\b(etf|bees)\b/.test(text);
  return {
    ok: true,
    data: {
      identifier: symbol,
      source: "yahoo",
      type: looksEtf ? "etf" : "stock",
      currency: quoteCurrency,
      bucket: quoteCurrency === "USD" ? "intl_equity" : /gold|silver/.test(text) ? "gold" : "indian_equity",
      name: r.name ?? null,
      price: r.price,
      asOf: r.asOf,
    },
  };
}

function bucketForMf(text: string): Bucket {
  const t = text.toLowerCase();
  if (/gold|silver/.test(t)) return "gold";
  if (/debt|liquid|money market|overnight|gilt|bond|banking and psu|corporate|credit risk|floater|duration|ultra short|treasury|arbitrage/.test(t)) {
    return "debt_liquid";
  }
  if (/international|overseas|global|nasdaq|s&p|world|us equity/.test(t)) return "intl_equity";
  return "indian_equity"; // equity & hybrid — closest bucket in the schema
}
