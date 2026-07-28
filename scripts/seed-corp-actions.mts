// Seed known corporate actions for the real user. Idempotent (upsert on
// instrument_id + ex_date + type). Run AFTER 0004_corporate_actions.sql.
//   npx tsx scripts/seed-corp-actions.mts
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const s: SupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const { data: list } = await s.auth.admin.listUsers();
const uid = list.users.find((u) => u.email?.toLowerCase() === "thissaksham@gmail.com")!.id;

// instrument name → known actions
const SEED: { name: string; type: "split" | "bonus"; factor: number; ex_date: string; ratio: string; note: string }[] = [
  { name: "Tata Steel", type: "split", factor: 10, ex_date: "2023-07-28", ratio: "10:1", note: "Sub-division ₹10 → ₹1 face value" },
];

const { data: inst } = await s.from("instruments").select("id,name").eq("user_id", uid);
const byName = new Map((inst ?? []).map((i: any) => [i.name as string, i.id as string]));

for (const a of SEED) {
  const instrument_id = byName.get(a.name);
  if (!instrument_id) { console.log(`! no instrument "${a.name}" — skipped`); continue; }
  const { error } = await s.from("corporate_actions").upsert(
    { user_id: uid, instrument_id, type: a.type, factor: a.factor, ex_date: a.ex_date, ratio: a.ratio, note: a.note },
    { onConflict: "instrument_id,ex_date,type" }
  );
  if (error) console.log(`! ${a.name}: ${error.message}`);
  else console.log(`✓ ${a.name} — ${a.ratio} ${a.type} ex ${a.ex_date}`);
}
