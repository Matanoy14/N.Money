# Last Known Good State

**Last updated:** 2026-04-04 (Working environment — formally closed out after validation + hardening passes)

This file tracks the last confirmed working state of the app. Update after each verified stable session.

---

## Working Environment Status — CLOSED (2026-04-04)

The Claude Code working environment for N.Money is formally closed out. No further environment iteration is needed before returning to product work.

| Layer | Status |
|-------|--------|
| Routing / orchestration (`WORKFLOW_ORCHESTRATION`) | ✅ Complete — 6 pass types, wired in CLAUDE.md |
| Implementation guardrails (`SAFE_IMPLEMENTATION`) | ✅ Complete — stall detection, 3-gate verification, LSP/Ask triggers |
| Debugging escalation (`DEBUGGING_ESCALATION`) | ✅ Complete — 3 states, hypothesis protocol, N.Money bug pattern table |
| Module closeout (`CLOSEOUT_PLAYBOOK`) | ✅ Complete — 6 status levels, 7-step workflow, 5 mandatory docs |
| Tool/agent activation rules | ✅ Embedded — LSP, TaskCreate, gsd-debugger, gsd-integration-checker, code-reviewer all have concrete trigger conditions |
| Module playbooks | ✅ Complete — all 7 modules covered (Expenses, Incomes, Dashboard, Settings, Loans, Assets, Goals) |
| Docs layer | ✅ Synced — DATA_MODEL, PRODUCT_DECISIONS, QA checklists, all templates current |
| CLAUDE.md routing | ✅ Complete — 11 skills listed, all with scoped purpose |

**Not-yet-proven (expected during product work, not environment gaps):**
- LSP and TaskCreate deferred tool invocations — first real use during Incomes pass
- `gsd-integration-checker` against N.Money codebase — first use at Loans/Assets closeout
- `gsd-debugger` — first use at first real stuck debugging pass

---

## App Status

| Check | Status | Last verified |
|-------|--------|--------------|
| `npm run dev` starts | ✅ assumed | Not re-verified this session (no runtime errors reported) |
| `npx tsc --noEmit` | ✅ clean | 2026-04-05 — Incomes Stage 3 closeout (no errors, no output) |
| Login / signup | ✅ | Previous session |
| ExpensesPage (/expenses) loads | ✅ | 2026-04-03 — unified module verified, stage CLOSED |
| ExpenseAnalysisPage (/expenses-analysis) loads | ✅ | 2026-04-03 — unified monthly model + UI polish verified, stage CLOSED |
| FixedExpensesPage (/fixed-expenses) | ✅ | 2026-04-03 — redirect stub to /expenses?tab=fixed; all logic in FixedExpensesTab.tsx |
| DashboardPage loads | ✅ | Previous session (savingsGoalPct localStorage wired) |
| SettingsPage loads | ✅ | All 9 tabs verified in QA pass 2026-04-03 |
| IncomesPage loads | ✅ | 2026-04-06 — Analytics section complete. V2 Phase 1 schema migration created (pending Supabase execution — no UI change). tsc clean. |
| BudgetPage loads | ✅ | 2026-04-04 — full QA pass, 3 bugs fixed, stage CLOSED |
| AssetsPage loads | ⚠️ | Not audited |
| LoansPage loads | ⚠️ | Not audited |
| GoalsPage loads | ⚠️ | Not audited |

---

## Incomes Module — Unified Screen COMPLETE (2026-04-05)

**Implementation arc:** Audit → Tier 1 → Tier 2 → Stage 3 templates

| Feature | Status |
|---------|--------|
| Income type picker (7 types via sub_category) | ✅ Tier 1 |
| Attribution — couple/family, real member names | ✅ Tier 1 |
| "הופקד לחשבון" — bank sources only, transfer/cash fallback | ✅ Tier 1 |
| Desktop table: type badge + notes secondary text | ✅ Tier 1 |
| Desktop table: attribution column (conditional) | ✅ Tier 1 |
| Mobile cards: type badge + notes + attribution chip | ✅ Tier 1 |
| Drawer: slideInRight animation, logical field order | ✅ Tier 1 |
| UTC timezone fix (month boundaries) | ✅ Tier 1 |
| account_id defensive filter | ✅ Tier 1 |
| Legacy null sub_category rows: safe render | ✅ Tier 1 |
| Legacy null attribution rows: safe render | ✅ Tier 1 |
| expected_amount column on financial_movements (nullable) | ✅ Tier 2 |
| Drawer: "סכום בפועל" + "סכום צפוי (אופציונלי)" fields | ✅ Tier 2 |
| Table/mobile: muted "צפוי: ₪X" secondary line (conditional) | ✅ Tier 2 |
| Summary strip: "צפוי vs התקבל" card (conditional) | ✅ Tier 2 |
| Blank/zero expected → saved as null | ✅ Tier 2 |
| Dashboard cross-module: zero changes required | ✅ Tier 2 |
| recurring_incomes table + RLS (migration 20260405_recurring_incomes.sql) | ✅ Stage 3 |
| Template CRUD: add, edit, deactivate, reactivate | ✅ Stage 3 |
| "הכנסות קבועות" section: active + inactive cards | ✅ Stage 3 |
| Recurring slide panel: 7 fields (type/desc/amount/day/deposit/attribution/notes) | ✅ Stage 3 |
| Summary strip: "בסיס הכנסה קבועה" card (conditional) | ✅ Stage 3 |
| fetchRecurringIncomes: NOT month-scoped, fires on accountId change | ✅ Stage 3 |

