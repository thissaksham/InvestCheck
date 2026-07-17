// npsnav.in — NPS scheme NAVs. Returns a plain-text number (§8).

import type { FetchResult } from "./types";

export async function fetchNpsnav(schemeCode: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://npsnav.in/api/${encodeURIComponent(schemeCode)}`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `npsnav ${res.status} for code ${schemeCode}` };
    const text = (await res.text()).trim();
    const price = Number(text);
    if (!isFinite(price) || price <= 0) return { error: `Code ${schemeCode} not found on npsnav` };
    return { price, asOf: new Date().toISOString().slice(0, 10) };
  } catch (e) {
    return { error: `npsnav fetch failed for ${schemeCode}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
