import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllPrices, fetchUsdInr, isFetchError } from "@/lib/fetchers";
import type { Instrument } from "@/lib/types";

export const maxDuration = 60;

// rate-limit 1 per 5 min per user: in-memory + fetched_at check (§9)
const lastRefresh = new Map<string, number>();
const WINDOW_MS = 5 * 60 * 1000;

export async function POST() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const inMemory = lastRefresh.get(user.id);
  if (inMemory && Date.now() - inMemory < WINDOW_MS) {
    return NextResponse.json({ error: "Refreshed recently — try again in a few minutes." }, { status: 429 });
  }

  const { data: instrumentRows } = await supabase
    .from("instruments")
    .select("id, name, identifier, source")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("identifier", "is", null)
    .neq("source", "manual");
  const instruments = (instrumentRows ?? []) as Pick<Instrument, "id" | "name" | "identifier" | "source">[];

  // survives cold starts: newest fetched_at across this user's prices
  if (!inMemory && instruments.length) {
    const { data: newest } = await supabase
      .from("prices")
      .select("fetched_at")
      .in("instrument_id", instruments.map((i) => i.id))
      .order("fetched_at", { ascending: false })
      .limit(1);
    const latest = newest?.[0]?.fetched_at ? Date.parse(newest[0].fetched_at) : 0;
    if (Date.now() - latest < WINDOW_MS) {
      return NextResponse.json({ error: "Refreshed recently — try again in a few minutes." }, { status: 429 });
    }
  }
  lastRefresh.set(user.id, Date.now());

  const service = createServiceClient();
  const results = await fetchAllPrices(instruments);
  let updated = 0;
  const failed: string[] = [];
  for (const i of instruments) {
    const result = results.get(i.id);
    if (!result || isFetchError(result)) {
      failed.push(i.name); // stale, never zero (§8)
      continue;
    }
    const { error } = await service.from("prices").upsert(
      {
        instrument_id: i.id,
        date: result.asOf,
        price: result.price,
        source: i.source,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "instrument_id,date" }
    );
    if (error) failed.push(i.name);
    else updated++;
  }

  // every manual refresh re-fetches the USDINR rate (§7)
  let fx: number | null = null;
  const fxResult = await fetchUsdInr();
  if (!isFetchError(fxResult)) {
    fx = fxResult.price;
    await service.from("fx_rates").upsert(
      { pair: "USDINR", date: fxResult.asOf, rate: fxResult.price, fetched_at: new Date().toISOString() },
      { onConflict: "pair,date" }
    );
  }

  return NextResponse.json({ updated, failed, fx });
}
