-- Logging v2: NPS quarterly fee (units out + ₹), employer/employee/self on
-- NPS transactions and EPF entries.
-- Run in the Supabase SQL editor (safe to re-run — all guarded).

-- 'fee' transaction: reduces units, records the ₹ fee; never invested/P&L math.
alter type txn_type add value if not exists 'fee';

-- EPF gains a 'self' component (voluntary / VPF) alongside employee & employer.
alter type epf_component add value if not exists 'self';

-- contributor tag for NPS contributions (employer / employee / self).
alter table transactions
  add column if not exists contributor text
  check (contributor is null or contributor in ('employer','employee','self'));
