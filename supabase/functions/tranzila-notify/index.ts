/**
 * tranzila-notify — receives Tranzila's server-to-server payment notification
 * and syncs the result into account_subscriptions.
 *
 * Security model (nonce-based):
 *   - `id` in the callback body is an opaque nonce UUID (row ID from billing_pending_payments).
 *   - account_id and plan are read EXCLUSIVELY from the DB row — never from the callback body.
 *   - Nonce must exist, be unused (used_at IS NULL), and not expired (expires_at > now).
 *   - Nonce is marked used_at = now() BEFORE the subscription upsert (idempotency guard).
 *   - Terminal validation is always enforced — no bypass if `supplier` is absent.
 *   - isApproved requires confirmationCode non-empty AND responseCode === "000" strictly.
 *   - sum in callback must match expected_sum stored in the nonce row.
 *
 * How Tranzila calls this endpoint:
 *   - HTTP POST (application/x-www-form-urlencoded)
 *   - Called by Tranzila's servers after every transaction attempt (success AND failure)
 *
 * Key fields in Tranzila's notification POST:
 *   ConfirmationCode — bank approval code (non-empty = approved; empty = declined)
 *   TransId          — Tranzila transaction ID
 *   supplier         — your terminal number (must match TRANZILA_TERMINAL)
 *   sum              — amount charged (must match expected_sum in nonce row)
 *   id               — nonce UUID set by tranzila-checkout (NOT account_id)
 *   Response         — response code from acquiring bank (000 = approved)
 *   CustId           — customer token for future recurring charges (if tokenisation enabled)
 *
 * Required Supabase secrets:
 *   TRANZILA_TERMINAL        — Used to validate the notification is from our terminal
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-injected; used to bypass RLS on all reads/writes
 */

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── Parse Tranzila notification ───────────────────────────────────────────
    const contentType = req.headers.get("content-type") ?? "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const form = new URLSearchParams(text);
      form.forEach((v, k) => { params[k] = v; });
    } else {
      params = await req.json().catch(() => ({}));
    }

    // ── Terminal validation — always required, no bypass ──────────────────────
    const expectedTerminal = Deno.env.get("TRANZILA_TERMINAL");
    const supplierParam    = params["supplier"] ?? "";

    if (!expectedTerminal) {
      console.error("tranzila-notify: TRANZILA_TERMINAL secret not set");
      return new Response("configuration_error", { status: 500 });
    }

    if (supplierParam !== expectedTerminal) {
      console.error("tranzila-notify: terminal mismatch", { received: supplierParam });
      return new Response("terminal_mismatch", { status: 400 });
    }

    // ── Extract nonce ─────────────────────────────────────────────────────────
    const nonce = params["id"] ?? "";
    if (!nonce) {
      console.error("tranzila-notify: missing nonce (id field)");
      return new Response(JSON.stringify({ received: true, skipped: "missing_nonce" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Service-role client — bypasses RLS ────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Look up nonce row ─────────────────────────────────────────────────────
    const { data: pendingRow, error: lookupErr } = await supabase
      .from("billing_pending_payments")
      .select("id, account_id, plan, expected_sum, expires_at, used_at")
      .eq("id", nonce)
      .maybeSingle();

    if (lookupErr || !pendingRow) {
      console.error("tranzila-notify: nonce not found", { nonce, lookupErr });
      return new Response(JSON.stringify({ received: true, skipped: "nonce_not_found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Replay protection: nonce must not already be used ─────────────────────
    if (pendingRow.used_at !== null) {
      console.warn("tranzila-notify: nonce already used", { nonce });
      return new Response(JSON.stringify({ received: true, skipped: "nonce_already_used" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── TTL check: nonce must not be expired ──────────────────────────────────
    if (new Date(pendingRow.expires_at) < new Date()) {
      console.warn("tranzila-notify: nonce expired", { nonce, expires_at: pendingRow.expires_at });
      return new Response(JSON.stringify({ received: true, skipped: "nonce_expired" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Amount verification ───────────────────────────────────────────────────
    const callbackSum = (params["sum"] ?? "").trim();
    if (callbackSum !== pendingRow.expected_sum) {
      console.error("tranzila-notify: sum mismatch", {
        callback: callbackSum,
        expected: pendingRow.expected_sum,
      });
      // Mark nonce used to prevent replay on other amounts; do not activate subscription
      await supabase
        .from("billing_pending_payments")
        .update({ used_at: new Date().toISOString() })
        .eq("id", nonce);
      return new Response(JSON.stringify({ received: true, skipped: "sum_mismatch" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── account_id and plan come ONLY from DB ─────────────────────────────────
    const accountId = pendingRow.account_id as string;
    const plan      = pendingRow.plan as string;

    // ── Determine transaction outcome (strict) ────────────────────────────────
    // Both conditions must hold: confirmation code present AND response code exactly "000".
    const confirmationCode = (params["ConfirmationCode"] ?? params["confirmationcode"] ?? "").trim();
    const responseCode     = (params["Response"] ?? params["response"] ?? params["ResponseCode"] ?? "").trim();
    const transId          = (params["TransId"] ?? params["transid"] ?? params["tranid"] ?? "").trim();
    const custToken        = (params["CustId"] ?? params["custid"] ?? "").trim();

    const isApproved = confirmationCode.length > 0 && responseCode === "000";

    // ── Mark nonce used BEFORE subscription write (idempotency guard) ─────────
    await supabase
      .from("billing_pending_payments")
      .update({ used_at: new Date().toISOString() })
      .eq("id", nonce);

    if (isApproved) {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);

      await supabase.from("account_subscriptions").upsert(
        {
          account_id:               accountId,
          plan:                     ["personal", "couple", "family"].includes(plan) ? plan : "personal",
          status:                   "active",
          provider:                 "tranzila",
          provider_customer_id:     custToken || transId || null,
          provider_subscription_id: transId || confirmationCode || null,
          current_period_end:       periodEnd.toISOString(),
          cancel_at_period_end:     false,
          last_event_at:            new Date().toISOString(),
          updated_at:               new Date().toISOString(),
        },
        { onConflict: "account_id" },
      );
    } else {
      // Declined — update status only if a subscription row already exists
      await supabase
        .from("account_subscriptions")
        .update({
          status:        "past_due",
          last_event_at: new Date().toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq("account_id", accountId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tranzila-notify error:", err);
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
