"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfile(displayName: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const name = displayName.trim().slice(0, 80) || null;
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Danger zone: deletes every row the user owns. Requires typing DELETE. */
export async function deleteAllData(confirmText: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (confirmText !== "DELETE") return { ok: false, error: 'Type "DELETE" to confirm.' };

  // instruments cascade transactions + prices
  for (const table of ["instruments", "fixed_deposits", "epf_entries", "snapshots"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) return { ok: false, error: `${table}: ${error.message}` };
  }
  for (const p of ["/", "/holdings", "/transactions", "/deposits", "/retirement", "/settings"]) {
    revalidatePath(p);
  }
  return { ok: true };
}
