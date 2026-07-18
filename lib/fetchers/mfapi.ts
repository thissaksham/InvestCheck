// MFapi — mutual fund NAVs. Store the price under the NAV's own date, not today's (§8).

import { z } from "zod";
import type { FetchResult } from "./types";

const schema = z.object({
  meta: z
    .object({ scheme_name: z.string().nullish(), scheme_category: z.string().nullish() })
    .partial()
    .nullish(),
  data: z.array(z.object({ date: z.string(), nav: z.string() })).min(1),
});

const searchSchema = z.array(
  z.object({ schemeCode: z.union([z.number(), z.string()]), schemeName: z.string() })
);

export interface MfHit {
  schemeCode: string;
  schemeName: string;
}

export async function searchMfapi(query: string): Promise<MfHit[]> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const parsed = searchSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    // direct plans first — that's what a DIY investor holds
    return parsed.data
      .sort((a, b) => Number(b.schemeName.includes("Direct")) - Number(a.schemeName.includes("Direct")))
      .slice(0, 5)
      .map((h) => ({ schemeCode: String(h.schemeCode), schemeName: h.schemeName }));
  } catch {
    return [];
  }
}

export async function fetchMfapi(schemeCode: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`, {
      cache: "no-store",
    });
    if (!res.ok) return { error: `MFapi ${res.status} for code ${schemeCode}` };
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) return { error: `Code ${schemeCode} not found on MFapi` };

    const { nav, date } = parsed.data.data[0];
    const price = Number(nav);
    if (!isFinite(price) || price <= 0) return { error: `Bad NAV "${nav}" for code ${schemeCode}` };

    // DD-MM-YYYY → YYYY-MM-DD
    const [dd, mm, yyyy] = date.split("-");
    if (!yyyy) return { error: `Bad NAV date "${date}" for code ${schemeCode}` };
    return {
      price,
      asOf: `${yyyy}-${mm}-${dd}`,
      currency: "INR",
      name: parsed.data.meta?.scheme_name,
      category: parsed.data.meta?.scheme_category,
    };
  } catch (e) {
    return { error: `MFapi fetch failed for ${schemeCode}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
