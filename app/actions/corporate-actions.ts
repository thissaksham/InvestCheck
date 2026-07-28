"use server";

// Splits & bonuses: applied straight onto the transactions. Every buy/sell
// dated before the ex-date gets its units multiplied; the ₹ amount is untouched
// (a split doesn't change money invested, it just spreads it over more units).

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import type { CorporateActionType, Transaction } from "@/lib/types";

type Result = { ok: true; adjusted: number } | { ok: false; error: string };

export async function applyCorporateAction(input: {
  instrumentId: string;
  type: CorporateActionType;
  exDate: string;
  a: number; // split: new shares · bonus: bonus shares
  b: number; // per this many old / held
}): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { instrumentId, type, exDate, a, b } = input;
  if (type !== "split" && type !== "bonus") return { ok: false, error: "Pick split or bonus." };
  if (!exDate) return { ok: false, error: "Enter the ex-date." };
  if (!(a > 0) || !(b > 0)) return { ok: false, error: "Ratio numbers must be positive." };
  // split A:B → A shares replace B (×A/B). bonus A:B → A extra per B held (×(A+B)/B).
  const factor = type === "split" ? a / b : (a + b) / b;
  if (!isFinite(factor) || factor <= 0) return { ok: false, error: "That ratio doesn't work out." };

  // trades on the ex-date already trade post-split, so only strictly-earlier ones move
  const { data, error } = await supabase
    .from("transactions")
    .select("id, units")
    .eq("user_id", user.id)
    .eq("instrument_id", instrumentId)
    .lt("date", exDate);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Pick<Transaction, "id" | "units">[];
  if (rows.length === 0) return { ok: false, error: "No transactions before that date — nothing to adjust." };

  for (const r of rows) {
    const { error: upErr } = await supabase
      .from("transactions")
      .update({ units: Number(r.units) * factor })
      .eq("id", r.id)
      .eq("user_id", user.id);
    if (upErr) return { ok: false, error: upErr.message };
  }

  for (const p of ["/", "/holdings", "/transactions"]) revalidatePath(p);
  return { ok: true, adjusted: rows.length };
}
