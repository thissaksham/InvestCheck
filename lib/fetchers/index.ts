import type { Instrument, PriceSource } from "@/lib/types";
import { fetchMfapi } from "./mfapi";
import { fetchNpsnav } from "./npsnav";
import { fetchUsdInr, fetchYahoo, fetchYahooBatch } from "./yahoo";
import { isFetchError, type FetchResult } from "./types";

export { isFetchError, fetchYahoo, fetchYahooBatch, fetchMfapi, fetchNpsnav, fetchUsdInr };
export type { FetchResult };

export async function fetchBySource(source: PriceSource, identifier: string): Promise<FetchResult> {
  switch (source) {
    case "yahoo":
      return fetchYahoo(identifier);
    case "mfapi":
      return fetchMfapi(identifier);
    case "npsnav":
      return fetchNpsnav(identifier);
    case "manual":
      return { error: "Manual instruments are not fetched" };
  }
}

/**
 * Fetch latest prices for a set of instruments: yahoo symbols batched with
 * jitter (§8), mfapi/npsnav sequential (hobby APIs — be gentle).
 * Returns results keyed by instrument id.
 */
export async function fetchAllPrices(
  instruments: Pick<Instrument, "id" | "identifier" | "source">[]
): Promise<Map<string, FetchResult>> {
  const out = new Map<string, FetchResult>();
  const fetchable = instruments.filter((i) => i.identifier && i.source !== "manual");

  const yahooInstruments = fetchable.filter((i) => i.source === "yahoo");
  const yahooResults = await fetchYahooBatch([...new Set(yahooInstruments.map((i) => i.identifier!))]);
  for (const i of yahooInstruments) out.set(i.id, yahooResults.get(i.identifier!)!);

  for (const i of fetchable.filter((x) => x.source === "mfapi")) {
    out.set(i.id, await fetchMfapi(i.identifier!));
  }
  for (const i of fetchable.filter((x) => x.source === "npsnav")) {
    out.set(i.id, await fetchNpsnav(i.identifier!));
  }
  return out;
}
