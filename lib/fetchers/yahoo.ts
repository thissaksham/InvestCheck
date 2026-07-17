// Yahoo Finance — stocks & ETFs (NSE via '.NS', US bare) and FX ('USDINR=X').
// Server-only. Sole market-data source by decision (§8).

import { z } from "zod";
import type { FetchResult } from "./types";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            regularMarketPrice: z.number().nullish(),
            regularMarketTime: z.number().nullish(),
            currency: z.string().nullish(),
            instrumentType: z.string().nullish(),
            longName: z.string().nullish(),
            shortName: z.string().nullish(),
          }),
          indicators: z
            .object({
              quote: z.array(z.object({ close: z.array(z.number().nullable()).nullish() }).partial()),
            })
            .partial()
            .nullish(),
          timestamp: z.array(z.number()).nullish(),
        })
      )
      .nullable(),
  }),
});

async function fetchOnce(symbol: string): Promise<Response> {
  return fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
    { headers: { "User-Agent": UA }, cache: "no-store" }
  );
}

export async function fetchYahoo(symbol: string): Promise<FetchResult> {
  try {
    let res = await fetchOnce(symbol);
    // on 429 → backoff 2s/4s/8s, then give up (stale)
    for (const delay of [2000, 4000, 8000]) {
      if (res.status !== 429) break;
      await sleep(delay);
      res = await fetchOnce(symbol);
    }
    if (!res.ok) return { error: `Yahoo ${res.status} for ${symbol}` };

    const parsed = chartSchema.safeParse(await res.json());
    if (!parsed.success) return { error: `Yahoo shape drift for ${symbol}` };
    const result = parsed.data.chart.result?.[0];
    if (!result) return { error: `No Yahoo result for ${symbol}` };

    let price = result.meta.regularMarketPrice ?? null;
    if (price == null) {
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      price = [...closes].reverse().find((c) => c != null) ?? null;
    }
    if (price == null) return { error: `No price in Yahoo response for ${symbol}` };

    // store under the market date (weekends return Friday's close, §14)
    const asOf = result.meta.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return {
      price,
      asOf,
      currency: result.meta.currency,
      quoteType: result.meta.instrumentType,
      name: result.meta.longName ?? result.meta.shortName,
    };
  } catch (e) {
    return { error: `Yahoo fetch failed for ${symbol}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Batches of 5 concurrent, 300ms jitter between batches (§8). */
export async function fetchYahooBatch(symbols: string[]): Promise<Map<string, FetchResult>> {
  const out = new Map<string, FetchResult>();
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const results = await Promise.all(batch.map(fetchYahoo));
    batch.forEach((s, j) => out.set(s, results[j]));
    if (i + 5 < symbols.length) await sleep(300 + Math.random() * 300);
  }
  return out;
}

export const fetchUsdInr = () => fetchYahoo("USDINR=X");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
