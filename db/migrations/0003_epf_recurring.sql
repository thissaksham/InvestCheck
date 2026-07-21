-- Recurring EPF contributions: define the rule once, entries are generated
-- monthly (on rule creation for elapsed months, then by the nightly cron).
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists epf_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  component epf_component not null,
  amount numeric(14,2) not null check (amount > 0),
  -- capped at 28 so every month has the day; no month-length special cases
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists epf_recurring_user_idx on epf_recurring (user_id, is_active);

alter table epf_recurring enable row level security;
drop policy if exists "own rows" on epf_recurring;
create policy "own rows" on epf_recurring
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- links a generated entry back to its rule: exact dedupe + lets the ledger
-- show which rows were automatic. Deleting a rule keeps its entries.
alter table epf_entries
  add column if not exists recurring_id uuid references epf_recurring (id) on delete set null;
create index if not exists epf_entries_recurring_idx on epf_entries (recurring_id, date);
