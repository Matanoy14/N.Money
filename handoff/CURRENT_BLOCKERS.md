# Current Blockers
<!-- 2026-04-07: Income migrations audit complete — 3 migrations required before income QA can proceed. See P1 blocker below. -->

**Last updated:** 2026-04-07 (Income migration blockers added)

---

## Active Blockers

### ⚠️ P1 — Incomes Module: 3 Migrations Must Be Run Before QA

**Run status:** Unconfirmed — all 3 files are git-untracked (never committed). DATA_MODEL.md had an unverified "confirmed" note for `recurring_incomes`; that note has been corrected (2026-04-07 audit).

**Check before running each:** Run the verification query below to avoid re-running an already-applied migration.

---

#### Migration 1 — `supabase/migrations/20260405_income_expected_amount.sql`
```sql
-- Pre-check: does expected_amount exist?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'financial_movements' AND column_name = 'expected_amount';
-- If 0 rows: run the migration. If 1 row: SKIP (already applied).
```
Run if absent:
```sql
ALTER TABLE public.financial_movements
  ADD COLUMN expected_amount numeric NULL;
```
**What breaks without this:** Expected amounts silently not saved (PostgREST drops unknown columns on write); "סכום צפוי" strip always equals actual; analytics expected-vs-actual chart never shows data.

---

#### Migration 2 — `supabase/migrations/20260405_recurring_incomes.sql`
```sql
-- Pre-check: does recurring_incomes table exist?
SELECT to_regclass('public.recurring_incomes');
-- If NULL: run the migration. If non-NULL: SKIP (already applied).
```
Run if absent: copy full content of `supabase/migrations/20260405_recurring_incomes.sql`.

**What breaks without this:** Recurring income templates show empty (graceful degradation). Template CRUD drawer saves fail silently (Supabase returns 42P01 table-not-found). Migration 3 CANNOT run without this one first (FK dependency).

---

#### Migration 3 — `supabase/migrations/20260406_incomes_v2_phase1.sql`
```sql
-- Pre-check: does recurring_income_confirmations table exist?
SELECT to_regclass('public.recurring_income_confirmations');
-- If NULL: run the migration. If non-NULL: SKIP (already applied).
-- Also confirm: recurring_incomes must exist before running this.
```
Run if absent: copy full content of `supabase/migrations/20260406_incomes_v2_phase1.sql`.

**What breaks without this:** Monthly status badges on template rows stuck at "מצופה" (no confirmation data). "התקבל" / "לא התקבל" buttons save to `recurring_income_confirmations` which doesn't exist → silent error. `recurring_income_id` FK missing → confirmed arrivals not linked to templates, they appear as separate one-time rows in the table.

---

**Required execution order:** Migration 1 → Migration 2 → Migration 3 (or 2→1→3; but 3 MUST be last).

**Idempotency warnings:**
- Migration 1: NO `IF NOT EXISTS` — will fail if column already exists. Use pre-check above.
- Migration 2: NO `IF NOT EXISTS` on `CREATE TABLE` or `CREATE POLICY` — will fail if run twice. Use pre-check above.
- Migration 3: Uses `IF NOT EXISTS` on column/table/index — safe. `CREATE POLICY` is not guarded but only runs on a new table so is safe on first run.

---

### ⚠️ P0 — Variable Expense Delete: RLS Policy Fix Required (financial_movements)
- **Symptom:** Some variable expenses cannot be deleted — red error banner shown. Rows created by a different account member fail silently at the DB level (0 rows affected, no RLS error returned).
- **Root cause:** DELETE RLS policy on `financial_movements` is creator-only (`user_id = auth.uid()`). In couple/family accounts, a member cannot delete rows created by another member.
- **Fix:** Migration file ready at `supabase/migrations/20260403_fix_financial_movements_delete_rls.sql`
- **Action required:** Run the following in Supabase SQL editor:

