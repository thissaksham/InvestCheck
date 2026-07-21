// Materialises recurring EPF contributions into real epf_entries rows.
// Runs on rule creation (backfills elapsed months) and nightly from the cron.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EpfRecurring } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Every contribution date a rule owes up to (and including) `todayIso`.
 * day_of_month is capped at 28 by the schema, so no month-length handling.
 */
export function dueDates(
  rule: Pick<EpfRecurring, "start_date" | "end_date" | "day_of_month">,
  todayIso: string
): string[] {
  const out: string[] = [];
  const start = new Date(`${rule.start_date}T00:00:00Z`);
  const last = rule.end_date && rule.end_date < todayIso ? rule.end_date : todayIso;

  let year = start.getUTCFullYear();
  let month = start.getUTCMonth(); // 0-based
  for (let guard = 0; guard < 600; guard++) {
    const date = `${year}-${pad(month + 1)}-${pad(rule.day_of_month)}`;
    if (date > last) break;
    if (date >= rule.start_date) out.push(date);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

/**
 * Inserts any missing entries for the user's active rules. Idempotent —
 * dedupes on (recurring_id, date), so re-running creates nothing new.
 */
export async function materializeEpfRecurring(
  supabase: SupabaseClient,
  userId: string,
  todayIso: string
): Promise<number> {
  const { data: rules } = await supabase
    .from("epf_recurring")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  let created = 0;
  for (const rule of (rules ?? []) as EpfRecurring[]) {
    const { data: existing } = await supabase
      .from("epf_entries")
      .select("date")
      .eq("user_id", userId)
      .eq("recurring_id", rule.id);
    const have = new Set((existing ?? []).map((e: { date: string }) => e.date));

    const rows = dueDates(rule, todayIso)
      .filter((d) => !have.has(d))
      .map((date) => ({
        user_id: userId,
        component: rule.component,
        date,
        type: "contribution" as const,
        amount: rule.amount,
        recurring_id: rule.id,
        note: rule.note,
      }));

    if (rows.length) {
      const { error } = await supabase.from("epf_entries").insert(rows);
      if (!error) created += rows.length;
    }
  }
  return created;
}
