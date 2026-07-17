import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllPrices, fetchUsdInr, isFetchError } from "@/lib/fetchers";
import type { Instrument } from "@/lib/types";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: instrumentRows } = await service
    .from("instruments")
    .select("id, name, identifier, source")
    .eq("is_active", true)
    .not("identifier", "is", null)
    .neq("source", "manual");
  const instruments = (instrumentRows ?? []) as Pick<Instrument, "id" | "name" | "identifier" | "source">[];

  const results = await fetchAllPrices(instruments);
  let updated = 0;
  const failed: string[] = [];
  for (const i of instruments) {
    const result = results.get(i.id);
    if (!result || isFetchError(result)) {
      failed.push(i.name); // a failed fetch never overwrites — stale badge instead (§8)
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