```sql
-- Drop old creator-only DELETE policies (covers common naming patterns)
DROP POLICY IF EXISTS "Users can delete own financial movements"       ON financial_movements;
DROP POLICY IF EXISTS "users can delete own financial movements"       ON financial_movements;
DROP POLICY IF EXISTS "Users can delete their own financial movements" ON financial_movements;
DROP POLICY IF EXISTS "Allow individual delete access"                 ON financial_movements;
DROP POLICY IF EXISTS "Enable delete for users based on user_id"       ON financial_movements;
DROP POLICY IF EXISTS "financial_movements_delete_policy"              ON financial_movements;
DROP POLICY IF EXISTS "account members can delete movements"           ON financial_movements;

-- Replace with account-member-scoped DELETE
CREATE POLICY "account members can delete movements"
ON financial_movements
FOR DELETE
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
);
```

- **Safety:** Any member can delete any movement in their own account only. Cross-account deletion is impossible (account_id must be in their `account_members` rows).
- **Personal accounts:** Unaffected — sole member is always the creator.
- **After running:** Variable expense delete works for all account members. The client-side `.select('id')` check (already in code) will confirm real deletion and show a proper error for any edge case.

---

### `account_invitations` DB Table + RPCs Missing (Settings — Members tab)
- **Blocker:** SettingsPage invite flow degrades gracefully but shows "מיגרציה נדרשת" if table absent
- **No supabase/ migrations folder in repo** — run manually in Supabase SQL editor
- **Security model:** `account_invitations` table is NOT publicly readable. Two `SECURITY DEFINER` RPCs handle token-scoped access without exposing the table.
- **Migration SQL to run in Supabase SQL editor (one block):**

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- account_invitations migration — idempotent, safe to run on fresh or
-- existing state. Can be re-run without error.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Table (skipped if already exists) ─────────────────────────────────────
create table if not exists account_invitations (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references accounts(id) on delete cascade,
  invited_by  uuid        references auth.users(id) on delete set null,
  email       text        not null,
  role        text        not null default 'partner',
  token       text        not null default encode(gen_random_bytes(32), 'hex'),
  status      text        not null default 'pending',
  created_at  timestamptz not null default now()
);

-- ── 2. Constraints — added via DO blocks so re-runs are safe ─────────────────
-- ALTER TABLE ADD CONSTRAINT IF NOT EXISTS is not standard PostgreSQL syntax;
-- exception-catching DO blocks are the safe idempotent pattern.

do $$ begin
  alter table account_invitations
    add constraint account_invitations_token_unique unique (token);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table account_invitations
    add constraint account_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table account_invitations
    add constraint account_invitations_role_check
    check (role in ('partner', 'child'));
exception when duplicate_object then null; end $$;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
alter table account_invitations enable row level security;

-- ── 4. RLS policies — drop-then-create for idempotency ───────────────────────
-- Drops all known names (old blanket policy + new per-op policies) before recreating.
drop policy if exists "account members can manage invitations"     on account_invitations;
drop policy if exists "public can read invitation by token"        on account_invitations;
drop policy if exists "members can select own account invitations"  on account_invitations;
drop policy if exists "members can insert invitations for own account" on account_invitations;
drop policy if exists "members can update own account invitations"  on account_invitations;

-- SELECT: authenticated account members see only their own account's invitations
create policy "members can select own account invitations"
  on account_invitations for select
  using (
    account_id in (select account_id from account_members where user_id = auth.uid())
  );

-- INSERT: authenticated account members can create invitations for their own account
create policy "members can insert invitations for own account"
  on account_invitations for insert
  with check (
    account_id in (select account_id from account_members where user_id = auth.uid())
  );

-- UPDATE: authenticated account members can update (revoke) their own account's invitations
create policy "members can update own account invitations"
  on account_invitations for update
  using  (account_id in (select account_id from account_members where user_id = auth.uid()))
  with check (account_id in (select account_id from account_members where user_id = auth.uid()));

-- No DELETE policy — rows are soft-revoked via status update, never hard-deleted

