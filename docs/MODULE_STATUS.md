# Module Status

Last updated: 2026-04-03

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

## Expenses (unified module — /expenses)
**Status:** ✅ CLOSED — fully implemented and stage-closed (2026-04-03)
**Route:** `/expenses` (canonical) — old `/transactions` and `/fixed-expenses` redirect here
**Components:**
- `src/pages/ExpensesPage.tsx` — shell + tab nav + Overview tab content
- `src/components/expenses/VariableExpensesTab.tsx` — variable expense CRUD
- `src/components/expenses/FixedExpensesTab.tsx` — fixed/recurring expense management

**Overview tab (סקירה — default):**
- Summary card: "הוצאות בפועל" (variable actual total) as hero KPI; fixed monthly projection shown as secondary labeled row ("קבועות — צפי חודשי") — not combined with actual
- Trend: % vs previous month variable total; "עדיין אין הוצאות" null state
- Top categories mini-bars with category colors + percentages (variable expenses only)
- Fixed obligations status card: confirmed/total count + progress bar
- "ניתוח מפורט ›" link to /expenses-analysis (RTL-correct forward arrow)
- "הוסף הוצאה +" CTA switches to variable tab and opens drawer

**Variable tab (משתנות):**
- Fetches `type = 'expense'` + `account_id` (defensive filter, belt-and-suspenders with RLS)
- Grouped by category, sorted by total desc; right-border category color accent on group headers
- Full CRUD: add, edit, delete
- Search, attribution (couple/family), payment source/method, subcategory chips
- ?add=true URL param preserved (handled from shell FAB)
- **Voice input:** "הכתב בקול" button in drawer header (add mode only). Hebrew SpeechRecognition → voiceParser → form population. "מה הבנתי:" preview bar. No auto-save.

**Fixed tab (קבועות):**
- Monthly confirmation section with progress dots (confirmed/skipped/pending)
- Obligations card list — replaced table with cards (category icon, frequency badge, billing day, hover actions)
- Full template management: add, edit (with scope modal: future/retroactive/current-only), deactivate
- Legacy frequency field backward compat preserved
- sub_category: stored on recurring_expenses template + propagated to confirmed financial_movements
- Attribution (shared/member): stored on recurring_expenses template + propagated to confirmed financial_movements; attribution picker shown for couple/family accounts; scope modal updates propagate attribution retroactively
- DB migration: `supabase/migrations/20260403_recurring_sub_category.sql` — adds sub_category, attributed_to_type, attributed_to_member_id columns to recurring_expenses

**Navigation:**
- AppLayout: 3 entries (הוצאות/הוצאות קבועות/ניתוח הוצאות) → 1 entry "הוצאות" → /expenses
- Mobile bottom nav and desktop sidebar both updated
- ExpenseAnalysisPage back button now goes to /expenses (not Dashboard)
- Dashboard links updated to /expenses?tab=variable
- FAB: /expenses?tab=variable&add=true

**Mobile actions:** Fixed tab obligations actions always visible on mobile (md:opacity-0 md:group-hover:opacity-100)
**Drawer animation:** Both Variable and Fixed drawers use slideInRight 0.25s ease — consistent
**Empty state:** True empty state (zero variable + zero fixed) shows welcoming card with two CTAs
**Budget bridge:** Overview shows "לתקציב ›" link row above add CTA
**Expense Analysis (/expenses-analysis):**
- Donut chart (Recharts, chartColor) — present, interactive, with category legend; cx/cy=80 (correctly centered)
- Attribution breakdown (couple/family) — members + shared + unattributed rows with % bars
- Payment breakdown ("חלוקה לפי אמצעי תשלום") — per source or per payment_method; always shown when data exists
- Full category ranking with drill-down to sub-category + transaction list
- Payment + attribution filter pills
- Type filter: "הכל" / "קבועות" only — "משתנות" removed (was identical to "הכל", no DB type flag)
- Trends stacked bar: "קבועות (צפי)" label — honest about projection estimate
- QA pass complete: 5 bugs fixed, tsc clean

**Overview compact donut:** Recharts donut (120px) above category mini-bars; centered; uses chartColor

