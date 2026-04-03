# Changelog

Format: [date] — summary of meaningful changes

---

## 2026-04-03 — Account type: single change path

- **`src/pages/SettingsPage.tsx`:** Account Structure tab no longer offers type-changing controls — now display-only with a "עבור לתוכנית שימוש" link for owners
- **`src/pages/SettingsPage.tsx`:** Usage/Plan tab (`handleSavePlan`) is now the single path that writes `accounts.type` to DB — includes downgrade guard (personal blocked if >1 members), localStorage save, loading/error/success feedback
- Dead state removed: `pendingAccountType`, `savingAccountType`, `accountTypeError`, `accountTypeSaved`; dead handler `handleChangeAccountType` removed
- `docs/PRODUCT_DECISIONS.md`: "Account Type Change — Single Source" section added and locked
- TypeScript clean ✓

---

## 2026-04-03 — Settings milestone closed

**Settings is now 100% functionally complete for the current product stage. No disabled placeholders, no dead controls.**

### Summary of all Settings work this session
| Tab | Outcome |
|-----|---------|
| Profile | DB-persisted (display_name, employment_type) |
| Payment Sources | Full CRUD, inline edit, usage counts, 6 source types |
| Account/Members | Type conversion, member remove, owner-only invite flow (copy-link), graceful degradation |
| Security | Real password reset, real TOTP 2FA, real account deletion |
| Subscription/Usage | Launch-period model, localStorage plan, honest UI |
| Data Management | Real XLSX export + full ImportWizard (XLSX/XLS/CSV) |
| Notifications | 6 real interactive toggles, localStorage-persisted, honest delivery note |
| Display | Theme + date-format selectors removed (no implementation); language read-only |
| Budget Defaults | savingsGoalPct: real + wired to health score; defaultBudgetDay: removed (no consumer) |

### Files changed across all Settings passes (this session)
- `src/pages/SettingsPage.tsx` — all 9 tab rewrites
- `src/pages/DashboardPage.tsx` — health score reads `nmoney_savings_goal_pct` from localStorage
- `src/lib/importParser.ts` (new) — unified CSV+XLSX parse/validate/inference engine
- `src/components/ImportWizard.tsx` (new) — self-contained 4-step import wizard
- `src/lib/paymentMethods.ts` — `transfer` type added
- `supabase/functions/tranzila-checkout/index.ts` — nonce-based hardening
- `supabase/functions/tranzila-notify/index.ts` — nonce-based hardening
- `supabase/migrations/20260403_billing_pending_payments.sql` (new)
- `docs/MODULE_STATUS.md`, `docs/PRODUCT_DECISIONS.md`, `docs/PAYMENT_SOURCES.md`
- `handoff/SESSION_CHECKPOINT.md`, `handoff/CURRENT_BLOCKERS.md`

### TypeScript
- `npx tsc --noEmit` ✅ clean after all changes

---

## 2026-04-03 (Settings final closeout)

