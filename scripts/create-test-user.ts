// Dev helper: creates/reuses a dummy account and prints a 6-digit login code
// for the normal /login OTP form. Optionally seeds it with the §19 synthetic
// numbers so every screen has something to show.
//
//   npx tsx scripts/create-test-user.ts          # just the account + login code
//   npx tsx scripts/create-test-user.ts --seed   # also seed synthetic test data
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Test data is synthetic (from the build spec's acceptance criteria) — never
// run --seed against an account holding real data.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@investcheck.dev";

// tiny .env.local parser (dotenv isn't a dependency)
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || url.includes("YOUR-") || !serviceKey) {
  console.error(
    "Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.\n" +
      "(New Supabase dashboard: use the Publishable key as the anon key and the Secret key as the service role key.)"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // 1 · ensure the dummy user exists
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;
  let user = list.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: TEST_EMAIL, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`Created dummy user ${TEST_EMAIL}`);
  } else {
    console.log(`Dummy user ${TEST_EMAIL} already exists`);
  }

  // 2 · optional synthetic seed (spec §19 numbers only)
  if (process.argv.includes("--seed")) await seed(user!.id);

  // 3 · fresh login code for the normal /login OTP form
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (linkError) throw linkError;

  console.log("\n──────────────────────────────────────────");
  console.log(`  Sign in at:  http://localhost:3000/login`);
  console.log(`  Email:       ${TEST_EMAIL}`);
  console.log(`  Code:        ${link.properties.email_otp}`);
  console.log("──────────────────────────────────────────");
  console.log("On the login page: type the email, click “Already have a code?”");
  console.log("(NOT “Send code” — that would invalidate this one), then enter the code.");
  console.log("Code expires in ~1 hour; rerun this script for a fresh one.");
}

async function seed(userId: string) {
  const { count } = await admin
    .from("instruments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count && count > 0) {
    console.log("Seed skipped — account already has data.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  // instrument + the §19 P1 ledger: opening 100u/10k, buy 50u/6k, sell 30u/4k
  const { data: instrument, error: instrumentError } = await admin
    .from("instruments")
    .insert({
      user_id: userId,
      name: "Test Index Fund",
      type: "mutual_fund",
      bucket: "indian_equity",
      currency: "INR",
      source: "manual",
    })
    .select("id")
    .single();
  if (instrumentError) throw instrumentError;

  const { error: txnError } = await admin.from("transactions").insert([
    { user_id: userId, instrument_id: instrument.id, date: "2026-01-05", type: "opening", units: 100, amount: 10000 },
    { user_id: userId, instrument_id: instrument.id, date: "2026-02-05", type: "buy", units: 50, amount: 6000, note: "SIP" },
    { user_id: userId, instrument_id: instrument.id, date: "2026-03-05", type: "sell", units: 30, amount: 4000 },
  ]);
  if (txnError) throw txnError;

  // manual price today → 120u × ₹110 = ₹13,200 vs invested ₹12,800
  const { error: priceError } = await admin
    .from("prices")
    .insert({ instrument_id: instrument.id, date: today, price: 110, source: "manual" });
  if (priceError) throw priceError;

  // §19 P4 deposits: 1,00,000 @7.50% → 1,08,000 and 3,00,000 @8.00% (weighted 7.875%)
  const { error: fdError } = await admin.from("fixed_deposits").insert([
    {
      user_id: userId, deposit_no: "TEST-001", bank: "Test Bank", holder: "Self",
      principal: 100000, rate: 0.075, start_date: "2026-01-01", maturity_date: "2027-01-01",
      maturity_amount: 108000, status: "active",
    },
    {
      user_id: userId, deposit_no: "TEST-002", bank: "Test Bank", holder: "Self",
      principal: 300000, rate: 0.08, start_date: "2026-03-01", maturity_date: "2027-09-01",
      maturity_amount: 324000, status: "active",
    },
  ]);
  if (fdError) throw fdError;

  // §19 P5 EPF: opening 50,000 + contribution 5,000 + interest 2,000
  const { error: epfError } = await admin.from("epf_entries").insert([
    { user_id: userId, component: "employee", date: "2026-01-01", type: "opening", amount: 50000 },
    { user_id: userId, component: "employee", date: "2026-04-01", type: "contribution", amount: 5000 },
    { user_id: userId, component: "employee", date: "2026-06-30", type: "interest", amount: 2000 },
  ]);
  if (epfError) throw epfError;

  // 30 nightly snapshots so the hero chart has a line
  // market: invested 12,800 → value 13,200 · epf: 55,000 → 57,000
  const invested = 12800 + 55000;
  const finalValue = 13200 + 57000;
  const snapshots = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    const drift = invested + ((finalValue - invested) * i) / 29;
    const value = Math.round(drift + Math.sin(i / 3) * 250);
    const marketValue = value - 57000;
    return {
      user_id: userId,
      date: d,
      invested,
      current_value: value,
      by_bucket: { indian_equity: { invested: 12800, value: marketValue }, retirement: { invested: 55000, value: 57000 } },
      by_type: { mutual_fund: { invested: 12800, value: marketValue }, epf: { invested: 55000, value: 57000 } },
    };
  });
  const { error: snapError } = await admin.from("snapshots").upsert(snapshots, { onConflict: "user_id,date" });
  if (snapError) throw snapError;

  console.log("Seeded: 1 instrument, 3 transactions, price, 2 FDs, 3 EPF entries, 30 snapshots.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
