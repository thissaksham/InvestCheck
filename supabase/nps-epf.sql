-- Migration: NPS + EPF support. Run once in the Supabase SQL editor
-- (for databases created from the original schema.sql).

create table public.nps_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scheme text not null,
  pran text,
  tier text not null default 'Tier I' check (tier in ('Tier I', 'Tier II')),
  isin text,
  latest_nav numeric check (latest_nav > 0), -- user-updated; there is no free live NPS NAV API
  created_at timestamptz not null default now()
);

create table public.epf_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  balance numeric not null check (balance >= 0),
  contributed numeric check (contributed >= 0),
  as_of date,
  created_at timestamptz not null default now()
);

-- Allow NPS contributions in the transactions ledger
alter table public.transactions drop constraint transactions_asset_type_check;
alter table public.transactions add constraint transactions_asset_type_check
  check (asset_type in ('MF', 'STOCK', 'NPS'));

alter table public.nps_holdings enable row level security;
alter table public.epf_accounts enable row level security;

create policy "own rows" on public.nps_holdings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.epf_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
