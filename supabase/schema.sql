-- InvestCheck schema. Run once in the Supabase SQL editor.
-- Holdings (units, avg cost) are NOT stored: the transactions table is the
-- source of truth and the client derives them. No derived state, no drift.

create table public.mutual_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amc text not null,
  scheme text not null,
  scheme_code text,
  isin text,
  folio text,
  type text not null default 'Equity',
  created_at timestamptz not null default now()
);

create table public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  isin text,
  created_at timestamptz not null default now()
);

create table public.fixed_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_name text not null,
  principal numeric not null check (principal > 0),
  interest_rate numeric not null check (interest_rate >= 0),
  start_date date not null,
  maturity_date date not null,
  compounding_frequency text not null default 'Quarterly'
    check (compounding_frequency in ('Monthly', 'Quarterly', 'Yearly')),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('MF', 'STOCK')),
  asset_id uuid not null,
  date date not null,
  units numeric not null check (units > 0),
  price numeric not null check (price >= 0),
  type text not null check (type in ('BUY', 'SELL')),
  created_at timestamptz not null default now()
);

create index transactions_user_asset_idx on public.transactions (user_id, asset_id);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  casparser_api_key text,
  updated_at timestamptz not null default now()
);

-- Row Level Security: every table is scoped to the owning user.
alter table public.mutual_funds enable row level security;
alter table public.stocks enable row level security;
alter table public.fixed_deposits enable row level security;
alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

create policy "own rows" on public.mutual_funds
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.stocks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.fixed_deposits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
