// Indian equity name search backed by NSE's own security lists. Yahoo's search
// misses many Indian listings (small-caps, recent/SME) even though it can PRICE
// them via SYMBOL.NS — so we search NSE's canonical name→symbol list ourselves
// and hand the ticker to Yahoo for pricing.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const LIST_URLS = [
  "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
  "https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv", // SME/EMERGE
];

interface NseRow {
  symbol: string;
  name: string;
}

// module-level cache (per warm serverless instance), refreshed daily
let cache: { at: number; rows: NseRow[] } | null = null;
const TTL = 24 * 3600 * 1000;

async function loadList(): Promise<NseRow[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;
  const rows: NseRow[] = [];
  for (const url of LIST_URLS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      // SYMBOL, NAME OF COMPANY, SERIES, ... — symbol never has a comma; NSE
      // names effectively never do either, so a naive split is fine here.
      for (const line of text.split(/\r?\n/).slice(1)) {
        const comma = line.indexOf(",");
        if (comma < 1) continue;
        const symbol = line.slice(0, comma).trim();
        const name = line.slice(comma + 1).split(",")[0].trim();
        if (symbol && name) rows.push({ symbol, name });
      }
    } catch {
      // ignore — try the next list, fall back to any prior cache
    }
  }
  if (rows.length) cache = { at: Date.now(), rows };
  return rows.length ? rows : (cache?.rows ?? []);
}

export interface NseHit {
  symbol: string;
  name: string;
}

/** Ranked name/symbol search over the NSE lists. Empty if the lists can't load. */
export async function searchNse(query: string): Promise<NseHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await loadList();
  if (!rows.length) return [];

  const qn = q.replace(/\s+/g, "");
  const scored: { r: NseRow; s: number }[] = [];
  for (const r of rows) {
    const sym = r.symbol.toLowerCase();
    const name = r.name.toLowerCase();
    const nameNs = name.replace(/\s+/g, "");
    let s = -1;
    if (sym === q || sym === qn) s = 0;
    else if (sym.startsWith(qn)) s = 1;
    else if (name.startsWith(q)) s = 2;
    else if (nameNs.startsWith(qn)) s = 3;
    else if (name.includes(q)) s = 4;
    else if (nameNs.includes(qn)) s = 5;
    if (s >= 0) scored.push({ r, s });
  }
  scored.sort((a, b) => a.s - b.s || a.r.name.length - b.r.name.length);
  return scored.slice(0, 8).map(({ r }) => ({ symbol: r.symbol, name: r.name }));
}
