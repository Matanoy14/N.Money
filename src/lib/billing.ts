/**
 * billing.ts — client-side helpers for account subscription state and
 * provider-agnostic billing flows.
 *
 * IMPORTANT: This module manages the N.Money service subscription.
 * It is completely separate from `payment_sources` (which are the user's
 * own financial accounts used to categorise transactions).
 *
 * Architecture:
 *   - DB: account_subscriptions table (account-level, provider-agnostic)
 *   - Web billing: Tranzila (Israeli payment processor), via Supabase Edge Functions
 *   - Future: same table can receive App Store / Google Play subscription
 *     states from a separate native mobile billing handler
 */

import { supabase } from './supabase';

// ── Domain types ──────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'personal' | 'couple' | 'family';

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused';

/**
 * Provider-agnostic subscription record stored in account_subscriptions.
 * Stripe web: provider='stripe', provider_customer_id='cus_…', provider_subscription_id='sub_…'
 * App Store (future): provider='app_store', provider_subscription_id='<original_transaction_id>'
 * Google Play (future): provider='google_play', provider_subscription_id='<purchase_token>'
 */
export interface AccountSubscription {
  account_id:               string;
  plan:                     SubscriptionPlan;
  status:                   SubscriptionStatus;
  provider:                 'tranzila' | 'stripe' | 'app_store' | 'google_play' | 'manual' | null;
  provider_customer_id:     string | null;
  provider_subscription_id: string | null;
  trial_end:                string | null;   // ISO timestamp
  current_period_end:       string | null;   // ISO timestamp
  cancel_at_period_end:     boolean;
  last_event_at:            string | null;
}

export type SubscriptionFetchResult =
  | { ok: true;  data: AccountSubscription | null }
  | { ok: false; reason: 'table_missing' | 'network_error' | 'unknown' };

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the current account's subscription record.
 * Returns { ok: true, data: null } if the table exists but no row yet.
 * Returns { ok: false, reason: 'table_missing' } if the DB table hasn't been created yet.
 */
export async function fetchAccountSubscription(
  accountId: string,
): Promise<SubscriptionFetchResult> {
  const { data, error } = await supabase
    .from('account_subscriptions')
    .select(
      'account_id, plan, status, provider, provider_customer_id, provider_subscription_id, trial_end, current_period_end, cancel_at_period_end, last_event_at',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    const msg = error.message ?? '';
    const isTableMissing =
      msg.includes('does not exist') ||
      msg.includes('relation') ||
      (error as { code?: string }).code === '42P01' ||
      (error as { code?: string }).code === 'PGRST301';
    return { ok: false, reason: isTableMissing ? 'table_missing' : 'unknown' };
  }

  return { ok: true, data: data as AccountSubscription | null };
}

// ── Actions (call Supabase Edge Functions) ────────────────────────────────────

/**
 * Start a Tranzila-hosted payment flow for the given plan.
 * On success, caller should redirect to `result.url` (Tranzila's hosted payment page).
 * Blocked until TRANZILA_TERMINAL + TRANZILA_API_KEY + price secrets are configured.
 */
export async function startBillingFlow(
  plan: 'personal' | 'couple' | 'family',
): Promise<{ url?: string; error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: 'unauthenticated' };

  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tranzila-checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/settings?billing=success`,
          cancelUrl:  `${window.location.origin}/settings?billing=cancel`,
        }),
      },
    );
    return await res.json();
  } catch {
    return { error: 'network_error' };
  }}

// ── Source-of-truth helpers ───────────────────────────────────────────────────

/**
 * Returns the billing plan that corresponds to a given account type.
 * In this product, plan === account type — they are semantically identical.
 * Always use this to derive the checkout plan from account type.
 * Never let them diverge at rest.
 */
export function planForAccountType(
  accountType: 'personal' | 'couple' | 'family',
): 'personal' | 'couple' | 'family' {
  return accountType;
}

/**
 * Returns true if the billing plan is in sync with the account structure.
 * A mismatch means billing tier doesn't match household structure — surface
 * this in the UI so the owner can reconcile via subscription management.
 *
 * No-subscription and canceled states are not considered mismatches
 * because billing is not yet enforced.
 */
export function isSubscriptionSynced(
  accountType: 'personal' | 'couple' | 'family',
  subscription: AccountSubscription | null,
): boolean {
  if (!subscription) return true;
  if (subscription.status === 'none' || subscription.status === 'canceled') return true;
  if (subscription.plan === 'free') return true; // free tier — no mismatch concept
  return subscription.plan === accountType;
}

/**
 * Returns the effective account type for feature-access decisions.
 *
 * Phase 1 (CURRENT — billing not enforced):
 *   Returns accounts.type as-is. Subscription state is ignored for access gating.
 *   All features are available regardless of billing status.
 *
 * Phase 2 (FUTURE — after billing enforcement pass):
 *   Will downgrade effective type to 'personal' for accounts where:
 *     subscription.status === 'canceled' AND current_period_end has passed
 *     subscription.status === 'past_due' AND grace period has elapsed
 *
 * IMPORTANT: All feature-gating code should call this function — never
 * consult subscription.status directly in component logic. This function
 * is the single enforcement point for Phase 2 changes.
 */
export function getEffectiveAccountType(
  accountType: 'personal' | 'couple' | 'family',
  _subscription: AccountSubscription | null, // reserved for Phase 2
): 'personal' | 'couple' | 'family' {
  // Phase 1: structural type is always the effective type
  return accountType;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function planLabel(plan: SubscriptionPlan): string {
  return plan === 'personal' ? 'אישי'
       : plan === 'couple'   ? 'זוגי'
       : plan === 'family'   ? 'משפחתי'
       : 'חינמי';
}

export function statusLabel(status: SubscriptionStatus): string {
  return status === 'active'     ? 'פעיל'
       : status === 'trialing'   ? 'תקופת ניסיון'
       : status === 'past_due'   ? 'תשלום נכשל'
       : status === 'canceled'   ? 'בוטל'
       : status === 'incomplete' ? 'לא הושלם'
       : status === 'paused'     ? 'מושהה'
       : 'לא פעיל';
}

export function statusColor(status: SubscriptionStatus): string {
  return status === 'active'     ? '#00A86B'
       : status === 'trialing'   ? '#1E56A0'
       : status === 'past_due'   ? '#E53E3E'
       : status === 'canceled'   ? '#9CA3AF'
       : '#6B7280';
}

export function formatBillingDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