**Documented v1 limitations (not blockers — accepted and deferred):**
- Trends fixed/variable split is estimated: fixed = current recurring template projection applied uniformly to all months in period. Does not account for template changes mid-period.
- No movement-level `type` flag in `financial_movements` — "קבועות" filter in analysis shows info state by design; "משתנות" filter was removed as it was identical to "הכל".
- Attribution on legacy recurring confirmation rows: not retroactively applied (acceptable for v1).

**Next step:** None — CLOSED for this stage

---

## Incomes (IncomesPage)
**Status:** ✅ Unified Screen COMPLETE (2026-04-05) | ✅ V2 Phase 2 COMPLETE (read layer) | ✅ V2 Phase 3 COMPLETE (2026-04-06 — write confirmation flow)
**What exists:**
- Full CRUD, month-scoped (UTC-safe boundaries — `Date.UTC(y, m, 1)`)
- `account_id` defensive filter (belt-and-suspenders with RLS)
- Income type picker: 7 types stored in `sub_category` (משכורת/עצמאי/מתנה/שכירות/מילואים/בונוס/אחר)
- Attribution: `attributed_to_type` + `attributed_to_member_id` wired; real member names from AccountContext; shown for couple/family only; hidden for personal
- "הופקד לחשבון" field: bank payment sources only; transfer/cash fallback when no bank sources configured
- **⚠️ V2 two-section layout (reshaped 2026-04-07) is superseded — direction change 2026-04-07:**
  - New direction: single unified table (one thead/tbody, not two sections)
  - Three income natures: קבועה (template-backed, auto-continues) | משתנה (recurring by nature, no template) | חד-פעמית (one-off)
  - New column set (11): שם ההכנסה | סוג הכנסה | [שיוך] | אופי ההכנסה | סטטוס | תאריך | יעד הפקדה | סכום צפוי | סכום בפועל | הערות | פעולות
  - New filter model: compact bar (search + "סינון" button) + collapsible panel (4 filters: סוג הכנסה / שיוך / אופי ההכנסה / סטטוס)
  - New summary strip: 4 elements (סכום צפוי / סכום בפועל / פער / pie chart by type)
  - Reduced analytics: expected vs actual chart only; monthly bar, KPI cards, type/attribution lists removed
  - Current IncomesPage.tsx still has V2 two-section code — re-implementation pending
- **Current code state:** IncomesPage.tsx has V2 two-section layout; needs re-implementation to match Unified Control Center direction
- `filteredTemplates` + `filteredIncomes` via `useMemo`; summary strip always unfiltered
- Panel: slideInRight animation, both drawers (income + template) preserved
- Summary strip: 3–4 cards (total, expected vs actual, baseline); always unfiltered
- Loading, empty, error states all present
- Cross-module: Dashboard reads amount+type only — unaffected
- `npx tsc --noEmit` → clean

**Analytics section (2026-04-06):**
- Analytics period selector: 3m / 6m / 12m / מתחילת השנה — anchored to MonthContext, independent of table filters
- Separate `fetchAnalyticsIncomes` query — multi-month range, does not touch monthly table query
- 4 KPIs: ממוצע חודשי / חודש שיא / חודש שפל / יציבות הכנסה (4th conditional on active templates)
- Chart 1: Monthly bar chart + recurring baseline reference line
- Chart 2: Expected vs actual grouped bars — hidden when no `expected_amount` data
- Chart 3: Type breakdown (actual rows, null → "לא מסווג")
- Chart 4: Attribution breakdown — couple/family only, null → "לא שויך"
- All empty/conditional states wired

**V2 Phase 2 — Read layer (2026-04-06):**
- `recurringMonthConfirmations` state + `fetchRecurringMonthConfirmations` callback (queries `recurring_income_confirmations` by account_id + month)
- `templateMonthStatuses` useMemo: Map<recurring_id, {status: TemplateMonthStatus, confirmedAmount}> — מצופה/הגיע/לא הגיע
- Desktop template rows: סטטוס col replaced with TemplateMonthStatus badge (amber/green/rose); סכום בפועל shows confirmed arrival amount if available
- Mobile template cards: same status badge + actual amount
- `financial_movements` select extended to include `recurring_income_id`
- `npx tsc --noEmit` → clean

