/**
 * stripe-webhook — receives Stripe webhook events and syncs subscription state
 * into account_subscriptions.
 *
 * Required Supabase secrets:
 *   STRIPE_SECRET_KEY        — Stripe secret key (for event expansion / verification)
 *   STRIPE_WEBHOOK_SECRET    — Signing secret from Stripe Dashboard → Webhooks
 *   SUPABASE_SERVICE_ROLE_KEY — Service-role key to bypass RLS on upserts
 *
 * Webhook endpoint to configure in Stripe Dashboard:
 *   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *
 * Events to subscribe to in Stripe Dashboard:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_failed
 *
 * This function is the authoritative source for account subscription state.
 * Never trust client-reported subscription status — only what flows through here.
 */

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-12-18.acacia" as Parameters<typeof Stripe>[1]["apiVersion"],
  });

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Signature verification failed: ${err}`, {
      status: 400,
    });
  }

  // Service-role client to bypass RLS — only used inside this verified webhook
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      // ── Subscription created via checkout ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;
        if (session.mode !== "subscription") break;

        const accountId = session.metadata?.account_id;
        const plan = session.metadata?.plan ?? "personal";
        if (!accountId) {
          console.error("checkout.session.completed: no account_id in metadata");
          break;
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        // Fetch full subscription for period details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await supabase.from("account_subscriptions").upsert(
          {
            account_id: accountId,
            plan,
            status: sub.status,
            provider: "stripe",
            provider_customer_id: customerId,
            provider_subscription_id: subscriptionId,
            trial_end: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
            current_period_end: new Date(
              sub.current_period_end * 1000,
            ).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            last_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id" },
        );
        break;
      }

      // ── Subscription updated (upgrade / downgrade / renewal / cancellation) ─
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        if (!accountId) {
          console.error("customer.subscription.updated: no account_id in metadata");
          break;
        }

        const plan = sub.metadata?.plan ?? "personal";
        const customerId = typeof sub.customer === "string"
          ? sub.customer
          : sub.customer.id;

        await supabase.from("account_subscriptions").upsert(
          {
            account_id: accountId,
            plan,
            status: sub.status,
            provider: "stripe",
            provider_customer_id: customerId,
            provider_subscription_id: sub.id,
            trial_end: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
            current_period_end: new Date(
              sub.current_period_end * 1000,
            ).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            last_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id" },
        );
        break;
      }

      // ── Subscription deleted (hard cancel) ────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const accountId = sub.metadata?.account_id;
        if (!accountId) break;

        const customerId = typeof sub.customer === "string"
          ? sub.customer
          : sub.customer.id;

        await supabase.from("account_subscriptions").upsert(
          {
            account_id: accountId,
            status: "canceled",
            provider: "stripe",
            provider_customer_id: customerId,
            provider_subscription_id: sub.id,
            cancel_at_period_end: false,
            last_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id" },
        );
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const accountId = (invoice.subscription_details?.metadata as Record<string, string> | null)
          ?.account_id;
        if (!accountId) break;

        await supabase
          .from("account_subscriptions")
          .update({
            status: "past_due",
            last_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);
        break;
      }

      default:
        // Unhandled event type — acknowledged safely
        break;
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    // Return 200 to prevent Stripe retrying; log the error for investigation
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
