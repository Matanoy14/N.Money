# Module Status

Last updated: 2026-04-02

---

## Auth (AuthContext, LoginPage, SignupPage, ForgotPasswordPage)
**Status:** ✅ Stable
**What exists:** Login, signup, logout, token refresh safe (setLoading only in getSession), ProtectedRoute waits for both auth + account loading. `?redirect=` param preserved through Login, Signup, and Onboarding (all three now thread the param to the final destination).
**Key gaps:** Password reset email works but no confirm-reset page yet
**Next step:** None urgent

---

## Onboarding (OnboardingPage)
**Status:** ✅ Complete
**What exists:** 4-step wizard (account type → profiling → input method → done), saves to user_profiles + accounts
**Key gaps:** None known
**Next step:** None

---

## Dashboard (DashboardPage)
**Status:** ✅ Working, some polish gaps
**What exists:** 4 KPI cards, health score, income vs expense bar chart, expense donut, budget widget, top categories, recent movements. All data from real Supabase queries.
**Key gaps:** Internal links converted to `<Link>` (done). Some widget labels could be clearer.
**Next step:** None blocking

---

## Transactions (TransactionsPage)
**Status:** ✅ Working
**What exists:** Full CRUD, month-scoped, type filter, search, attribution field (couple/family), ?add=true URL param, payment source chips
**Key gaps:** Add panel slides from right in desktop (left-edge panel — minor RTL mismatch). Voice input is stub.
**Next step:** None blocking

---

## Incomes (IncomesPage)
**Status:** ✅ Working, model limitations
**What exists:** Full CRUD, month-scoped, payment method/source selection
**Key gaps:** No income category (all = 'income'). No attribution. Payment method semantics wrong for income (should be "received into" not "paid with"). See `docs/INCOMES_MODEL.md`.
**Next step:** Incomes attribution — not yet started. See sprint backlog.

---

## Budget (BudgetPage)
**Status:** ⚠️ Needs review — not inspected this session
**What exists:** Monthly budget per category
**Key gaps:** needs confirmation — category display names (raw IDs vs Hebrew) may still be an issue
**Next step:** Audit pass

---

## Fixed Expenses (FixedExpensesPage)
**Status:** ✅ Working, feature-rich
**What exists:** Recurring expense templates, monthly confirmation flow, edit scopes (future/retroactive/current-only), preset recurrence intervals, custom interval, charge-count limits
**Key gaps:** Attribution not applied to recurring confirmations (legacy rows unattributed)
**Next step:** None blocking

---

## Expense Analysis (ExpenseAnalysisPage)
**Status:** ✅ Working, substantially polished
**What exists:** Payment filter, attribution filter (couple/family), KPI+mini-bars summary card, donut chart, attribution breakdown, full category ranking, category drill-down with subcategories and transactions
**Key gaps:** None blocking
**Next step:** None

---

## Payment Sources (SettingsPage — payments section)
**Status:** ✅ Working
**What exists:** Create, deactivate (soft delete), name/type/color picker. Types: credit, bank, bit, paybox, cash. Used across all expense/income pages.
**Key gaps:** No owner_member_id on sources yet (out of scope for now)
**Next step:** None

---

## Billing (Settings > מנוי וחיוב)
**Status:** ⚙️ Code-complete — infrastructure activation required
**What exists:**
- `account_subscriptions` migration: `supabase/migrations/20260403_account_subscriptions.sql` (not yet run)
- `supabase/config.toml`: function config with `verify_jwt = false` for all three functions
- Supabase Edge Functions: `stripe-checkout`, `stripe-portal`, `stripe-webhook` — code complete, not deployed
- `src/lib/billing.ts` — client helpers: `fetchAccountSubscription`, `startCheckout`, `openBillingPortal`, display helpers + source-of-truth helpers (`planForAccountType`, `isSubscriptionSynced`, `getEffectiveAccountType`)
- Settings > מנוי וחיוב tab — handles all states: loading, table_missing, no sub, trial, active, canceled, past_due, sync-mismatch warning, billing history
- `?billing=success` / `?billing=cancel` return URL params handled — auto-opens billing tab, shows banner
- Billing strictly separated from internal payment sources
**Key gaps (infrastructure only — no code gaps):**
- `account_subscriptions` table not yet created — run `supabase/migrations/20260403_account_subscriptions.sql`
- Edge functions not deployed — full 7-step checklist in CURRENT_BLOCKERS.md
- Stripe products/prices not configured; secrets not set
- Webhook not configured in Stripe Dashboard
**Future work (mobile):** same table accepts App Store / Google Play states via native handler; no redesign needed
**Next step:** Follow full activation checklist in CURRENT_BLOCKERS.md

