# Session Checkpoint

**Date:** 2026-04-03
**Session summary:** Settings module fully closed — 100% functionally complete. Tranzila security hardening. Full Settings pass (all 9 tabs), ImportWizard, QA, cleanup, 100% closeout. No dead controls remain.
**Module closed:** Settings ✅
**Next module:** TBD — see Next Session Priority below

---

## Completed This Session (latest)

### Settings 100% closeout — no dead controls (2026-04-03)
- **Notifications tab**: 6 real interactive toggles; `notifs` state loaded from `nmoney_notification_prefs` localStorage on mount; `toggleNotif(key)` auto-saves on every click; removed static disabled UI and honest-but-fake banner; honest subtitle retained ("preferences saved on this device — delivery when infra ready")
- **Display tab**: theme selector block removed (no dark: CSS in codebase); date format selector removed (formatDate hardcodes he-IL); only language remains (read-only, Hebrew-only, honest)
- **Budget Defaults tab**: `defaultBudgetDay` selector removed (BudgetPage uses hardcoded calendar month; full wiring would require BudgetPage changes); `savingsGoalPct` slider is the only control — real and localStorage-backed
- Dead state removed: `theme`, `dateFormat`, `defaultBudgetDay`
- TypeScript: `npx tsc --noEmit` clean ✓
- **Settings is now 100% functionally complete for the current product stage — no disabled placeholders**

---

### Settings final closeout (2026-04-03)
- **Notifications tab**: removed all interactive toggles and save button; converted to read-only preview with honest "infrastructure not yet active" banner
- **Display tab**: theme dark/auto options visually shown but disabled ("בקרוב"); date format selector disabled (app uses hardcoded Hebrew locale); save button removed from Display entirely
- **Budget Defaults / defaultBudgetDay**: selector disabled; honest note explains current behavior (calendar month)
- **Budget Defaults / savingsGoalPct**: IMPLEMENTED REAL PERSISTENCE — loads from localStorage on mount; saves to `nmoney_savings_goal_pct` on "שמור שינויים"; DashboardPage health score now reads from localStorage (replaces hardcoded `/ 0.20`)
- Dead state removed: `notifs`/`setNotifs`, `setTheme`, `setDateFormat`, `setDefaultBudgetDay`
- Save button now only shown for 'profile' and 'budget' (both have real persistence)
- TypeScript: `npx tsc --noEmit` clean ✓
- **Settings is now fully closed for the current product stage**

### Settings QA + cleanup (2026-04-03)
- QA audit of all 9 Settings tabs — 2 bugs found and fixed
- **Bug fix:** `ImportWizard` step indicator rendered circles with numbers 1, 3, 4 in happy path — fixed to 1, 2, 3 (`i + 1` instead of `s.n`)
- **Bug fix:** Notifications tab copy falsely claimed settings persist — corrected to honest "לא מתמידות בין טעינות"
- Removed dead billing state/code: `billingActionLoading`, `billingActionError`, `handleStartBillingFlow`, `startBillingFlow` import — all were unreferenced in JSX after launch-period billing model was adopted
- `docs/PRODUCT_DECISIONS.md` — `transfer` source type added to locked Payment Sources list
- `docs/MODULE_STATUS.md` — Settings section updated to V1 stable; Data Management now reflects real XLSX export + full import wizard
- TypeScript: `npx tsc --noEmit` clean ✓
- **Settings V1 is now closed for this stage**

### Real Excel import — full implementation (2026-04-03)
- `src/lib/importParser.ts` (NEW) — unified CSV + XLSX parser: `parseFile`, `detectColMap`, `requiredDetected`, `buildImportRows`, `inferCategory`, `inferPaymentMethod`; dynamic `import('xlsx')`; date normalization (DD/MM/YYYY, Excel serial); amount cleaning; category + payment method inference
- `src/components/ImportWizard.tsx` (NEW) — self-contained 4-step wizard: upload → (column mapping if auto-detect fails) → preview → done; accepts `.xlsx`, `.xls`, `.csv`; error display per row; invalid row count summary; inserts to `financial_movements`
- `src/pages/SettingsPage.tsx` — removed old CSV-only handlers (`parseCSVLine`, `handleCSVFileChange`, `handleDownloadTemplate`, `handleImportConfirm`, old `ImportRow` interface, old import state); replaced with `<ImportWizard>` component; `handleExportCSV` replaced with real `handleExportXLSX` using SheetJS `json_to_sheet` + `writeFile`
- TypeScript: `npx tsc --noEmit` clean ✓