**V2 Phase 3 — Write confirmation flow (2026-04-06):**
- Inline row actions: "רשום קבלה" (opens arrival drawer) + "לא הגיע" (direct mark skipped); "ערוך קבלה" when already confirmed
- Arrival drawer: prefilled from template (description, amount, date, deposit, attribution); editable; saves confirmed movement + upserts confirmation row
- `handleMarkSkipped`: deletes previously linked movement if any, upserts confirmation status='skipped'
- `handleSaveRecurringArrival`: insert/update financial_movements with recurring_income_id set, source='recurring', expected_amount=null; then upsert confirmation status='confirmed'
- `filteredIncomes` now excludes `recurring_income_id IS NOT NULL` rows — recurring arrivals hidden from one-time section
- Status transitions reflected immediately (local state update after each action)
- Error banner for confirmations errors
- Desktop actions column widened to 160px
- `npx tsc --noEmit` → clean

**⚠️ Pending migrations — BLOCKING full QA (2026-04-07 audit):**
All 3 files are git-untracked and their Supabase run status is unconfirmed. Run in this order:
1. `supabase/migrations/20260405_income_expected_amount.sql` — adds `expected_amount` to `financial_movements`. Without this: expected amounts silently dropped on save; "סכום צפוי" strip always equals actual.
2. `supabase/migrations/20260405_recurring_incomes.sql` — creates `recurring_incomes` table. Without this: no recurring templates; template CRUD silently fails; Migration 3 cannot run.
3. `supabase/migrations/20260406_incomes_v2_phase1.sql` — adds `recurring_income_id` FK + `recurring_income_confirmations` table. Without this: arrival/skip confirmation flow silently fails; arrivals not linked to templates.
- **Use pre-check queries before each run** (see CURRENT_BLOCKERS.md) — Migrations 1 and 2 are NOT idempotent.
- Browser QA pass can only be meaningful after all 3 migrations are confirmed live.

**Accepted limitations (v1):**
- Legacy income rows with non-bank `payment_source_id`: edit picker won't highlight old source — save persists value correctly
- Analytics attribution %s may not sum to 100% when some rows have null attribution (correct behavior — honest)
- `משתנה` income nature is UI-only (no DB column) — movement rows labeled "חד-פעמית" regardless of which choice was made; deferred to Stage 4+

**Deferred (Stage 4+):**
- `nature` column on `financial_movements` (to persist משתנה vs חד-פעמית distinction)
- Forecasting / AI income insights

**Next step:** Run 3 migrations in order (see CURRENT_BLOCKERS.md for exact pre-check + run plan) → authenticated browser QA

---

