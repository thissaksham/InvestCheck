// Post-setup checker: schema present, RLS actually blocking, auth providers.
// Run: node scripts/verify-supabase.mjs   (needs .env.local filled)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const TABLES = ["profiles", "instruments", "transactions", "prices", "fx_rates", "fixed_deposits", "epf_entries", "snapshots"];
let failures = 0;

function report(label, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// 1 · schema: every table reachable with the service role
for (const t of TABLES) {
  const { error, count } = await service.from(t).select("*", { count: "exact", head: true });
  report(`table ${t}`, !error, error ? error.message : `${count} rows`);
}

// 2 · RLS: anon (signed-out) must see zero rows everywhere
for (const t of TABLES) {
  const { data, error } = await anon.from(t).select("*").limit(5);
  const ok = !error && (data ?? []).length === 0;
  report(`RLS blocks anon on ${t}`, ok, error ? error.message : `${(data ?? []).length} rows visible`);
}

// 3 · anon must not be able to write
{
  const { error } = await anon.from("fx_rates").insert({ pair: "USDINR", date: "2000-01-01", rate: 1 });
  report("RLS blocks anon insert on fx_rates", !!error, error ? "insert rejected" : "INSERT SUCCEEDED — policy hole!");
}

// 4 · auth settings: which providers are live
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
  const s = await res.json();
  report("auth: email OTP enabled", s.external?.email === true || s.disable_signup === false, JSON.stringify({ email: s.external?.email, google: s.external?.google, signup_disabled: s.disable_signup }));
} catch (e) {
  report("auth settings reachable", false, e.message);
}

console.log(failures === 0 ? "\nAll checks passed ✓" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
