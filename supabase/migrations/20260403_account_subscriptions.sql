-- Migration: account_subscriptions
-- Date: 2026-04-03
-- Risk: low (new table, no existing data affected)
-- Reversible: yes (DROP TABLE account_subscriptions)
--
-- Provider-agnostic subscription/billing state per account.
-- Supports: stripe | app_store | google_play | manual
-- Writes: service role only (Stripe webhook). No client INSERT/UPDATE.
--
-- Run manually in Supabase SQL editor — idempotent, safe to re-run.

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists account_subscriptions (
  id                       uuid        primary key default gen_random_uuid(),
  account_id               uuid        not null references accounts(id) on delete cascade,
  plan                     text        not null default 'free',
  status                   text        not null default 'none',
  provider                 text,        -- 'stripe' | 'app_store' | 'google_play' | 'manual'
  provider_customer_id     text,        -- Stripe: cus_xxx
  provider_subscription_id text,        -- Stripe: sub_xxx | App Store: original_transaction_id
  trial_end                timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean     not null default false,
  last_event_at            timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── 2. Constraints ──────────────────────────────────────────────────────────
do $$ begin
  alter table account_subscriptions
    add constraint account_subscriptions_account_unique unique (account_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table account_subscriptions
    add constraint account_subscriptions_plan_check
    check (plan in ('free', 'personal', 'couple', 'family'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table account_subscriptions
    add constraint account_subscriptions_status_check
    check (status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused'));
exception when duplicate_object then null; end $$;

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
alter table account_subscriptions enable row level security;

drop policy if exists "members can read own account subscription" on account_subscriptions;
create policy "members can read own account subscription"
  on account_subscriptions for select
  using (
    account_id in (select account_id from account_members where user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for authenticated users.
-- Only the service role key (used by stripe-webhook Edge Function) writes to this table.

-- ── Verify ───────────────────────────────────────────────────────────────────
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_name = 'account_subscriptions'
-- order by ordinal_position;
