"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import type { CorporateActionType } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  for (const p of ["/", "/holdings", "/transactions"]) revalidatePath(p);
}

export async function addCorporateAction(input: {
  instrumentId: string;
  type: CorporateActionType;
  exDate: string;
  a: number; // split: new shares · bonus: bonus shares
  b: number; // per this many old / held
  note?: string | null;
}): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { instrumentId, type, exDate, a, b } = input;
  if (type !== "split" && type !== "bonus") return { ok: false, error: "Pick split or bonus." };
  if (!exDate) return { ok: false, error: "Enter the ex-date." };
  if (!(a > 0) || !(b > 0)) return { ok: false, error: "Ratio numbers must be positive." };
  // split "A:B" → A shares replace B (factor A/B). bonus "A:B" → A extra per B held (factor (A+B)/B).
  const factor = type === "split" ? a / b : (a + b) / b;
  if (!isFinite(factor) || factor <= 0) return { ok: false, error: "That ratio doesn't work out." };

  const { data: inst } = await supabase
    .from("instruments")
    .select("id")
    .eq("id", instrumentId)
    .eq("user_id", user.id)
    .single();
  if (!inst) return { ok: false, error: "Instrument not found." };

  const { error } = await supabase.from("corporate_actions").insert({
    user_id: user.id,
    instrument_id: instrumentId,
    type,
    factor,
    ex_date: exDate,
    ratio: `${a}:${b}`,
    note: input.note || null,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That action already exists for this date." : error.message };
  }
  revalidate();
  return { ok: true };
}

export async function deleteCorporateAction(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("corporate_actions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