---

## Settings (SettingsPage)
**Status:** ✅ CLOSED — 100% functionally complete for current product stage (2026-04-03)
**What exists:**
- **Profile:** `display_name` + `employment_type` — DB persisted to `user_profiles`; reloads on mount (**real**)
- **Payment Sources:** Full CRUD (add/edit/deactivate), inline edit, usage counts; types: credit, bank, transfer, bit, paybox, cash; DB persisted to `payment_sources` (**real**)
- **Account/Members:** Account type is display-only — owners directed to Usage/Plan tab to change it; member removal from `account_members`; owner-only invite flow writes to `account_invitations` with graceful degradation if table missing; copy-link only (no email infra) (**real, pending DB migration**)
- **Security:** Real password reset email (Supabase auth), real TOTP 2FA (`supabase.auth.mfa.*` enroll/verify/unenroll), account deletion with full data purge + signOut (**real**)
- **Subscription/Usage:** Single source for account type change — `handleSavePlan` writes `checkoutPlan` to both localStorage and `accounts.type` DB; downgrade guard; launch-period model (no live billing CTA); honest status grid; renders real subscription row when `account_subscriptions` exists (**DB + local, real**)
- **Data Management:** Real `.xlsx` export (SheetJS); PDF via browser print; full `ImportWizard` (`.xlsx/.xls/.csv`, auto-detect columns, manual mapping fallback, per-row validation, inserts to `financial_movements`) (**fully real**)
- **Notifications:** 6 interactive toggles (3 financial + 3 reminders); `notifs` state loads from `nmoney_notification_prefs` localStorage; auto-saves on every toggle; no fake persistence — honest subtitle that delivery awaits infra (**local-only but real**)
- **Display:** Theme and date-format selectors removed (no dark-mode CSS exists; `formatDate` hardcodes `he-IL`); only language field remains — read-only, Hebrew-only, honest (**minimal, truthful**)
- **Budget Defaults:** `savingsGoalPct` slider — localStorage-backed, drives DashboardPage health score; `defaultBudgetDay` removed (BudgetPage uses hardcoded calendar month) (**savings goal: real; budget day: removed — no consumer exists**)
- **Invite accept route:** `/invite/:token` → `InviteAcceptPage.tsx` fully wired with `?redirect=` chain through Login/Signup/Onboarding (**real**)
**Excluded from Settings scope (infrastructure only — no code changes needed):**
- `account_invitations` DB table + owner-only RLS policies must be run in Supabase SQL editor (SQL in CURRENT_BLOCKERS.md) — code degrades gracefully until then
- `VITE_PUBLIC_APP_URL` must be set in production `.env` for invite links to work externally
- Tranzila merchant activation (billing_pending_payments migration + secrets) — separate ops task
- Account deletion cannot remove Supabase auth user from client — requires server-side handling
**Known limitations (accepted for v1):**
- Import: no `payment_source_id` linkage; no duplicate detection
**Next step for this module:** None — closed. Run infra blockers when ready.

---

## Assets (AssetsPage)
**Status:** ⚠️ Needs review — not inspected this session
**What exists:** Asset records
**Key gaps:** needs confirmation
**Next step:** Audit pass

---

## Loans (LoansPage)
**Status:** ⚠️ Needs review — not inspected this session
**What exists:** Loan records
**Key gaps:** needs confirmation
**Next step:** Audit pass

---

## Goals (GoalsPage)
**Status:** ⚠️ Needs review — not inspected this session
**Key gaps:** needs confirmation
**Next step:** Audit pass

---

## Calculators (CalculatorsPage)
**Status:** ⚠️ Needs review — not inspected
**Next step:** Audit pass

---

## Guides (GuidesPage)
**Status:** ⚠️ Needs review — not inspected
**Next step:** Audit pass

---

## AppLayout (shell)
**Status:** ✅ Stable
**What exists:** Desktop sidebar (RTL right), mobile top bar, mobile bottom nav (4 tabs + center FAB), mobile drawer, desktop FAB "הוסף עסקה" (hidden on /settings), useLocation for FAB visibility
**Key gaps:** None
