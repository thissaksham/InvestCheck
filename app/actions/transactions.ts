"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { transactionSchema, type TransactionInput } from "@/lib/schemas";
import { formatUnits } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; duplicate: true };

const LEDGER_PATHS = ["/", "/holdings", "/transactions", "/retirement"];

function revalidateLedger() {
  for (const p of LEDGER_PATHS) revalidatePath(p);
}

async function heldUnits(
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"],
  userId: string,
  instrumentId: string,
  excludeTxnId?: string
): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id, type, units")
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId);
  return ((data ?? []) as Pick<Transaction, "id" | "type" | "units">[])
    .filter((t) => t.id !== excludeTxnId)
    .reduce((s, t) => s + (t.type === "sell" ? -Number(t.units) : Number(t.units)), 0);
}

export async function logTransaction(input: TransactionInput): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const t = parsed.data;

  if (t.type === "sell") {
    const held = await heldUnits(supabase, user.id, t.instrument_id);
    if (t.units > held + 1e-9) {
      return { ok: false, error: `You hold ${formatUnits(held)} units — can't sell ${formatUnits(t.units)}.` };
    }
  }

  // duplicate quick-adds (§14): same instrument+amount+date within 1 min → confirm
  if (!t.force) {
    const { data: dupes } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("instrument_id", t.instrument_id)
      .eq("amount", t.amount)
      .eq("date", t.date)
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .limit(1);
    if (dupes?.length) return { ok: false, duplicate: true };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    instrument_id: t.instrument_id,
    date: t.date,
    type: t.type,
    units: t.units ?? 0,
    amount: t.amount,
    amount_usd: t.amount_usd ?? null,
    note: t.note || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateLedger();
  return { ok: true };
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const t = parsed.data;

  if (t.type === "sell") {
    const held = await heldUnits(supabase, user.id, t.instrument_id, id);
    if (t.units > held + 1e-9) {
      return { ok: false, error: `You hold ${formatUnits(held)} units — can't sell ${formatUnits(t.units)}.` };
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      date: t.date,
      type: t.type,
      units: t.units ?? 0,
      amount: t.amount,
      amount_usd: t.amount_usd ?? null,
      note: t.note || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateLedger();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateLedger();
  return { ok: true };
}