## Budget (BudgetPage)
**Status:** ✅ CLOSED — fully QA'd and stage-closed (2026-04-04)
**What exists:**
- Full budget CRUD (add, inline edit, delete) per category per month
- Carry-forward: prior month's budgets copied automatically (sessionStorage guard); dismissible banner
- **Actual spend model:** actual = confirmed `financial_movements` ONLY (no recurring projection inflation)
- **Two tabs:** חודשי (monthly) and מגמות (trends). MonthSelector shown only in monthly tab.
- **Hero card:** `1fr 1.7fr 1fr` grid — KPI block (visual RIGHT) / donut 148×148 (CENTER) / 2-col category legend (visual LEFT). Goals whisper below. RTL-correct.
- **Donut:** PieChart/Pie/Cell, sorted by budget amount desc (non-mutating), uses `chartColor` from getCategoryMeta. Center overlay: "שנוצל" + overall utilization %. Click toggles selectedDonutCat.
- **Global insights strip:** Pill 1 = month-over-month comparison. Pill 2 = unbudgeted categories count.
- **Loans card:** Synthetic read-only card for active loans total; appears first in category grid; links to /loans.
- **Category cards — responsive 3-col grid** (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`): ring highlight when selected via donut. Status badge: "הגעת ליעד" for exactly 100%.
- **5-tier utilization color system:** <50% green / 50–79% amber / 80–99% orange / exactly 100% blue / >100% red
- **Per-card insights:** overrun / goal-hit / near-limit / zero-spend / low utilization
- **sessionStorage cache:** `nmoney_budget_data_${monthStart}` — shows cached data instantly on re-visit, busted on save/delete/inline-save
- **Trends tab:** Period selector (3 / 6 / 12 חודשים / מתחילת השנה). Budget vs actual BarChart + LineChart. Category utilization heat table (top 5 × months + average column).
- **YTD period:** Calendar-year-to-date from Jan 1 of selected year through selected month. Distinct from rolling 12 months. Timezone-safe (string arithmetic, no Date.UTC shift risk).
- Missing budget nudge, carry-forward banner, add/edit panel (RTL slide from right) preserved.
**Timezone bugs fixed (2026-04-04):**
- `toMonthEnd`: now uses `Date.UTC` — `new Date(y,m,0).toISOString()` was excluding last day of every month in Israel
- `priorStartStr`: same fix — prior month comparison now correctly starts from the 1st
- `donutData`: `[...budgets].sort()` — no longer mutates React state
**Documented limitations (accepted):**
- Goals not wired (no DB table yet) — whisper CTA is awareness-only
- "ראה בהוצאות" navigates to /expenses without category filter — honest, ExpensesPage does not consume that param
**Next step:** None — CLOSED

---

## Fixed Expenses (FixedExpensesPage)
**Status:** ✅ CLOSED — merged into unified Expenses module (2026-04-03). Stage closed.
**Route:** `/expenses?tab=fixed` — standalone `/fixed-expenses` is a redirect stub only
**What exists:** All functionality lives in `src/components/expenses/FixedExpensesTab.tsx`. `src/pages/FixedExpensesPage.tsx` is a `<Navigate>` stub.
**Documented v1 limitations:** Attribution not applied retroactively to pre-attribution recurring confirmation rows — accepted.
**Next step:** None — CLOSED for this stage

---

## Expense Analysis (ExpenseAnalysisPage)
**Status:** ✅ CLOSED — fully implemented, reopened and re-closed 2026-04-03 (unified monthly model fix)
**What exists:**
- **Two page-level tabs:** חודשי (Monthly) and מגמות (Trends)
- **Monthly tab:** Type filter (הכל/משתנות/קבועות) first, then attribution filter (couple/family), then payment filter (hidden in קבועות mode). KPI card (total, mode-aware label). Category donut chart with legend and click-to-select. Payment breakdown bar rows. Attribution breakdown (couple/family). Full category ranking list with click drill-down (subcategory breakdown + transaction list).
- **Unified monthly model (2026-04-03):**
  - "הכל" mode: KPI = variable (movements) + fixed (recurring projection). Fixed summary card shows between KPI and donut. Donut/ranking show variable breakdown.
  - "משתנות" mode: variable movements only (financial_movements). Full charts + breakdown.
  - "קבועות" mode: recurring expenses from `recurring_expenses` table, projected monthly. Shows KPI, donut by category, obligations list, attribution breakdown (couple/family). No info state — real data.
  - Payment filter hidden in קבועות mode (recurring templates don't need per-transaction payment filter at this level).
- **Trends tab:** Period selector (3 / 6 / 12 months — no MonthSelector). Area chart for monthly total spend. Stacked bar chart (fixed projection vs variable actual). Category trends table (top 5 categories, month-by-month heat cells).
- MonthSelector shown only in Monthly tab header; Trends has its own time control.
**Documented v1 limitations (not blockers):**
- Trends fixed/variable split is estimated — fixed = recurring template projection per active templates, applied uniformly to all months; variable = total − fixed. No movement-level type flag exists in `financial_movements` DB.
- "הכל" KPI includes recurring projection (צפי) alongside actual movements — labeled clearly in subtitle.
- Recurring attribution breakdown in קבועות mode only applies if attribution was set on templates (nullable).
**Next step:** None — CLOSED for this stage

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
**What exists:** Desktop sidebar (RTL right), mobile top bar, mobile bottom nav (4 tabs + center FAB), mobile drawer, desktop FAB "הוסף הוצאה" with 2-option popup (variable / fixed) — hidden on /settings; outside-click backdrop at z-[29] (sibling, not child); closes on navigation
**Key gaps:** None