### Settings module — full truthfulness pass
- **`src/pages/SettingsPage.tsx`:** Notifications tab converted to read-only preview (toggles disabled, save button removed, honest "tbd" banner); Display tab theme/dark mode and date format disabled with honest notes (save button removed); Budget Defaults tab: `defaultBudgetDay` disabled (current behavior explained), `savingsGoalPct` wired to localStorage — now genuinely persists and affects health score; save button retained for budget tab only
- **`src/pages/DashboardPage.tsx`:** Health score savings rate sub-formula now reads `nmoney_savings_goal_pct` from localStorage (user's goal) instead of hardcoded 20%
- Dead state removed: `notifs`/`setNotifs`, `setTheme`, `setDateFormat`, `setDefaultBudgetDay` all removed
- `docs/MODULE_STATUS.md` updated to reflect closeout state
- TypeScript clean ✓

### Settings QA + cleanup (same date)
- **Bug fix:** ImportWizard step indicator showed 1,3,4 in happy path — fixed to 1,2,3
- **Bug fix:** Notifications tab had misleading "saved after clicking save" copy — corrected
- Dead billing handlers removed: `handleStartBillingFlow`, `billingActionLoading`, `billingActionError`, `startBillingFlow` import
- `docs/PRODUCT_DECISIONS.md`: `transfer` source type added to locked list

---

## 2026-04-03 (billing V1 + source-of-truth pass)

### Billing architecture — scaffolded end-to-end
- **`supabase/functions/stripe-checkout/index.ts` (new):** Deno Edge Function — validates Bearer token, creates Stripe Checkout Session (subscription mode), passes `account_id` + `plan` in metadata
- **`supabase/functions/stripe-portal/index.ts` (new):** Opens Stripe Billing Portal for existing Stripe customer
- **`supabase/functions/stripe-webhook/index.ts` (new):** Verifies Stripe signature, handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` — upserts `account_subscriptions` with service role key
- **`src/lib/billing.ts` (new):** Provider-agnostic client helpers — `fetchAccountSubscription`, `startCheckout`, `openBillingPortal`, `planLabel`, `statusLabel`, `statusColor`, `formatBillingDate`
- **`src/pages/SettingsPage.tsx`:** Added מנוי וחיוב tab — plan display, status badge, renewal date, checkout CTA, portal CTA, billing history area; graceful degradation for table_missing state
- **`handoff/CURRENT_BLOCKERS.md`:** Added `account_subscriptions` migration SQL + Stripe/Edge Function activation steps
- **`.env.example` (new):** Documents all required env vars; instructs Stripe secrets to be set via `supabase secrets set`
- **`package.json`:** Added `dev:lan` script (`vite --host`) for LAN testing

### Subscription source-of-truth — locked
- **`src/lib/billing.ts`:** Added `planForAccountType()`, `isSubscriptionSynced()`, `getEffectiveAccountType()` — single enforcement points for billing/structure relationship
- **`src/pages/SettingsPage.tsx`:** `checkoutPlan` initialised via `planForAccountType(accountType)`; billing useEffect syncs to `accountType`; sync-mismatch warning shown when `!isSubscriptionSynced()`
- **`docs/PRODUCT_DECISIONS.md`:** Locked billing source-of-truth architecture — `accounts.type` authoritative for features, `account_subscriptions.plan` billing tier only, `getEffectiveAccountType()` single enforcement point

### Owner invite visibility fix (AccountContext)
- **Root cause:** `account_members.select('user_id, role, user_profiles(display_name)')` silently failed — PostgREST couldn't resolve FK path `account_members → user_profiles` (FK targets `auth.users`, not `user_profiles`)
- **Fix:** Split into two queries — plain `account_members` select, then `user_profiles.in('id', ids)` separately
- **Effect:** `members`, `currentMember`, `currentMember.role === 'owner'` now load correctly; owner sees full invite management UI

### Non-SQL invite stabilization
- **`src/lib/inviteUrl.ts`:** `InviteScope = 'public' | 'lan' | 'localhost'`; `getCurrentOriginScope()`; scope-aware warning messages
- **`src/App.tsx`:** Added `RedirectIfAuthed` component — already-authed users on `/login`/`/signup` respect `?redirect=` param
- **`package.json`:** `dev:lan` added (previously noted, consolidated here)

---

## 2026-04-02 (stabilization pass)

### Settings + Invite flow — hardening pass
- **`src/lib/inviteUrl.ts` (new):** `buildInviteUrl(token)` — uses `VITE_PUBLIC_APP_URL` env var, falls back to `window.location.origin`, returns `{ url, isLocalOnly }`. `isLocalDevOrigin()` for proactive localhost warning in Settings UI.
- **`src/pages/LoginPage.tsx`:** Added `?redirect=` param support — after login, navigates to redirect target (internal paths only, falls back to `/dashboard`)
- **`src/pages/SignupPage.tsx`:** Threads `?redirect=` through to `/onboarding?redirect=...` so invite URL survives signup + onboarding
- **`src/pages/OnboardingPage.tsx`:** Reads `?redirect=` after completing or skipping onboarding, navigates there instead of hardcoded `/dashboard`
- **`src/pages/InviteAcceptPage.tsx`:** Login/signup links include `?redirect=/invite/:token` — redirect chain fully wired
- **`src/pages/SettingsPage.tsx` — account section rewrite:**
  - Account type conversion UI (owner-only): inline buttons to change personal / couple / family with downgrade guard (blocked if multiple members)
  - Invite management gated on owner role; non-owners see read-only notice
  - `buildInviteUrl()` used for copy-link; `isLocalDevOrigin()` drives warning banner
  - Copy truthfully says "לא נשלח דוא״ל — שתף ידנית" (no email infra)
- **TypeScript:** `npx tsc --noEmit` clean after all changes

### SettingsPage — major upgrade (1204 lines)
- **Account/Members tab (new):** member list from AccountContext, copy-invite-link flow with `account_invitations` table, pending invitations display, graceful degradation if table missing
- **Security:** real TOTP 2FA via `supabase.auth.mfa.*` (enroll QR → verify → active badge → unenroll), real password reset email, account deletion with typed "מחק" confirm + full data purge + signOut
- **Payment Sources:** inline edit mode, usage counts per source (from financial_movements), name/type/color editable in place
- **Data Management:** real CSV export (BOM UTF-8), PDF via browser print (formatted KPI + movements HTML), CSV import with file preview + column validation + row insert

### Expense Analysis — second-pass polish
- Added `formatDate` import; raw YYYY-MM-DD dates in drill-down transactions now formatted
- Drill-down card header: added ✕ close button (no need to scroll to ranking card)
- KPI card spacing: reduced double-margin between transaction count and mini-bars separator
- Attribution filter: added "לפי שיוך:" label prefix
- Payment filter: added "לפי תשלום:" label prefix
- Attribution percentages: `text-left` → `text-center` in RTL context
- Attribution shared row avatar: `∞` → `מ` to match member initial pattern

### DashboardPage navigation fixes
- 4 raw `<a href>` internal links replaced with `<Link to>` (SPA-safe)
- Added `import { Link }` from react-router-dom

---

## 2026-04-01 (session)

### Expense Analysis — first polish pass
- Back button `→` → `‹` (RTL-correct)
- Attribution filter moved above payment filter
- Grid: `md:grid-cols-2` → `lg:grid-cols-2`
- Separator added inside KPI card
- Mini-bars empty state added
- Donut legend shows amount + %
- "נקה סינון" button improved
- Subcategory label responsive width
- Empty state filter hint

### AppLayout — Global Add Transaction FAB
- Desktop FAB "הוסף עסקה" added, `fixed bottom-8 left-8`, hidden on /settings
- Uses `useLocation` to determine visibility

### TransactionsPage — ?add=true URL param
- Added `useSearchParams`, mount effect opens add panel when `?add=true`
- Clears param after opening to prevent re-open on refresh

---

## Earlier (2026-04-01 and before)

### Household Attribution v1
- `attributed_to_type` and `attributed_to_member_id` added to financial_movements (DB migration)
- TransactionsPage: attribution field in form (couple/family + expense only), AttrChip in rows
- ExpenseAnalysisPage: attribution filter pills, attribution breakdown section, data filtering

### Expense Analysis — bar chart integration
- Large separate Recharts BarChart card removed
- Compact CSS mini-bars integrated into KPI card (top 5 + "אחר")
- Recharts BarChart, Bar, XAxis, YAxis imports removed

### Categories — taxonomy update
- 'business' (עסק ועצמאות) category removed
- 'grooming' (טיפוח והיגיינה) added
- Full subcategory lists added to SUBCATEGORIES

### Payment Sources — type update
- 'debit' and 'digital' removed from SOURCE_TYPES UI list
- 'bit' and 'paybox' added as distinct source types
- Legacy aliases preserved for backward compat

### Dashboard — health score bug fix
- `Math.min(sr * 100, 1)` bug fixed to `Math.min(sr / 0.20, 1)` (20% savings = full 25pts)

### ExpenseAnalysisPage — nav link added
- `/expenses-analysis` route added to AppLayout coreNavItems

### SettingsPage — payment source null account_id fix
- Insert payload now includes `account_id: accountId`
- Guard added: if `!accountId` show error, don't attempt insert

### FixedExpensesPage — major features
- Recurrence presets + custom interval + charge-count limit
- Edit scopes: future / retroactive / current-only
- Monthly confirmation flow with status badges
