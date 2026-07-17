"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { depositSchema, type DepositInput } from "@/lib/schemas";
import type { FixedDeposit } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

function toRow(input: DepositInput) {
  const { rate_pct, ...rest } = input;
  return {
    ...rest,
    rate: rate_pct / 100,
    start_date: rest.start_date || null,
    maturity_amount: rest.maturity_amount ?? null,
    monthly_payout: rest.payout === "monthly" ? rest.monthly_payout ?? null : null,
    note: rest.note || null,
  };
}

function revalidateDeposits() {
  revalidatePath("/deposits");
  revalidatePath("/");
}

export async function addDeposit(input: DepositInput): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase.from("fixed_deposits").insert({ ...toRow(parsed.data), user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidateDeposits();
  return { ok: true };
}

export async function updateDeposit(id: string, input: DepositInput): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("fixed_deposits")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateDeposits();
  return { ok: true };
}

/**
 * Renew: insert child (active), link parent (status='renewed', renewed_into=child).
 * ponytail: two-step with compensating delete instead of a DB transaction —
 * single-user tool; add an RPC if this ever bites.
 */
export async function renewDeposit(parentId: string, child: DepositInput): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = depositSchema.safeParse(child);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data: parent } = await supabase
    .from("fixed_deposits")
    .select("id, status")
    .eq("id", parentId)
    .eq("user_id", user.id)
    .single();
  if (!parent) return { ok: false, error: "Deposit not found" };
  if (parent.status === "renewed") return { ok: false, error: "Already renewed." };

  const { data: inserted, error: insertError } = await supabase
    .from("fixed_deposits")
    .insert({ ...toRow(parsed.data), user_id: user.id, status: "active" })
    .select("id")
    .single();
  if (insertError || !inserted) return { ok: false, error: insertError?.message ?? "Insert failed" };

  const { error: linkError } = await supabase
    .from("fixed_deposits")
    .update({ status: "renewed", renewed_into: inserted.id })
    .eq("id", parentId)
    .eq("user_id", user.id);
  if (linkError) {
    await supabase.from("fixed_deposits").delete().eq("id", inserted.id).eq("user_id", user.id);
    return { ok: false, error: linkError.message };
  }
  revalidateDeposits();
  return { ok: true };
}

export async function markMatured(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("fixed_deposits")
    .update({ status: "matured" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateDeposits();
  return { ok: true };
}

export async function deleteDeposit(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // keep chains intact: unlink any parent pointing at this row first
  const { data: parents } = await supabase
    .from("fixed_deposits")
    .select("id")
    .eq("renewed_into", id)
    .eq("user_id", user.id);
  for (const p of (parents ?? []) as Pick<FixedDeposit, "id">[]) {
    await supabase.from("fixed_deposits").update({ renewed_into: null }).eq("id", p.id).eq("user_id", user.id);
  }
  const { error } = await supabase.from("fixed_deposits").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateDeposits();
  return { ok: true };
}
