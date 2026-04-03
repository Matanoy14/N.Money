/**
 * stripe-portal — opens a Stripe Billing Portal session for subscription management.
 *
 * Required Supabase secrets:
 *   STRIPE_SECRET_KEY  — Stripe secret key
 *   APP_URL            — Public app URL for the return redirect
 *
 * Caller: src/lib/billing.ts → openBillingPortal()
 * Auth: Bearer token from supabase.auth.getSession()
 *
 * The Stripe Billing Portal must be configured in the Stripe dashboard:
 *   Dashboard → Billing → Customer portal → Settings
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
    const { returnUrl }: { returnUrl?: string } = await req.json().catch(
      () => ({}),
    );

    // ── Resolve account + Stripe customer ────────────────────────────────────
    const { data: memberRow, error: memberErr } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr || !memberRow) throw new Error("no_account");

    const { data: subRow } = await supabase
      .from("account_subscriptions")
      .select("provider_customer_id")
      .eq("account_id", memberRow.account_id)
      .maybeSingle();

    const customerId = subRow?.provider_customer_id as string | undefined;
    if (!customerId) throw new Error("no_billing_customer");

    // ── Create Portal Session ─────────────────────────────────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-12-18.acacia" as Parameters<typeof Stripe>[1]["apiVersion"],
    });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl ?? `${Deno.env.get("APP_URL") ?? ""}/settings`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
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
