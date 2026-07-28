-- Corporate actions (splits, bonuses). Applied DERIVATIONALLY at read time —
-- transactions are never mutated, because tax reporting needs the originally
-- executed units and prices. `factor` is the multiplier on units held as of
-- ex_date: split 10:1 → 10, bonus 1:1 → 2, bonus 1:2 → 1.5, reverse split → <1.
-- Run in the Supabase SQL editor. Safe to re-run.

do $$ begin
  create type corporate_action_type as enum ('split', 'bonus');
exception when duplicate_object then null;
end $$;

create table if not exists corporate_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  instrument_id uuid not null references instruments (id) on delete cascade,
  type corporate_action_type not null,
  factor numeric(12,6) not null check (factor > 0),
  ex_date date not null,
  ratio text,            -- display label, e.g. "10:1"
  note text,
  created_at timestamptz not null default now(),
  unique (instrument_id, ex_date, type)
);
create index if not exists corporate_actions_instrument_idx on corporate_actions (instrument_id, ex_date);

alter table corporate_actions enable row level security;
drop policy if exists "own rows" on corporate_actions;
create policy "own rows" on corporate_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
