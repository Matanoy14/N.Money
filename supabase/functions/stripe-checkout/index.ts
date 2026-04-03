/**
 * stripe-checkout — creates a Stripe Checkout Session for an N.Money subscription.
 *
 * Required Supabase secrets (set via `supabase secrets set` or dashboard):
 *   STRIPE_SECRET_KEY        — Stripe secret key (sk_live_… or sk_test_…)
 *   STRIPE_PRICE_PERSONAL    — Stripe Price ID for the 'personal' plan
 *   STRIPE_PRICE_COUPLE      — Stripe Price ID for the 'couple' plan
 *   STRIPE_PRICE_FAMILY      — Stripe Price ID for the 'family' plan
 *   APP_URL                  — Public app URL for success/cancel redirects
 *
 * Caller: src/lib/billing.ts → startCheckout()
 * Auth: Bearer token from supabase.auth.getSession()
 */

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("unauthenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("unauthenticated");

    // ── Request body ─────────────────────────────────────────────────────────
    const {
      plan,
      successUrl,
      cancelUrl,
    }: { plan: string; successUrl?: string; cancelUrl?: string } =
      await req.json();

    const priceMap: Record<string, string | undefined> = {
      personal: Deno.env.get("STRIPE_PRICE_PERSONAL"),
      couple: Deno.env.get("STRIPE_PRICE_COUPLE"),
      family: Deno.env.get("STRIPE_PRICE_FAMILY"),
    };
    const priceId = priceMap[plan];
    if (!priceId) throw new Error("invalid_plan");

    // ── Resolve account ───────────────────────────────────────────────────────
    const { data: memberRow, error: memberErr } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr || !memberRow) throw new Error("no_account");
    const accountId = memberRow.account_id as string;

    // ── Resolve existing Stripe customer if any ────────────────────────────
    const { data: subRow } = await supabase
      .from("account_subscriptions")
      .select("provider_customer_id")
      .eq("account_id", accountId)
      .maybeSingle();
    const existingCustomerId = subRow?.provider_customer_id as
      | string
      | undefined;

    // ── Create Checkout Session ────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-12-18.acacia" as Parameters<typeof Stripe>[1]["apiVersion"],
    });

    const appUrl = Deno.env.get("APP_URL") ?? "";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email }),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url:
        successUrl ?? `${appUrl}/settings?billing=success`,
      cancel_url:
        cancelUrl ?? `${appUrl}/settings?billing=cancel`,
      metadata: {
        account_id: accountId,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          account_id: accountId,
          plan,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
