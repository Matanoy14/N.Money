-- Migration: billing_pending_payments
-- Date: 2026-04-03
-- Risk: low (new table, no existing data affected)
-- Reversible: yes (DROP TABLE billing_pending_payments)
--
-- Server-side nonce storage for Tranzila payment callback verification.
-- Each tranzila-checkout invocation inserts one row (the nonce).
-- tranzila-notify reads account_id + plan EXCLUSIVELY from this table —
-- never from the callback body — so spoofed callbacks cannot inject values.
--
-- Run manually in Supabase SQL editor — idempotent, safe to re-run.

create table if not exists billing_pending_payments (
  id           uuid        primary key default gen_random_uuid(),
  account_id   uuid        not null references accounts(id) on delete cascade,
  plan         text        not null,
  expected_sum text        not null,  -- ILS amount as string; must match 'sum' in notify callback
  expires_at   timestamptz not null,  -- nonce TTL; reject callbacks after this
  used_at      timestamptz,           -- null = unused; set atomically when notify claims the nonce
  created_at   timestamptz not null default now()
);

do $$ begin
  alter table billing_pending_payments
    add constraint billing_pending_payments_plan_check
    check (plan in ('personal', 'couple', 'family'));
exception when duplicate_object then null; end $$;

-- RLS: enabled with no policies.
-- Only the service role key (used by tranzila-checkout and tranzila-notify) can read/write.
-- No authenticated client access is needed or allowed.
alter table billing_pending_payments enable row level security;

-- Index for efficient expiry queries (optional cleanup jobs)
create index if not exists billing_pending_payments_expires_at_idx
  on billing_pending_payments (expires_at);

-- Verify:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'billing_pending_payments'
-- order by ordinal_position;