### Tranzila security hardening — nonce-based callback authentication
- `supabase/migrations/20260403_billing_pending_payments.sql` — new table (nonce storage)
- `supabase/functions/tranzila-checkout/index.ts` — rewritten: inserts nonce row, passes only UUID to Tranzila
- `supabase/functions/tranzila-notify/index.ts` — rewritten: nonce lookup, expiry+replay check, strict terminal+sum validation, account_id/plan from DB only
- **Migration must be run in Supabase SQL editor before redeploying functions**

### Payment Sources + Data Management pass (2026-04-03)
- `src/lib/paymentMethods.ts`: Added `transfer` (העברה בנקאית) to SOURCE_TYPES + SOURCE_TYPE_TO_PM; added `icon` + `hint` fields to SOURCE_TYPES; `bank` label updated from 'חשבון עו״ש' → 'חשבון בנק'; backward-compatible
- `src/pages/SettingsPage.tsx` — Payments tab: Visual type selector grid in add + edit form; type icon badges in source list; colored circle avatar with type emoji; better empty state; separation-from-billing note; sidebar renamed "אמצעי תשלום"
- `src/pages/SettingsPage.tsx` — Data tab: Excel-first hierarchy (ייצוא ל-Excel as primary action); PDF primary; 3-step import wizard with step indicator; pre-upload instructions for Excel→CSV; status column in preview table; Google Sheets "בקרוב" placeholder card; sidebar renamed "ייצוא וייבוא"; cloud backup copy improved
- `docs/PAYMENT_SOURCES.md`: Updated source types table with new `transfer` type + icon column

### Settings final polish pass — all 7 tabs
- **Sidebar:** billing tab renamed to "תוכנית שימוש"
- **Profile:** subtitle added, "מצב תעסוקה" label, placeholder text, helper copy
- **Account Structure:** improved copy, account type descriptions (benefit-focused), positive couple-single-member nudge, simplified invite scope warnings (non-technical), personal account empty state improved
- **Billing/Subscription (major rework):** "תוכנית שימוש" model, launch period banner, status summary grid (free/not-yet-billed), plan selector with descriptions, CTA is "שמור מסלול נבחר" (not pay), billing history honest empty state — no live-billing language anywhere
- **Security:** consolidated auth method + password reset into one card, improved 2FA value prop copy, tightened delete account copy (no dead space)
- **Notifications:** grouped into "התראות פיננסיות" and "תזכורות ודוחות", improved microcopy throughout
- **Display:** language honest ("עברית בלבד בשלב זה"), date format shows example, "לפי מכשיר" label, change-takes-effect note added
- **Budget:** subtitle, dynamic budget day helper text, savings % helper shows 50/30/20 context, colored info box
- TypeScript: `npx tsc --noEmit` clean ✓

---

## Previous Session (2026-04-03)
**Billing V1 architecture + subscription source-of-truth pass + owner invite fix + non-SQL invite stabilization**

---

## Completed This Session

### Settings / Invite stabilization — full pass (TypeScript clean)

**New file: `src/lib/inviteUrl.ts`**
- `buildInviteUrl(token)` — uses `VITE_PUBLIC_APP_URL`, falls back to origin, returns `{ url, isLocalOnly }`
- `isLocalDevOrigin()` — localhost/LAN detection for proactive UI warning

**Auth redirect chain — fully wired:**
- `LoginPage.tsx` — reads `?redirect=`, navigates there after login (internal paths only)
- `SignupPage.tsx` — threads `?redirect=` through to `/onboarding?redirect=...`
- `OnboardingPage.tsx` — reads `?redirect=` after complete/skip; replaces hardcoded `/dashboard`
- `InviteAcceptPage.tsx` — login/signup links include `?redirect=/invite/:token`

**SettingsPage — account section rewrite:**
- Account type conversion (owner-only): personal / couple / family inline buttons, downgrade guard
- Invite management gated on `currentMember?.role === 'owner'`; non-owners see read-only notice
- `buildInviteUrl()` for copy; `isLocalDevOrigin()` warning banner
- Copy: "לא נשלח דוא״ל — שתף ידנית" (no email infra — truthful)

**Migration SQL (CURRENT_BLOCKERS.md):**
- Idempotent `account_invitations` table + constraints
- Per-operation RLS (SELECT/INSERT/UPDATE); no public SELECT — SECURITY DEFINER RPCs only
- `get_invitation_by_token` — returns `{id, status, role}` to anon+authenticated
- `accept_invitation_by_token` — email-bound (from `auth.users`), authenticated only
- REVOKE ALL FROM PUBLIC before targeted GRANTs on both RPCs
- Owner-only INSERT RLS fix documented as separate follow-up step