-- ── 5. Unique membership guard on account_members ────────────────────────────
do $$ begin
  alter table account_members
    add constraint account_members_account_user_unique unique (account_id, user_id);
exception when duplicate_object then null; end $$;

-- ── 6. RPC: get_invitation_by_token ──────────────────────────────────────────
-- Returns only {id, status, role} — never exposes email, account_id, or token.
-- SECURITY DEFINER bypasses RLS. PUBLIC execute revoked before targeted grants.
-- create or replace is idempotent.
create or replace function get_invitation_by_token(p_token text)
returns table (id uuid, status text, role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select ai.id, ai.status, ai.role
  from account_invitations ai
  where ai.token = p_token
  limit 1;
end;
$$;

revoke all on function get_invitation_by_token(text) from public;
grant execute on function get_invitation_by_token(text) to anon;
grant execute on function get_invitation_by_token(text) to authenticated;

-- ── 7. RPC: accept_invitation_by_token ───────────────────────────────────────
-- Authenticated only. Email-bound via auth.users (authoritative, not JWT claim).
-- Atomically: validates token → checks email → inserts membership → marks accepted.
-- Returns: { ok: true } | { error: string }
create or replace function accept_invitation_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv        account_invitations%rowtype;
  v_uid        uuid := auth.uid();
  v_user_email text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  -- Authoritative email from auth.users — not the JWT claim, which may be stale
  select email into v_user_email from auth.users where id = v_uid;

  select * into v_inv
  from account_invitations
  where token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_inv.status = 'revoked' then
    return jsonb_build_object('error', 'revoked');
  end if;

  if v_inv.status = 'accepted' then
    return jsonb_build_object('error', 'already_accepted');
  end if;

  if v_inv.status <> 'pending' then
    return jsonb_build_object('error', 'invalid');
  end if;

  -- Email binding: only the invited user may accept
  if v_user_email is null or lower(v_user_email) <> lower(v_inv.email) then
    return jsonb_build_object('error', 'email_mismatch');
  end if;

  -- Insert membership; unique constraint handles already-a-member silently
  begin
    insert into account_members (account_id, user_id, role)
    values (v_inv.account_id, v_uid, v_inv.role);
  exception when unique_violation then
    null;
  end;

  update account_invitations
  set status = 'accepted'
  where id = v_inv.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function accept_invitation_by_token(text) from public;
grant execute on function accept_invitation_by_token(text) to authenticated;
```

- **Unblocks:** Full invite create → copy-link → accept flow

### `/invite/:token` Route — Implemented (needs DB table to be live)
- **Status:** Route added to `src/App.tsx`, `InviteAcceptPage.tsx` created and complete
- **Remaining blocker:** Only becomes functional once `account_invitations` migration is run
- **Redirect chain:** Login → `?redirect=/invite/:token` → lands on invite. Signup → Onboarding (with threaded redirect) → invite. Fully implemented.
- **Note:** The migration SQL above includes owner-only RLS policies (SELECT/INSERT/UPDATE) and supersedes the old member-level SQL. Run only the combined block above.

### Billing — Tranzila Activation (remaining steps only)
**Provider:** Tranzila (Israeli payment processor, ILS)
**Already done:** Supabase CLI linked ✅, `tranzila-checkout` deployed ✅, `tranzila-notify` deployed ✅, `APP_URL` secret set ✅, security hardening (nonce model) ✅

**Step 0 — Run `billing_pending_payments` migration (REQUIRED — hardened functions depend on this table):**
Run in Supabase SQL editor — file already at `supabase/migrations/20260403_billing_pending_payments.sql`:
```sql
-- (copy from supabase/migrations/20260403_billing_pending_payments.sql)
```
Then redeploy the hardened functions:
```bash
npx supabase@latest functions deploy tranzila-checkout tranzila-notify --project-ref xvkobtfilvacfurislvp
```

**Step 1 — Set Tranzila secrets (from your Tranzila merchant dashboard):**
```bash
npx supabase@latest secrets set TRANZILA_TERMINAL=<your-terminal-number>
npx supabase@latest secrets set TRANZILA_API_KEY=<your-tranzila-tk-key>
npx supabase@latest secrets set TRANZILA_PRICE_PERSONAL=29
npx supabase@latest secrets set TRANZILA_PRICE_COUPLE=49
npx supabase@latest secrets set TRANZILA_PRICE_FAMILY=69
```
Adjust prices (in ILS) as needed. Get terminal + key from Tranzila merchant portal.

**Step 2 — Configure notify URL in Tranzila dashboard:**
Set the server notification (notify) URL for your terminal to:
```
https://xvkobtfilvacfurislvp.supabase.co/functions/v1/tranzila-notify
```

**Step 3 — For go-live: update APP_URL to production domain:**
```bash
npx supabase@latest secrets set APP_URL=https://your-domain.com
```

**What works right now without secrets:**
- `account_subscriptions` table read/display is fully real
- Settings > מנוי וחיוב shows "אין מנוי פעיל" truthfully

**What is blocked until Step 0-2 are done:**
- Checkout redirect (needs migration + TRANZILA_TERMINAL, TRANZILA_API_KEY, prices)
- Payment state sync (needs notify URL set in Tranzila dashboard)

**Security model (post-hardening):**
- `tranzila-checkout` stores account_id + plan + expected_sum in `billing_pending_payments` (nonce row); passes only the opaque nonce UUID as `id` to Tranzila
- `tranzila-notify` looks up nonce from DB — account_id/plan never read from callback body
- Nonce verified: must exist, unused, not expired, sum must match
- Terminal check: always enforced, no bypass if `supplier` absent
- `isApproved` requires both `confirmationCode` non-empty AND `responseCode === "000"` strictly

### `VITE_PUBLIC_APP_URL` required for external invite sharing
- **Needed for invite links to work outside the local network**
- Set in `.env.local`: `VITE_PUBLIC_APP_URL=https://your-domain.com` (or ngrok/tunnel URL)
- Without it, `buildInviteUrl()` falls back to `window.location.origin`
- UI now shows scope-aware warnings: 'localhost' → LAN instructions; 'lan' → external sharing note; 'public' → no warning
- **For same-Wi-Fi phone testing (no deployment needed):** run `npm run dev:lan` — Vite prints the LAN URL (e.g. `http://192.168.x.x:5173`). Open that URL on the phone. Invite links will use the LAN IP automatically.
- `.env.example` added to repo with documentation

---

## Decisions Needed Before Proceeding

### Income Attribution (Stage 2)
- **Blocker:** Need to confirm `attributed_to_type` and `attributed_to_member_id` columns exist on `financial_movements` for income rows
- **How to check:** `grep "attributed_to" src/pages/IncomesPage.tsx` — if not in the select string, confirm with Supabase table editor
- **Unblocks:** Income attribution form + filter in IncomesPage

### Health Score Sub-Formulas
- **Blocker:** Only the savings rate formula (score = savingsRate >= 20 ? 25 : ...) is confirmed correct
- **Remaining 3 sub-scores:** spending control, budget adherence, financial diversity — formulas need product owner confirmation before changing
- **Impact:** Do not touch DashboardPage health score logic until confirmed
- **Location:** `src/pages/DashboardPage.tsx` — look for `healthScore` calculation

---

## Technical Debt (Not Blocking)

- `npx tsc --noEmit` verified clean after Settings rewrite (2026-04-02) ✅
- Mobile FAB (in AppLayout) only shows on `hidden lg:flex` — mobile FAB likely already exists separately in some pages — verify no duplication
- IncomesPage payment method label: still says "אמצעי קבלה" — should be "הופקד לחשבון" per income model spec (Stage 3)

---

## Out of Scope (Intentionally Deferred)

- Source `owner_member_id` field on payment_sources — needed for Stage 2 "who paid" attribution
- Recurring expense attribution — out of scope for v1, will follow expense attribution model
- Income analytics page — not yet planned, depends on income type + attribution being done first
