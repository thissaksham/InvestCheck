"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { manualPriceSchema } from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Manual price override (§4.7): writes a `prices` row with source='manual'.
 * `prices` is not user-writable under RLS, so after verifying the instrument
 * belongs to the caller we write with the service client.
 */
export async function setManualPrice(input: {
  instrument_id: string;
  price: number;
  date: string;
}): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = manualPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data: instrument } = await supabase
    .from("instruments")
    .select("id")
    .eq("id", parsed.data.instrument_id)
    .eq("user_id", user.id)
    .single();
  if (!instrument) return { ok: false, error: "Instrument not found" };

  const service = createServiceClient();
  const { error } = await service.from("prices").upsert(
    {
      instrument_id: parsed.data.instrument_id,
      date: parsed.data.date,
      price: parsed.data.price,
      source: "manual",
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "instrument_id,date" }
  );
  if (error) return { ok: false, error: error.message };
  for (const p of ["/", "/holdings", "/settings", "/retirement"]) revalidatePath(p);
  return { ok: true };
}
