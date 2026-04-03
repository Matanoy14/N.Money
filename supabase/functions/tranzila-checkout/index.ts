/**
 * tranzila-checkout — builds a Tranzila hosted payment page URL for an N.Money subscription.
 *
 * Security model (nonce-based):
 *   1. Caller authenticates with Supabase Bearer token.
 *   2. Function resolves account_id + validates plan server-side (never from client body).
 *   3. Inserts a nonce row into billing_pending_payments (service-role, RLS-bypassed).
 *      The row stores: account_id, plan, expected_sum, expires_at (30 min TTL).
 *   4. Passes only the nonce UUID as `id` to Tranzila (not account_id, not plan).
 *   5. Returns a URL pointing to Tranzila's hosted payment page.
 *   6. Client redirects the browser to that URL.
 *   7. User completes card entry on Tranzila's secure page.
 *   8. Tranzila POSTs result to tranzila-notify with `id=<nonce>`.
 *   9. tranzila-notify looks up nonce from DB — account_id/plan come ONLY from DB.
 *
 * Redirect URLs are derived from APP_URL server-side — never accepted from the client.
 *
 * Required Supabase secrets:
 *   TRANZILA_TERMINAL        — Merchant terminal number (from Tranzila dashboard)
 *   TRANZILA_API_KEY         — TranzilaTK authentication key (from Tranzila dashboard)
 *   TRANZILA_PRICE_PERSONAL  — Monthly price in ILS, e.g. "29"
 *   TRANZILA_PRICE_COUPLE    — Monthly price in ILS, e.g. "49"
 *   TRANZILA_PRICE_FAMILY    — Monthly price in ILS, e.g. "69"
 *   APP_URL                  — Public app URL for success/cancel redirects
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-injected; used to write nonce row
 *
 * Caller: src/lib/billing.ts → startBillingFlow()
 * Auth: Bearer token from supabase.auth.getSession()
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tranzila hosted payment endpoint (ILS / Israeli market)
const TRANZILA_HOST = "https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("unauthenticated");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("unauthenticated");

    // ── Request body — only plan is accepted from client ─────────────────────
    const body = await req.json().catch(() => ({}));
    const plan: string = body.plan ?? "";

    // ── Validate plan + resolve price ─────────────────────────────────────────
    const priceMap: Record<string, string | undefined> = {
      personal: Deno.env.get("TRANZILA_PRICE_PERSONAL"),
      couple:   Deno.env.get("TRANZILA_PRICE_COUPLE"),
      family:   Deno.env.get("TRANZILA_PRICE_FAMILY"),
    };
    const sum = priceMap[plan];
    if (!sum) throw new Error("invalid_plan");

    // ── Validate merchant credentials ─────────────────────────────────────────
    const terminal = Deno.env.get("TRANZILA_TERMINAL");
    const apiKey   = Deno.env.get("TRANZILA_API_KEY");
    if (!terminal || !apiKey) throw new Error("provider_not_configured");

    // ── Resolve account (from authenticated user, not client body) ────────────
    const { data: memberRow, error: memberErr } = await anonClient
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr || !memberRow) throw new Error("no_account");
    const accountId = memberRow.account_id as string;

    // ── Insert nonce row (service-role to bypass RLS) ─────────────────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL

    const { data: pendingRow, error: insertErr } = await serviceClient
      .from("billing_pending_payments")
      .insert({
        account_id:   accountId,
        plan,
        expected_sum: sum,
        expires_at:   expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !pendingRow) {
      console.error("tranzila-checkout: nonce insert failed", insertErr);
      throw new Error("nonce_create_failed");
    }

    const nonce = pendingRow.id as string; // opaque UUID — the only identifier sent to Tranzila

    // ── Build redirect URLs server-side (not from client) ────────────────────
    const appUrl      = Deno.env.get("APP_URL") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // ── Build Tranzila payment URL ────────────────────────────────────────────
    // `id` = nonce UUID (NOT account_id). tranzila-notify will resolve account_id from DB.
    // `remarks` is omitted — plan is resolved from DB by tranzila-notify.
    const params = new URLSearchParams({
      supplier:    terminal,
      TranzilaTK: apiKey,
      sum,
      currency:    "1",     // 1 = ILS (New Israeli Shekel)
      cred_type:   "1",     // 1 = regular credit charge
      lang:        "HEB",
      tranmode:    "N",     // N = immediate charge (vs. A = authorization only)
      notify_url:  `${supabaseUrl}/functions/v1/tranzila-notify`,
      success_url: `${appUrl}/settings?billing=success`,
      fail_url:    `${appUrl}/settings?billing=cancel`,
      id:          nonce,   // opaque nonce — tranzila-notify resolves account_id from DB
    });

    const url = `${TRANZILA_HOST}?${params.toString()}`;

    return new Response(JSON.stringify({ url }), {
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
