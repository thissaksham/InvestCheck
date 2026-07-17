"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { epfEntrySchema, type EpfEntryInput } from "@/lib/schemas";

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

export async function deleteEpfEntry(id: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("epf_entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateEpf();
  return { ok: true };
}
