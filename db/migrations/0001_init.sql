-- ===== enums =====
create type instrument_type as enum ('stock','etf','mutual_fund','nps');
create type bucket as enum ('indian_equity','intl_equity','gold','debt_liquid','retirement');
create type price_source as enum ('yahoo','mfapi','npsnav','manual');
create type txn_type as enum ('buy','sell','opening');
create type fd_status as enum ('active','matured','renewed','closed');
create type fd_payout as enum ('cumulative','monthly');
create type epf_component as enum ('employee','employer');
create type epf_entry_type as enum ('opening','contribution','interest','adjustment');

-- ===== profiles (1:1 with auth.users) =====
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ===== market instruments (stocks/etf/mf/nps; EPF & FD live in their own tables) =====
create table instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  type instrument_type not null,
  bucket bucket not null,
  identifier text,                    -- 'RELIANCE.NS' | 'AAPL' | mfapi scheme code | npsnav scheme code
  currency text not null default 'INR' check (currency in ('INR','USD')),
  source price_source not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  instrument_id uuid not null references instruments on delete cascade,
  date date not null,
  type txn_type not null,
  units numeric(18,4) not null check (units >= 0),
  amount numeric(14,2) not null check (amount >= 0),        -- canonical ₹ deployed
  amount_usd numeric(14,2) check (amount_usd >= 0),          -- USD instruments only: the $ figure as entered
  note text,
  created_at timestamptz not null default now()
);
create index on transactions (user_id, instrument_id, date);

create table prices (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references instruments on delete cascade,
  date date not null,
  price numeric(14,4) not null,
  source price_source not null,
  fetched_at timestamptz not null default now(),
  unique (instrument_id, date)
);

-- ===== fx rates (global market data; written by crons only) =====
create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  pair text not null default 'USDINR',
  date date not null,
  rate numeric(10,4) not null,
  fetched_at timestamptz not null default now(),
  unique (pair, date)
);

-- ===== fixed deposits (renewal = linked list via renewed_into) =====
create table fixed_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  deposit_no text not null,
  bank text not null,
  holder text not null default 'Self',
  principal numeric(14,2) not null,
  rate numeric(6,4) not null,          -- 0.0770 = 7.70%
  start_date date,
  maturity_date date not null,
  maturity_amount numeric(14,2),
  payout fd_payout not null default 'cumulative',
  monthly_payout numeric(12,2),
  status fd_status not null default 'active',
  renewed_into uuid references fixed_deposits (id),
  note text,
  created_at timestamptz not null default now()
);
create index on fixed_deposits (user_id, status, maturity_date);

-- ===== EPF ledger =====
create table epf_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  component epf_component not null,
  date date not null,
  type epf_entry_type not null,
  amount numeric(14,2) not null,       -- signed for 'adjustment'
  note text,
  created_at timestamptz not null default now()
);
create index on epf_entries (user_id, component, date);

-- ===== daily snapshots (the history) =====
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  invested numeric(14,2) not null,
  current_value numeric(14,2) not null,
  by_bucket jsonb not null,            -- {"indian_equity":{"invested":..,"value":..}, ...}
  by_type jsonb not null,              -- same shape keyed by instrument type + "epf"
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ===== RLS: every table, owner-only =====
alter table profiles enable row level security;
alter table instruments enable row level security;
alter table transactions enable row level security;
alter table prices enable row level security;
alter table fixed_deposits enable row level security;
alter table epf_entries enable row level security;
alter table snapshots enable row level security;

create policy "own profile"  on profiles  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own rows" on instruments    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on transactions   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on fixed_deposits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on epf_entries    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on snapshots      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- prices has no user_id: readable by owners of the instrument, writable only by service role (crons)
create policy "read own instrument prices" on prices for select
  using (exists (select 1 from instruments i where i.id = instrument_id and i.user_id = auth.uid()));
-- fx_rates is global market data: any signed-in user may read; only the service role (crons) writes
alter table fx_rates enable row level security;
create policy "read fx" on fx_rates for select using (auth.role() = 'authenticated');

-- profile bootstrap on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();
