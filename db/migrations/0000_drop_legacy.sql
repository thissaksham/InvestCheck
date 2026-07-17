-- Drops the legacy InvestCheck (v1) tables so 0001_init.sql can run clean.
-- DESTRUCTIVE: run this consciously in the Supabase SQL editor before 0001.
drop table if exists public.transactions cascade;
drop table if exists public.fixed_deposits cascade;
drop table if exists public.mutual_funds cascade;
drop table if exists public.stocks cascade;
drop table if exists public.nps_holdings cascade;
drop table if exists public.epf_accounts cascade;
drop table if exists public.user_settings cascade;
