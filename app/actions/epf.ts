"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { epfEntrySchema, epfRecurringSchema, type EpfEntryInput, type EpfRecurringInput } from "@/lib/schemas";
import { materializeEpfRecurring } from "@/lib/epf-recurring";
import { todayIST } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

function revalidateEpf() {
  revalidatePath("/retirement");
  revalidatePath("/");
}

export async function addEpfEntry(input: EpfEntryInput): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = epfEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // only 'adjustment' may be negative
  if (parsed.data.amount < 0 && parsed.data.type !== "adjustment") {
    return { ok: false, error: "Only adjustments can be negative." };
  }

  const { error } = await supabase
    .from("epf_entries")
    .insert({ ...parsed.data, note: parsed.data.note || null, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}

export async function updateEpfEntry(id: string, input: EpfEntryInput): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = epfEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.amount < 0 && parsed.data.type !== "adjustment") {
    return { ok: false, error: "Only adjustments can be negative." };
  }

  const { error } = await supabase
    .from("epf_entries")
    .update({ ...parsed.data, note: parsed.data.note || null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}

export async function deleteEpfEntry(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("epf_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}

// ===== recurring contributions =====

/** Creates the rule and immediately fills in every month already elapsed. */
export async function addEpfRecurring(
  input: EpfRecurringInput
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = epfRecurringSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await supabase.from("epf_recurring").insert({
    ...parsed.data,
    end_date: parsed.data.end_date || null,
    note: parsed.data.note || null,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  const created = await materializeEpfRecurring(supabase, user.id, todayIST());
  revalidateEpf();
  return { ok: true, created };
}

/** Stops future generation. Entries already created stay in the ledger. */
export async function stopEpfRecurring(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("epf_recurring")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}

export async function deleteEpfRecurring(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("epf_recurring").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}
