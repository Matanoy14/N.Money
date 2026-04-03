# Last Known Good State

**Last updated:** 2026-04-03 (Settings milestone closed)

This file tracks the last confirmed working state of the app. Update after each verified stable session.

---

## App Status

| Check | Status | Last verified |
|-------|--------|--------------|
| `npm run dev` starts | ✅ assumed | Not re-verified this session (no runtime errors reported) |
| `npx tsc --noEmit` | ✅ clean | 2026-04-03 — verified after Settings 100% closeout pass |
| Login / signup | ✅ | Previous session |
| TransactionsPage loads | ✅ | Previous session |
| ExpenseAnalysisPage loads | ✅ | Previous session |
| DashboardPage loads | ✅ | Previous session (savingsGoalPct localStorage wired) |
| SettingsPage loads | ✅ | All 9 tabs verified in QA pass 2026-04-03 |
| IncomesPage loads | ✅ | Previous session |
| FixedExpensesPage loads | ✅ | Previous session |
| BudgetPage loads | ⚠️ | Not audited this session |
| AssetsPage loads | ⚠️ | Not audited |
| LoansPage loads | ⚠️ | Not audited |
| GoalsPage loads | ⚠️ | Not audited |

---

## Settings Module — Complete Feature State

| Tab | Persistence | Real? |
|-----|-------------|-------|
| Profile | Supabase `user_profiles` | ✅ |
| Payment Sources | Supabase `payment_sources` | ✅ |
| Account/Members | Supabase `accounts`, `account_members`, `account_invitations` | ✅ (invite needs DB migration) |
| Security | Supabase auth (password reset, TOTP MFA, account deletion) | ✅ |
| Subscription/Usage | localStorage `nmoney_preferred_plan` | local-only, truthful |
| Data Management | SheetJS export + ImportWizard → `financial_movements` | ✅ |
| Notifications | localStorage `nmoney_notification_prefs` | local-only, truthful |
| Display | Language read-only (Hebrew only); theme + date format removed | N/A |
| Budget Defaults | localStorage `nmoney_savings_goal_pct` | local-only, real |

---

## Known Issues / Gaps (Not Blocking)

- Income type sub-category: NOT implemented (Stage 1 pending)
- Income attribution: NOT implemented (Stage 2 pending)
- Budget, Assets, Loans, Goals, Calculators, Guides pages: audit pending
- Health score sub-formulas: only savings rate formula confirmed (reads user's localStorage goal)
- Import: no `payment_source_id` linkage; no duplicate detection
- Account deletion cannot remove Supabase auth user from client (server-side only)

---

## localStorage Keys in Use

| Key | Owner | Value |
|-----|-------|-------|
| `nmoney_preferred_plan` | Settings > Subscription | `'personal' \| 'couple' \| 'family'` |
| `nmoney_savings_goal_pct` | Settings > Budget Defaults | numeric string, `'5'`–`'50'`, default `'20'` |
| `nmoney_notification_prefs` | Settings > Notifications | JSON `Record<string, boolean>` |

---

## Critical Files — Current Implementation

| File | Key feature | Notes |
|------|------------|-------|
| `src/pages/SettingsPage.tsx` | All 9 Settings tabs | 100% closed, no dead controls |
| `src/pages/DashboardPage.tsx` | Health score | Reads `nmoney_savings_goal_pct` from localStorage |
| `src/lib/importParser.ts` | CSV+XLSX parse engine | Dynamic `import('xlsx')`, date normalization, inference |
| `src/components/ImportWizard.tsx` | 4-step import wizard | Upload→map→preview→done |
| `src/lib/paymentMethods.ts` | Payment source types | 6 types incl. `transfer`; legacy aliases preserved |
| `src/lib/billing.ts` | Billing helpers | `fetchAccountSubscription`, `getEffectiveAccountType`, etc. |
| `src/lib/inviteUrl.ts` | Invite link builder | Scope-aware: public/lan/localhost |
| `src/pages/TransactionsPage.tsx` | Attribution v1 + ?add=true | AttrChip defined at top of file |
| `src/pages/ExpenseAnalysisPage.tsx` | Attribution filter + breakdown | paymentFiltered → filtered chain |
| `src/components/AppLayout.tsx` | Global FAB | showFab hides on /settings |
| `supabase/functions/tranzila-checkout/index.ts` | Checkout (nonce model) | Deployed; secrets pending |
| `supabase/functions/tranzila-notify/index.ts` | Payment notify (nonce model) | Deployed; notify URL pending |