### Settings / Invite stabilization — full pass (TypeScript clean)

**New file: `src/lib/inviteUrl.ts`**
- `buildInviteUrl(token)` — uses `VITE_PUBLIC_APP_URL`, falls back to origin, returns `{ url, scope, isLocalOnly }`
- `InviteScope = 'public' | 'lan' | 'localhost'`; `getCurrentOriginScope()` for proactive UI warning

**Auth redirect chain — fully wired:**
- `LoginPage.tsx` — reads `?redirect=`, navigates there after login
- `SignupPage.tsx` — threads `?redirect=` through to onboarding
- `OnboardingPage.tsx` — reads `?redirect=` after complete/skip
- `InviteAcceptPage.tsx` — login/signup links include `?redirect=/invite/:token`
- `App.tsx` — `RedirectIfAuthed` component: already-authed users on `/login`/`/signup` respect `?redirect=`

### Owner invite visibility fix (AccountContext)
- Split `account_members` + `user_profiles` join into two plain queries
- Fixes silent null on `members`, restores `currentMember.role === 'owner'`, owner sees full invite management

### Billing V1 — scaffolded
- `supabase/functions/stripe-checkout/index.ts` — Stripe Checkout Sessions
- `supabase/functions/stripe-portal/index.ts` — Stripe Billing Portal
- `supabase/functions/stripe-webhook/index.ts` — event handler, upserts `account_subscriptions`
- `src/lib/billing.ts` — all client helpers + display helpers
- `src/pages/SettingsPage.tsx` — מנוי וחיוב tab with full real UI

### Subscription source-of-truth — locked
- `src/lib/billing.ts`: `planForAccountType()`, `isSubscriptionSynced()`, `getEffectiveAccountType()`
- `src/pages/SettingsPage.tsx`: `checkoutPlan` init via `planForAccountType(accountType)`; sync-mismatch warning
- `docs/PRODUCT_DECISIONS.md`: billing source-of-truth section added (locked)

---

### Last Known Good State

- TypeScript: ✅ clean (verified after all changes)
- Files changed (this session):
  - `src/context/AccountContext.tsx`
  - `src/lib/inviteUrl.ts` (new)
  - `src/lib/billing.ts` (new)
  - `src/pages/SettingsPage.tsx`
  - `src/App.tsx`
  - `package.json`
  - `.env.example` (new)
  - `supabase/functions/stripe-checkout/index.ts` (new)
  - `supabase/functions/stripe-portal/index.ts` (new)
  - `supabase/functions/stripe-webhook/index.ts` (new)
  - `handoff/CURRENT_BLOCKERS.md`
  - `docs/MODULE_STATUS.md`
  - `docs/PRODUCT_DECISIONS.md`
  - `docs/CHANGELOG.md`

---

## Next Session Priority

**P0 (done):** `account_invitations` migration already run successfully in Supabase ✅
**P0.5:** Run owner-only INSERT/UPDATE RLS fix for `account_invitations` (SQL in CURRENT_BLOCKERS.md)
**P0.5:** Run `account_subscriptions` migration SQL (in CURRENT_BLOCKERS.md) to unblock billing tab
**P0.5:** Set `VITE_PUBLIC_APP_URL` in production `.env`
**P1 (billing):** Deploy Edge Functions + configure Stripe secrets + configure webhook
**P2 (product):** Income type sub-category picker — `docs/skills/INCOME_MODEL_PLAYBOOK.md` Stage 1
**P3:** Income attribution (Stage 2)
**P4:** Audit BudgetPage / AssetsPage / LoansPage (all ⚠️ needs review)

---

## Active Decisions (Do Not Reverse)

- Attribution is explicit user choice — NEVER infer from payment source
- Attribution shows only for `(isCouple || isFamily) && txType === 'expense'`
- No logout button in SettingsPage — logout lives in AppLayout only
- Internal navigation uses `<Link to>` never `<a href>`
- Account deletion from client purges data tables + signOut; auth user removal is server-side
- Invite flow is copy-link only — no email infra in repo; UI copy must reflect this
- `account_invitations` table is NOT publicly readable — SECURITY DEFINER RPCs are the only access path
- Email binding on invite acceptance uses `auth.users` (authoritative), not JWT claim
- `accounts.type` is authoritative for household structure and feature access — billing state never consulted in `useAccountFeatures`
- `account_subscriptions` is written only by Stripe webhook (service role) — no client INSERT/UPDATE
- `getEffectiveAccountType()` is the single enforcement point for feature gating; all feature gates must call it