**Bugs fixed in Tier 1:**
- UTC off-by-one: `new Date(year, month, 1).toISOString()` → `new Date(Date.UTC(y, m, 1)).toISOString()` (Israel UTC+2/+3)
- Missing `account_id` filter on fetchIncomes (was relying on RLS alone)
- `sub_category` hardcoded null on insert (now saved from form)
- Attribution fields not populated for income rows (now wired)

**Accepted limitations (not blockers):**
- Legacy income rows with non-bank `payment_source_id`: edit picker won't highlight old source — save still persists the existing value correctly
- `s.is_active` check in `depositSources` filter is redundant (AccountContext pre-filters); tsc clean

**Cross-module verification:**
- Dashboard reads `amount + type` only → unaffected ✅
- Budget does not consume income rows → unaffected ✅

**TypeScript:** `npx tsc --noEmit` → clean (no output) — verified 2026-04-05

**Deferred (Tier 2+):**
- `expected_amount` column (requires ALTER TABLE migration)
- Recurring income (requires new `recurring_incomes` table)
- Income analytics page

---

## Budget Module — CLOSED (2026-04-04)

**Multi-pass implementation arc:** V2 hero layout → hero polish (14 passes) → trends YTD option → YTD bug fix → QA + closeout

| Feature | Status |
|---------|--------|
| Monthly tab: hero, KPI, donut, legend | ✅ |
| Category cards grid (3-col responsive) | ✅ |
| 5-tier utilization color system | ✅ |
| Per-card insights | ✅ |
| Loans synthetic card | ✅ |
| Insights strip (MoM + unbudgeted) | ✅ |
| Carry-forward with sessionStorage guard | ✅ |
| Add/inline edit/delete CRUD | ✅ |
| Trends tab: 3/6/12/YTD period selector | ✅ |
| Trends: BarChart + LineChart + heat table | ✅ |
| Empty state / missing budget nudge | ✅ |

**Bugs fixed in closeout QA:**
- `toMonthEnd` was excluding last day of every month from actuals (Israel UTC+2/+3 timezone shift)
- `priorStartStr` was missing first day of prior month in comparison query
- `budgets.sort()` was mutating React state in place

**Documented limitations (accepted):**
- Goals whisper is awareness-only (no goals DB table yet)
- "ראה בהוצאות" does not filter by category (ExpensesPage doesn't consume that param)
- Trends top-5 is by total budgeted across period, not by actual

---

## Expense Analysis — CLOSED (2026-04-03)

**4-pass implementation arc:** architecture → implementation → unified monthly model → UI polish

| Module | Route | Status |
|--------|-------|--------|
| ExpensesPage (shell + Overview + Variable + Fixed tabs) | `/expenses` | ✅ CLOSED |
| ExpenseAnalysisPage (Monthly + Trends two-tab architecture) | `/expenses-analysis` | ✅ CLOSED |
| FixedExpensesPage | `/fixed-expenses` | ✅ Redirect stub — all logic in FixedExpensesTab |

### What was completed (cumulative across all passes)
- **Architecture pass:** Two-tab shell (חודשי / מגמות). Monthly tab with type filter, attribution filter, payment filter, KPI, Recharts donut, payment breakdown, attribution breakdown, category ranking + drill-down. Trends tab with period selector (3/6/12m), AreaChart, stacked BarChart, category heat table.
- **Implementation pass:** All data live from Supabase. 7+ bugs fixed: donut cx/cy centering, RTL period selector, "קבועות (צפי)" honesty label, stale closures, payment/attribution breakdown basis, delete guard.
- **Unified monthly model pass (2026-04-03):** "קבועות" mode now shows real recurring_expenses data (not an info state). "הכל" mode: KPI = variable movements + fixed projection; fixed summary card shown. "משתנות" mode: movements only, full charts. Payment filter hidden in קבועות mode.
- **UI polish pass (2026-04-03):** Typography scaled back (text-4xl → text-3xl KPI, font-extrabold → font-semibold throughout). Spacing tightened (p-6 → p-4/p-5, py-3 → py-2 rows). Filter pills compacted. Page reads as calm, premium, classic.
- **TypeScript:** ✅ clean throughout all passes

### Known v1 limitations (documented and accepted — not blockers)
- Trends fixed/variable split is estimated: fixed = current active recurring template projection applied uniformly to all months in period. Does not account for template changes mid-period. Variable = total − fixed, clamped to ≥0.
- No movement-level `type` flag in `financial_movements` DB — the unified model works around this by fetching `recurring_expenses` directly for קבועות mode.
- "הכל" KPI combines actual (movements) + estimated (recurring projection) — labeled clearly with subtitle context.
- Recurring attribution breakdown in קבועות mode only reflects attribution if set on templates (null-safe).
- Attribution on legacy recurring confirmation rows not retroactively applied.

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
- Assets, Loans, Goals, Calculators, Guides pages: audit pending
- Budget: CLOSED (2026-04-04)
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
| `src/pages/ExpensesPage.tsx` | Expenses shell + Overview tab | 3-tab: Overview / Variable / Fixed |
| `src/components/expenses/VariableExpensesTab.tsx` | Variable expense CRUD | Voice input, delete guard, account_id scoped |
| `src/components/expenses/FixedExpensesTab.tsx` | Fixed/recurring management | Confirmation flow, deactivate, ?add=true |
| `src/lib/voiceParser.ts` | Hebrew speech → expense fields | subCategory inference, 80+ hint entries |
| `src/pages/ExpenseAnalysisPage.tsx` | Attribution filter + breakdown | paymentFiltered → filtered chain |
| `src/components/AppLayout.tsx` | Global FAB | showFab hides on /settings |
| `supabase/functions/tranzila-checkout/index.ts` | Checkout (nonce model) | Deployed; secrets pending |
| `supabase/functions/tranzila-notify/index.ts` | Payment notify (nonce model) | Deployed; notify URL pending |
