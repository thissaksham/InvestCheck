// npsnav.in — NPS scheme NAVs. The NAV endpoint returns a bare number with no
// scheme name, so we also load the scheme directory (code → name) to make NPS
// searchable by name and to label instruments properly.

import { z } from "zod";
import type { FetchResult } from "./types";

const SCHEMES_URL = "https://npsnav.in/api/schemes";

const schemesSchema = z.object({
  data: z.array(z.tuple([z.string(), z.string()]).rest(z.unknown())),
});

export interface NpsScheme {
  code: string;
  name: string;
}

// module-level cache (per warm serverless instance), refreshed daily
let cache: { at: number; rows: NpsScheme[] } | null = null;
const TTL = 24 * 3600 * 1000;

async function loadSchemes(): Promise<NpsScheme[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;
  try {
    const res = await fetch(SCHEMES_URL, { cache: "no-store" });
    if (!res.ok) return cache?.rows ?? [];
    const parsed = schemesSchema.safeParse(await res.json());
    if (!parsed.success) return cache?.rows ?? [];
    const rows = parsed.data.data.map(([code, name]) => ({ code, name }));
    if (rows.length) cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return cache?.rows ?? [];
  }
}

/** Scheme name for a code, e.g. SM007001 → "ICICI PRUDENTIAL ... SCHEME E - TIER I". */
export async function npsSchemeName(code: string): Promise<string | null> {
  const rows = await loadSchemes();
  return rows.find((r) => r.code.toUpperCase() === code.toUpperCase())?.name ?? null;
}

/** Ranked name/code search over the NPS scheme directory. */
export async function searchNpsnav(query: string): Promise<NpsScheme[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await loadSchemes();
  if (!rows.length) return [];

  // Short terms (E / C / G / I / II) must match as whole words — otherwise "e"
  // matches any word containing the letter and Scheme E ranks below noise.
  const matchers = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return t.length <= 2 ? new RegExp(`\\b${esc}\\b`) : new RegExp(esc);
    });

  const scored: { r: NpsScheme; s: number }[] = [];
  for (const r of rows) {
    const code = r.code.toLowerCase();
    const name = r.name.toLowerCase();
    let s = -1;
    if (code === q) s = 0;
    else if (code.startsWith(q)) s = 1;
    else if (name.startsWith(q)) s = 2;
    else if (matchers.every((m) => m.test(name))) s = 3; // all terms match, any order
    if (s >= 0) scored.push({ r, s });
  }
  scored.sort((a, b) => a.s - b.s || a.r.name.length - b.r.name.length);
  return scored.slice(0, 8).map(({ r }) => r);
}

export async function fetchNpsnav(schemeCode: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://npsnav.in/api/${encodeURIComponent(schemeCode)}`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `npsnav ${res.status} for code ${schemeCode}` };
    const text = (await res.text()).trim();
    const price = Number(text);
    if (!isFinite(price) || price <= 0) return { error: `Code ${schemeCode} not found on npsnav` };
    return {
      price,
      asOf: new Date().toISOString().slice(0, 10),
      currency: "INR",
      name: await npsSchemeName(schemeCode),
    };
  } catch (e) {
    return { error: `npsnav fetch failed for ${schemeCode}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
