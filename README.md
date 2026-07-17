# InvestCheck

Personal investment tracker for one Indian investor — stocks (IN/US), ETFs, mutual funds, FDs, EPF, NPS — valued with live market data, with a nightly snapshot history. Next.js 15 + Supabase, "Ledger Modern" design.

## Setup

1. `npm install`
2. Create a **new** Supabase project, then run `db/migrations/0001_init.sql` in its SQL editor.
   (`0000_drop_legacy.sql` is only for the old v1 project — skip it on a fresh one.)
3. Fill `.env.local`: project URL, anon/Publishable key, service_role/Secret key.
4. `npm run dev`
5. **Try it without configuring auth:** `npx tsx scripts/create-test-user.ts --seed` creates
   `test@investcheck.dev` with synthetic data and prints a 6-digit code — on `/login` enter the
   email, click "Already have a code?", type the code.
6. For real sign-in later: Dashboard → Authentication → Providers: enable **Google** (add OAuth
   client) and **Email** (OTP); allowlist `http://localhost:3000/auth/callback` + your prod URL.

## Deploy (Vercel)

- Set all env vars from `.env.example` (plus a random `CRON_SECRET`).
- `vercel.json` schedules the two crons: prices 23:00 IST, snapshot 23:15 IST.

## Structure

- `db/migrations` — schema (RLS on every table)
- `lib/valuation.ts` — position math from the transactions ledger (§7 of the build spec)
- `lib/fetchers` — yahoo / mfapi / npsnav, server-only, stale-not-zero on failure
- `app/actions` — all writes (zod-validated Server Actions)
- `app/api/cron/*` — nightly price + snapshot jobs (service role, `CRON_SECRET` bearer)
