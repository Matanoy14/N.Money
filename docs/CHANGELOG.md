# Changelog

---

## 2026-04-07 — Incomes Unified Control Center — Product Direction Relock (docs only)

**Type:** Product decision pass — no code changes

**What was decided:**
- V2 two-section architecture (locked 2026-04-06, reshaped earlier same day) is **superseded**
- New governing direction: "Incomes Module — Unified Control Center"
- Single unified table replaces two separate section tables
- Three income natures introduced: קבועה (template-backed) | משתנה (recurring, no template) | חד-פעמית (one-off)
- Unified 11-column table; compact filter bar (search + collapsible 4-filter panel); 4-element summary strip (צפוי / בפועל / פער / pie); reduced analytics (expected vs actual only)
- V2 Phase 1 schema, confirmation model, delete guard remain valid

**Docs changed:**
- `docs/PRODUCT_DECISIONS.md` — V2 section marked superseded; new "Unified Control Center" section added
- `docs/MODULE_STATUS.md` — updated Incomes section to reflect new direction
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` — V2 note updated
- `handoff/SESSION_CHECKPOINT.md` — new entry prepended
- `docs/CHANGELOG.md` — this entry

**Next:** Re-implement `src/pages/IncomesPage.tsx` to match Unified Control Center locked decisions

---

## 2026-04-07 — Incomes V2 Architecture Reshape

- **IncomesPage.tsx**: reshaped from unified single-tbody to V2 two-section layout per locked decisions (2026-04-06)
- Section 1 "הכנסות קבועות": own thead/tbody; columns: סוג הכנסה | תיאור | [שיוך] | יום צפוי | סכום צפוי | סכום בפועל | סטטוס | פעולות
- Section 2 "הכנסות חד-פעמיות": own thead/tbody; columns: תאריך | תיאור | [שיוך] | הופקד לחשבון | סכום | פעולות
- Removed V2-rejected filters: סוג שורה, הופקד לחשבון, סטטוס
- Filter bar: סוג הכנסה + שיוך only
- Single "הוסף הכנסה" → choice drawer (חד-פעמית / קבועה תבנית)
- Inactive templates hidden by default; "הצג לא פעילות" toggle
- All V2 Phase 2/3 logic preserved (confirmations, arrival drawer, mark skipped, analytics)
- TypeScript clean (npx tsc --noEmit)

## 2026-04-06 — Incomes V2 Phase 3 — Recurring Confirmation Write Flow

**Type:** Implementation pass (write path — no new migrations)

**Files changed:**
- `src/pages/IncomesPage.tsx` — all Phase 3 changes
- `docs/MODULE_STATUS.md`, `docs/CHANGELOG.md`, `handoff/SESSION_CHECKPOINT.md` — updated

**What was implemented:**

State additions (14 new state vars): `showArrivalPanel`, `arrivalTemplate`, `arrivalEditingMovementId`, `arrivalDescription`, `arrivalAmount`, `arrivalDate`, `arrivalPayment`, `arrivalSourceId`, `arrivalAttrType`, `arrivalAttrMemberId`, `arrivalNotes`, `arrivalIsSaving`, `arrivalError`, `markingSkippedId`

Handlers:
- `resetArrivalForm()` — clears all arrival panel state
- `getDefaultArrivalDate(t)` — smart date: today if current month, else expected_day or first of month
- `handleOpenArrival(t)` — opens drawer; edit-mode if confirmation has linked movement, new-mode otherwise
- `handleMarkSkipped(t)` — deletes old linked movement (if any) → upserts confirmation status='skipped'
- `handleSaveRecurringArrival()` — insert/update movement with recurring_income_id + upsert confirmation status='confirmed'

`filteredIncomes` — added `recurring_income_id !== null` exclusion at top

Desktop recurring row actions — replaced static hover buttons with status-driven inline actions (רשום קבלה / לא הגיע / ערוך קבלה); desktop actions column widened to 160px

Mobile recurring card — added confirmation action buttons below edit/toggle row

Arrival drawer — new slide panel with template context pill, description/amount/date/deposit/attribution/notes fields, green save button

Error banners — added `recurringMonthConfirmationsError` dismissible banner

**npx tsc --noEmit → clean (0 errors)**

---

## 2026-04-06 — Incomes V2 Phase 2 — Read layer (TemplateMonthStatus)

**Type:** Implementation pass (read-only — no write flow)

**Files changed:**
- `src/pages/IncomesPage.tsx` — confirmations state + fetch + templateMonthStatuses useMemo + desktop/mobile row render updates
- `docs/MODULE_STATUS.md`, `docs/CHANGELOG.md` — updated

**What was implemented:**
- `recurringMonthConfirmations` state + `fetchRecurringMonthConfirmations` — queries `recurring_income_confirmations` by `account_id` + `month` (first of currentMonth)
- `templateMonthStatuses` useMemo — Map<recurring_id, {status: TemplateMonthStatus, confirmedAmount}>: מצופה (no confirmation) / הגיע (confirmed, links amount from movement) / לא הגיע (skipped)
- Desktop template rows: סטטוס col → TemplateMonthStatus badge (amber/green/rose); inactive templates keep "לא פעיל" badge; סכום בפועל shows green amount if confirmed
- Mobile template cards: same status badge + בפועל amount
- `recurring_income_id` added to `financial_movements` select string
- `npx tsc --noEmit` → clean (0 errors)

**What this does NOT do (intentional — Phase 2 is read-only):**
- No write flow — cannot mark income as arrived/skipped from UI yet
- No confirmation drawer or modal
- Confirmations table data will all be absent until migration runs + Stage 4 write path is built

---

## 2026-04-06 — Incomes V2 Phase 1 — Schema additions

**Type:** Schema-only pass (no UI changes)

**Files changed:**
- `supabase/migrations/20260406_incomes_v2_phase1.sql` — migration file created (must be run manually in Supabase)
- `docs/DATA_MODEL.md` — recurring_income_id column + recurring_income_confirmations table documented
- `docs/PRODUCT_DECISIONS.md` — V2 locked decisions section added
- `docs/MODULE_STATUS.md` — Phase 1 status noted
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` — Phase 1 + phase unlock map added
- `handoff/SESSION_CHECKPOINT.md`, `handoff/LAST_KNOWN_GOOD_STATE.md` — updated

**What Phase 1 adds (pending manual Supabase execution):**
- `financial_movements.recurring_income_id uuid NULL FK → recurring_incomes(id) ON DELETE SET NULL`
- `recurring_income_confirmations` table: id, account_id, recurring_id, month, status (confirmed/skipped CHECK), movement_id (nullable FK ON DELETE SET NULL), created_at; UNIQUE(recurring_id, month); RLS account_members policy; 2 indexes
- 6 verification SQL comments at bottom of migration file

**No UI changes. No TypeScript changes. No breaking changes to existing flows.**

---

## 2026-04-06 — Incomes Analytics Section — Product Spec + Implementation

**Type:** Product spec pass → Implementation pass

**Files changed:**
- `src/pages/IncomesPage.tsx` — analytics section added: period state, separate multi-month query, 4 KPIs, 4 analysis blocks (bar chart, expected vs actual, type breakdown, attribution breakdown), empty/conditional states
- `docs/PRODUCT_DECISIONS.md` — Incomes Analytics v1 locked decisions added (via product spec pass)

**What was implemented:**
- `getAnalyticsPeriodBounds()` helper — computes period start/end + month labels anchored to MonthContext selected month
- `fetchAnalyticsIncomes` — separate Supabase query, fully independent from month-scoped `fetchIncomes`
- Period selector: 3m / 6m / 12m / מתחילת השנה — default 6m — in analytics section header
- 4 KPI cards: ממוצע חודשי / חודש שיא / חודש שפל / יציבות הכנסה (4th only when active templates)
- Chart 1: Monthly actual income BarChart (Recharts) + recurring baseline ReferenceLine (only when templates exist)
- Chart 2: Expected vs actual grouped BarChart — hidden entirely when no `expected_amount` data in period
- Chart 3: Income type breakdown — horizontal progress bars, null sub_category → "לא מסווג"
- Chart 4: Attribution breakdown — couple/family only; null attribution → "לא שויך"; empty state when no attribution set
- Full empty/conditional states: loading spinner, error banner, zero-data muted line, per-chart guards
- Analytics does NOT follow table filters (independent)
- Summary strip unchanged (still uses unfiltered page-level incomes)
- `npx tsc --noEmit` → clean

---

## 2026-04-05 — Incomes Unified Screen — Planning + Implementation Pass

**Type:** Planning pass → Implementation pass

**Files changed:**
- `src/pages/IncomesPage.tsx` — full rewrite: unified pinned-section table, 6 multi-select filters, two amount columns, MonthSelector dimming, "הוסף קבועה" top bar button, mobile dual-section layout
- `docs/PRODUCT_DECISIONS.md` — Unified Screen locked decisions section added; Tier 2 drawer labels superseded

**What was implemented:**
- **Unified pinned-section table:** Two `<tbody>` elements in one `<table>` — templates pinned top, actual movements below, shared `<thead>` with 8 cols (7 without attribution): תאריך / תיאור / [שיוך] / הופקד לחשבון / סכום צפוי / סכום בפועל / סטטוס / פעולות
- **Two amount columns (locked override):** Actual rows: `expectedCol = expected_amount ?? amount`; `actualCol = amount`. Template rows: `צפוי = amount (/ חודש)`; `בפועל = —`
- **6 multi-select filter state variables** (`Set<string>`): search, סוג שורה, סוג הכנסה, שיוך, הופקד לחשבון, סטטוס. Empty set = show all (AND composition)
- **`filteredTemplates` + `filteredIncomes`** via `useMemo` — client-side only, no re-fetch per filter
- **Section visibility booleans:** `showTemplateSection`, `showMovementsSection`, `monthSelectorDimmed`, `statusFilterDimmed`
- **MonthSelector dimming wrapper:** `opacity-40 pointer-events-none` when קבוע-only mode — no MonthSelector.tsx changes
- **Summary strip unchanged:** Always computed from unfiltered `incomes` and `recurringIncomes`
- **Both slide panels unchanged:** Add/edit income + add/edit template preserved exactly
- **Mobile:** Templates section first, actuals second, each with section header, dual-amount labeled rows
- **`npx tsc --noEmit` → clean**

**Pending (not blocking):**
- User must run `supabase/migrations/20260405_income_expected_amount.sql` in Supabase SQL editor (`expected_amount` column on `financial_movements`)
- Browser verification pass

---

## 2026-04-05 — Incomes Stage 3 — Recurring Income Templates

**Type:** Implementation pass

**Files changed:**
- `src/pages/IncomesPage.tsx` — all Stage 3 additions
- `supabase/migrations/20260405_recurring_incomes.sql` — CREATE TABLE recurring_incomes + RLS (run in Supabase SQL editor)

**What was implemented:**
- `RecurringIncome` interface + `RECURRING_SELECT` constant
- All state: `recurringIncomes`, `recurringLoading`, `recurringError`, `recurringIsSaving`, `deactivatingId`, `showRecurringPanel`, `editingTemplate`, 9 form fields (`rtDescription` … `rtNotes`)
- `fetchRecurringIncomes` — NOT month-scoped; fires on accountId change only
- `resetRecurringForm`, `handleEditTemplate`, `handleSaveTemplate` (insert + update), `handleToggleActive` (deactivate/reactivate)
- "הכנסות קבועות" section below monthly movements: active + inactive template cards with type badge, amount, day hint, deposit chip, attribution chip, ✏️ / ⏸️▶️ actions
- Empty state: "הוסף הכנסה קבועה ראשונה" CTA
- Slide panel (slideInRight, same style as income panel): 7 fields — type, description, monthly amount, expected day, deposit, attribution, notes
- Summary strip: "בסיס הכנסה קבועה" card shown only when `hasActiveTemplates`; grid expands to 3 or 4 cols depending on Tier 2 + Stage 3 cards
- `npx tsc --noEmit` → clean

**Stage 4 deferred (not started):**
- `recurring_income_confirmations` table
- Monthly confirmation flow ("האם הגיעה ההכנסה?")
- `recurring_income_id` FK on `financial_movements`
- Auto-generation of movements from templates

---

## 2026-04-05 — Incomes Stage 3 Planning + Implementation Prep

**Type:** Planning pass + decision lock (no app code changed)

**What was done:**
- Architecture chosen: new `recurring_incomes` table (Option B) — separate from `recurring_expenses`
- All 8 Stage 3 product decisions locked in `docs/PRODUCT_DECISIONS.md`
- Full implementation spec written in `docs/skills/INCOME_MODEL_PLAYBOOK.md`: exact schema, TypeScript interface, select string, state plan, drawer field list, section UI, verification points
- Stage 3 scope: templates only (CRUD + section + summary strip baseline)
- Stage 4 deferred: confirmation flow, `recurring_income_confirmations`, movement auto-generation, `recurring_income_id` FK

**Docs updated:** `PRODUCT_DECISIONS.md`, `INCOME_MODEL_PLAYBOOK.md`, `MODULE_STATUS.md`, `SESSION_CHECKPOINT.md`, `CHANGELOG.md`
**App code:** none changed
**Migration:** not created yet — will be created at start of implementation pass

---

## 2026-04-05 — Incomes Module Tier 2 — expected_amount

**Files changed:**
- `src/pages/IncomesPage.tsx` — interface, form state, handlers, drawer, table, mobile, summary strip
- `supabase/migrations/20260405_income_expected_amount.sql` — ALTER TABLE ADD COLUMN expected_amount numeric NULL
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` — Tier 2 semantics documented

**What was implemented:**
- `expected_amount: number | null` column on `financial_movements` (nullable, income rows only)
- Drawer: "סכום" renamed to "סכום בפועל"; new optional "סכום צפוי" field added below
- Blank/zero expected saves as null (no expectation); non-zero saves as numeric
- Table + mobile: conditional muted "צפוי: ₪X" secondary line shown only when `expected_amount ≠ null && expected_amount ≠ amount`
- Summary strip: third card "צפוי vs התקבל" shown only when any income in month has `expected_amount != null`
- Dashboard: zero changes — reads `amount` only, unaffected

**TypeScript:** `npx tsc --noEmit` clean
**Module status:** `✅ CLOSED — Tier 2 (2026-04-05)`

---

## 2026-04-05 — Incomes Module Tier 1 — Verified and Formally Closed

**Verification pass result:** All static audit checks passed. No code fixes required.

**Verification items confirmed (static analysis):**
- Interface / select string / insert / update / resetForm / handleEdit: all include new fields
- Attribution hidden for personal accounts; visible for couple/family with real member names
- AttrChip null-safe; type badge null-safe for legacy rows
- Deposit picker bank-only; fallback transfer/cash only; no credit/bit/paybox
- colSpan calculation correct for both table variants (3 or 4 label columns)
- UTC timezone fix verified correct
- account_id filter present
- Dashboard cross-module check: reads amount+type only — unaffected
- `npx tsc --noEmit` clean (strict: true, verified)

**Accepted limitations:**
- Legacy income rows with non-bank payment_source_id: edit picker won't highlight old source (harmless)
- `s.is_active` check redundant (AccountContext pre-filters); tsc clean

**Module status:** `✅ CLOSED — Tier 1 (2026-04-05)`

---

## 2026-04-05 — Incomes Module Tier 1 Implementation

**File changed:** `src/pages/IncomesPage.tsx` (single file, no DB migrations)

**Changes:**
- Income type field: 7-type picker (משכורת/עצמאי/מתנה/שכירות/מילואים/בונוס/אחר) stored in `sub_category`
- Attribution: `attributed_to_type` + `attributed_to_member_id` wired; real member names from AccountContext; hidden for personal accounts
- Deposit field: renamed "הופקד לחשבון"; filtered to bank payment sources only; fallback = transfer/cash (no credit/bit/paybox)
- Desktop table: added type badge + notes secondary text in description cell; attribution column (conditional); renamed deposit column
- Mobile cards: type badge above description; notes as secondary text; attribution chip when relevant
- Drawer: income type picker at top; full field reorder; attribution picker; slideInRight animation; notes always visible
- UTC timezone fix: `Date.UTC(y, m, 1)` — eliminates off-by-one for Israel UTC+2/+3
- Defensive filter: `.eq('account_id', accountId)` added to fetchIncomes
- select string, insert, update payloads all extended to include new fields

**Docs updated:** `INCOME_MODEL_PLAYBOOK.md` (Tier 1 complete, Tier 2/3 documented), `PRODUCT_DECISIONS.md` (Tier 1 locked decisions added), `MODULE_STATUS.md` (Incomes status updated)

---

## 2026-04-04 — Working Environment Formally Closed Out

Three-pass environment build-out (validation → hardening → closeout) is now complete. No further environment iteration is needed before returning to product work. The working environment is now the expected default operating mode for all N.Money module passes.

**Environment validation pass:**
- `CLAUDE.md` skills routing: added `WORKFLOW_ORCHESTRATION`, `DEBUGGING_ESCALATION`, `CLOSEOUT_PLAYBOOK`, and 3 new module playbooks (`LOANS`, `ASSETS`, `GOALS`); expanded module playbook list to all 7 playbooks explicitly
- `docs/templates/QA_REPORT_TEMPLATE.md`: replaced stale `TransactionsPage` section with current `ExpensesPage` Variable + Fixed tab structure

**Environment hardening pass:**
- `docs/skills/RECURRING_EXPENSES_PLAYBOOK.md`: fixed stale `FixedExpensesPage` references → `FixedExpensesTab.tsx` (src/components/expenses/)
- `CLAUDE.md`: added `UX_POLISH_PASS.md` as situational entry (not a mandatory pass step)
- `docs/PRODUCT_DECISIONS.md`: added superseded blockquote notes to "Expenses Module — Pure Expense View" and "Transactions / Income Responsibility Split" sections (TransactionsPage-era decisions) — historical record preserved, file references flagged as stale
- `docs/DATA_MODEL.md`: synced `payment_sources.type` (added `transfer`); added 3 missing columns to `recurring_expenses` (`sub_category`, `attributed_to_type`, `attributed_to_member_id` — all from 2026-04-03 migration)

No application code changed across all environment passes.

---

## 2026-04-04 — Workflow Orchestration Layer + Stale-Doc Quick Fixes

- **`docs/skills/WORKFLOW_ORCHESTRATION.md`** — new skill. Routing layer for 6 pass types (Audit / Planning / Implementation / Debugging / Verification / Closeout). Defines lead skill + support tools/agents per pass type. Includes N.Money-specific pass sequences for modules at each status level.
- **`docs/skills/INCOME_MODEL_PLAYBOOK.md`** — fixed stale Stage 2 reference: TransactionsPage → VariableExpensesTab; added grep confirmation note for attribution columns
- **`docs/QA_CHECKLISTS.md`** — replaced stale "Transactions" section with two sections (Expenses Variable tab + Expenses Fixed tab); updated AppLayout FAB entries to current "הוסף הוצאה" + 2-option popup; updated Acceptable Weaknesses to reflect current project state (voice input implemented, Goals mock acknowledged, billing infra pending)

No code changed.

---

## 2026-04-04 — Tool + Agent Activation Layer Embedded

Targeted updates to 3 skills to embed practical tool/agent activation rules:
- **`CLAUDE_TOKEN_EFFICIENCY.md`** — added LSP-vs-Grep decision rule; added TaskCreate usage rule (>5 steps / Investigation pass / compaction resilience)
- **`SAFE_IMPLEMENTATION.md`** — added LSP trigger before multi-caller edits; added 3-gate verification model (tsc / functional / cross-module); added AskUserQuestion trigger for blocking product decisions
- **`CLOSEOUT_PLAYBOOK.md`** — added `gsd-integration-checker` trigger for modules with documented cross-module dependencies; distinguished from standard regression pass

No CLAUDE.md edit — tool routing belongs in skills, not global config. No code changed.

---

## 2026-04-04 — Debugging Escalation Layer Added

- **`docs/skills/DEBUGGING_ESCALATION.md`** — new skill. Defines 3 escalation states (Tweak/Diagnostic/Investigation), stall detection rules, minimum debugging protocol (hypothesis-first, declare-wrong-before-next), N.Money-specific bug pattern table, tool/agent guidance, stop/report format
- **`docs/skills/SAFE_IMPLEMENTATION.md`** — updated with stall-detection rule, mandatory escalation trigger to DEBUGGING_ESCALATION.md after a failed fix, `superpowers:verification-before-completion` invocation before marking complete, 4th file scope check

No code changed.

---

## 2026-04-04 — New Skills: GOALS_PLAYBOOK + CLOSEOUT_PLAYBOOK Created

Created two new project-specific playbooks:

- **`GOALS_PLAYBOOK.md`** — Documents Goals as 100% mock (code-inspected), catalogs every hardcoded element that must be replaced, lists 5 unresolved product decisions that must be locked before implementation, preserves all locked Budget integration constraints, proposes DB schema (clearly marked unconfirmed), defines safe implementation checklist
- **`CLOSEOUT_PLAYBOOK.md`** — Formalizes the closeout workflow that emerged in practice across Budget/Expenses/Settings passes. Defines 6 module status levels, 7-step closeout workflow, documentation sync obligations (5 required docs), per-module checklist, accepted limitation examples from real project history, and reporting expectations

No code changed. Documentation only.

---

## 2026-04-04 — New Skills: LOANS_PLAYBOOK + ASSETS_PLAYBOOK Created

Created two new project-specific playbooks grounded in real current code (code-inspected, not templated):

- **`LOANS_PLAYBOOK.md`** — covers Shpitzer amortization logic, `getLoanDisplayValues()` dual-mode (recompute vs legacy fallback), leasing backward compat, balance drift trap (Dashboard reads stored balance), Budget card reads stored monthly_payment, audit checklist, closeout criteria
- **`ASSETS_PLAYBOOK.md`** — covers point-in-time valuation model, filter-independent `totalValue`, `as_of_date` semantics, hard-delete as intentional, Dashboard net worth dependency, type breakdown sidebar behavior, audit checklist, closeout criteria

No code changed. Documentation only.

---

## 2026-04-04 — Skills Maintenance Pass: 4 Remaining Skills Updated

**Skills updated (docs only, no code changes):**

1. **`DB_CHANGE_PLAYBOOK.md`** — Removed dead `docs/templates/SQL_CHANGE_TEMPLATE.md` reference. Added full Path B (new table creation) with RLS policy template, TypeScript interface, loading/empty/error state requirements, and DATA_MODEL + MODULE_STATUS sync steps. Kept existing ADD COLUMN flow.
2. **`TAXONOMY_CHANGE.md`** — Replaced stale `TransactionsPage` references with `VariableExpensesTab` and `FixedExpensesTab`. All safety rules preserved.
3. **`PAYMENT_SOURCE_CHANGE.md`** — Updated "Pages That Use Payment Sources" table with current component paths. Corrected `resolvePaymentDisplay` call sites to verified 3 consumers (VariableExpensesTab, IncomesPage, ExpenseAnalysisPage). Added current source types header.
4. **`DASHBOARD_ANALYTICS_PLAYBOOK.md`** — Expanded data dependency map to include assets/loans/net worth path. Added health score sub-formula warning (only savings rate confirmed). Added integration surface rule for future modules.

Skills maintenance pass complete (all 5 skills: SETTINGS_PLAYBOOK + these 4).

---

## 2026-04-04 — Budget Module QA: Timezone Bugs Fixed

**3 bugs fixed:**

1. **`toMonthEnd` UTC shift (data correctness):** `new Date(y, m+1, 0).toISOString()` creates a LOCAL midnight date; in Israel (UTC+2/+3) this outputs the previous day in UTC. Expenses on the last day of every month were silently excluded from budget actual totals. Fixed: `Date.UTC(getUTCFullYear, getUTCMonth+1, 0)` — no timezone shift.
2. **`priorStartStr` UTC shift (minor data correctness):** Same pattern — `new Date(year, month, 1).toISOString()` gave previous day. Prior month comparison missed the 1st of the month. Fixed with `Date.UTC`.
3. **State mutation in donut data:** `budgets.sort(...)` mutated React state in place. Fixed: `[...budgets].sort(...)`.

**Root cause pattern:** `new Date(year, month, day)` constructs LOCAL midnight; `.toISOString()` converts to UTC; UTC+ timezone users get the previous calendar day. Supabase date strings need UTC-midnight construction (`Date.UTC`) to be timezone-safe.

- tsc: clean

---

## 2026-04-04 — Budget Trends: YTD Period Option Added

**Feature:** Added "מתחילת השנה" (year-to-date) as a fourth option in the Budget Trends period selector.

**Changes:**
- `trendPeriod` type extended from `3 | 6 | 12` to `3 | 6 | 12 | 'ytd'`
- `fetchTrends()` accepts `'ytd'` — builds months array from January 1 of the selected year through the current/selected month (1–12 months, dynamic)
- UI selector: fourth button "מתחילת השנה" added after "12 חודשים"; same pill style with active-state behavior
- `flex-wrap` added to selector row so all 4 pills wrap cleanly on narrow screens
- tsc: clean

**Distinction locked:** "מתחילת השנה" ≠ "12 חודשים" — YTD is calendar-year-to-date; 12 months is a rolling window.

---

## 2026-04-04 — Budget V2: Hero New Layout Decision (pass 14)

**Decision:** Abandoned equal-thirds. New macro: `1fr 2fr 1fr` — side sections equal, center section 2× wider.

**Changes:**
- Grid: `grid-cols-3` (equal) → `gridTemplateColumns: '1fr 2fr 1fr'`
- Donut: 100×100 outerRadius=43 → **148×148** cx=74 cy=74 innerRadius=44 outerRadius=69 (5px SVG margin, ring width 25px)
- KPI values: text-lg → text-sm (fits the narrower 1fr column cleanly)
- Legend: single-column → **2-column** `grid-cols-2 gap-x-1 gap-y-1.5`, all categories visible, text-[9px] dots w-1.5 h-1.5
- tsc: clean

---

## 2026-04-04 — Budget V2: Hero Reconcile (pass 13)

**Reconciled file with pass 12 spec:**
- Donut: `height={180} cy={90}` → `height={100} cy={50}` — removes dead space below donut ring
- Donut radii: `innerRadius={32} outerRadius={48}` → `innerRadius={27} outerRadius={43}` (7px SVG margin)
- KPI values: `text-xl` → `text-lg` — scales back to pass 12 spec
- tsc: clean

---

## 2026-04-04 — Budget V2: Hero Deep Diagnosis + Structural Fix

**Root causes identified:**
1. Legend 2-col grid: only 32px per text cell → Hebrew category names (8-14 chars) truncated to ~4 chars. Unreadable.
2. Separators `border-gray-100` (#f3f4f6 on white) — nearly invisible. Hero reads as one undivided block.
3. KPI panel `bg-gray-50` (#F9FAFB on white) — near-zero contrast. Panel containment invisible.

**Fixes:**
- Legend: 2-col grid → single column `space-y-2`, `px-3` → names get 82px text area. "מסעדות ובילוי" now shows fully.
- Separators: `border-gray-100` → `border-gray-200` on both KPI and donut column borders.
- KPI panel: added `border: 1px solid #E5E7EB` to the panel div — makes the container visible.
- Legend: `py-5` → `py-4` to match other columns.

---

## 2026-04-04 — Budget V2: Hero Final Visual Polish

**Session type:** Polish only. tsc clean.

- KPI: `text-lg` → `text-xl`, wrapped in `bg-gray-50 rounded-xl px-3 py-4` panel within outer `px-2 py-4` cell. Premium contained look.
- Donut: `inner=27 outer=43` (16px ring) → `inner=22 outer=46` (24px ring). Thicker ring = more visual weight. Center %: `text-xs` → `text-sm font-bold`.
- Legend: `w-2 h-2` → `w-2.5 h-2.5` dots, `text-[11px]` → `text-xs`.

---

## 2026-04-04 — Budget V2: Final Hero Polish + Trends Enhancement + Wrong Additions Removed

**Session type:** Multi-part correction. tsc clean.

### Hero final polish
- KPI: `text-base` → `text-lg` values, `text-xs` → `text-[11px]` labels, `py-4 gap-4` → `py-5 gap-5`
- Donut: `outerRadius=47` → `outerRadius=43`, `innerRadius=32` → `innerRadius=27` — 7px SVG margin, no visual clipping
- Legend: uses `legendData` (semantic CATEGORY_GROUP_ORDER sort), `text-[10px]` → `text-[11px]`, `gap-y-1.5` → `gap-y-2`

### Wrong additions removed
- Removed "חלוקה לפי קטגוריות" allocation list card from monthly tab
- Removed "תקציב מול ביצוע" bar chart card from monthly tab

### Trends: "ניצול תקציב לפי קטגוריה" improved
- `top5cats.slice(0,5)` removed → ALL budgeted categories shown
- Added "ממוצע" (average) column: average utilization across months with budget

### Trends: new "מגמת תקציב מול ביצוע" line chart
- Recharts LineChart below the heat table
- Two lines: budget (`#93C5FD`) + actual (`#1E56A0`)
- CartesianGrid (horizontal only), XAxis labels, YAxis in K format
- Custom Tooltip + Legend

---

## 2026-04-04 — Budget V2: Hero Final Polish + Allocation Section + Comparison Chart

**Session type:** Multi-part enhancement. tsc clean.

### Hero final polish
- Donut: 96px → 100px (`cx=50 cy=50 inner=32 outer=47`), py-3 for column
- Legend: single column → `grid grid-cols-2 gap-x-1.5 gap-y-1.5` with `text-[10px] w-2 h-2` — all categories shown in 2 compact columns

### New: Category allocation section
- New white card after insights strip: "חלוקה לפי קטגוריות"
- Shows ALL budgeted categories: color dot + name + utilization % + actual/budget amounts + progress bar
- Uses `getUtilizationColor` for color coding (same system as category cards)

### New: Budget vs Actual comparison chart
- New white card after allocation section: "תקציב מול ביצוע"
- Grouped vertical BarChart via Recharts: budget bars (gray) + actual bars (category color, red if over)
- Tooltip shows full category name + budget + actual amounts
- Chart data: top 8 budgeted categories sorted by overrun-first
- Legend: תקציב / ביצוע בפועל

---

## 2026-04-04 — Budget V2: Hero Polish + Refresh Root-Cause Fix

**Session type:** Visual polish + refresh bug fix. tsc clean.

### Hero polish
- KPI: `text-[10px]/text-sm` → `text-xs/text-base`, `py-3 gap-3` → `py-4 gap-4`
- Donut: 90px (`outer=43`) → 96px (`cx=48 cy=48 inner=30 outer=45`) — 3px margin in SVG, no clipping
- Legend: `slice(0,5)+overflow` → `donutData.map()` ALL categories shown. `text-[10px] w-2 h-2` → `text-xs w-2.5 h-2.5`. `py-4 gap-1.5`

### Refresh bug real fix
Root cause: `setLoading(true)` ran unconditionally even when cache was already shown.
This caused: data flash → spinner → data reload — the visual "refresh" the user saw.
Fix: `setLoading(true)` is now conditional (`if (!showedCache)`). With cache: background refresh silently. Without cache: spinner shown. ✓

---

## 2026-04-04 — Budget V2: Hero — Final 3-Thirds + Refresh Bug Fix

**Session type:** Hero composition fix + refresh bug fix. tsc clean.

### Hero — correct 3-thirds composition
`grid grid-cols-3` — one row, 3 equal thirds (106px each on 318px mobile):
- Col 1 (RIGHT in RTL): vertical KPI stack — תקציב / שימוש בפועל / יתרה, each as label+value stacked
- Col 2 (CENTER): donut 90px, centered, utilization % inside, Tooltip hover
- Col 3 (LEFT in RTL): category color guide, top-5 + "+N" overflow indicator, no amounts
- `border-l border-gray-100` on cols 1+2 = full-height column separators via grid stretch

### Refresh bug fix
Root cause: `currentMonth` (Date object) in `fetchData` useCallback deps. If context recreates the Date reference each render (same value, new object), fetchData is recreated → useEffect fires → re-fetches indefinitely.
Fix: removed `currentMonth` and `CACHE_KEY` from deps. New deps: `[user, accountId, monthStart]` (all stable primitives/objects).
Replaced `toMonthEnd(currentMonth)` → `toMonthEnd(new Date(monthStart))` inside the callback.
Replaced `getPriorMonthStart(currentMonth)` → `getPriorMonthStart(new Date(monthStart))`.

---

## 2026-04-04 — Budget V2: Hero — Correct Side-by-Side (items-stretch, KPI panel, donut separate)

**Session type:** Visual composition correction. tsc clean.

### Structure
`flex gap-3 items-stretch` — one row, both sections fill same height:
- KPI panel (flex-1, RIGHT in RTL): `bg-gray-50 rounded-xl flex-col justify-center px-2 py-3` — 3 values centered in full-height gray panel. NO KPI is placed above the donut.
- Donut+guide (w-[155px], LEFT in RTL): donut 110px at top, guide below (top-4 + "+N more" overflow indicator). The donut is NOT subordinate to any KPI value — it starts at the top of its block.
- Divider: `w-px bg-gray-200`, full height via stretch.

### Key difference from grid-cols-3
Grid-cols-3 placed יתרה KPI above the donut inside the left cell = stacked composition. This version has NO KPI inside the donut block — the KPI panel is entirely on the right and the donut block is entirely on the left.

---

## 2026-04-04 — Budget V2: Hero — Thirds Restoration (grid-cols-3, donut in same row as KPI)

**Session type:** Regression fix. tsc clean.

### Regression fixed
Two-zone stacked layout (KPI above, donut below) reverted. Donut is back in the SAME grid row as all 3 KPI values.

### Structure
`grid grid-cols-3` — one row, all in same hero surface:
- Cell 1 (visual RIGHT in RTL): תקציב — `text-base font-bold`
- Cell 2 (CENTER): בפועל — `text-base font-bold`, `border-r border-l border-gray-100` (full-height separators)
- Cell 3 (visual LEFT in RTL): יתרה KPI + separator + donut (96px) + ALL budgeted categories guide

Cell 3 drives row height; cells 1+2 stretch to match (grid default stretch). KPI values all sit at same `pt-3` top level = one horizontal unit.
Guide: `donutData.map(...)` — ALL categories shown (no slice limit), 2-col grid, no amounts.

---

## 2026-04-04 — Budget V2: Hero Full Rebuild (two-zone layout, donut 150px, text-xl KPI)

**Session type:** Full hero JSX rebuild. tsc clean.

### Architecture change
Abandoned single-row side-by-side layout (physically impossible to make premium on 318px mobile).
New two-zone layout within the same card surface:
- Zone 1 (KPI header): full-width `bg-gray-50 border-b` strip — 3 values at `text-xl font-bold`, each cell 106px wide
- Zone 2 (Donut+Guide body): `flex items-center px-5 py-4` — Guide RIGHT (flex-1, text-sm) + Donut LEFT (150px)
- Overflow-hidden on card for clean bg-gray-50 corner rounding

### Visual improvements
- KPI: text-xl font-bold (was text-sm/text-base) — premium fintech header look
- Donut: 150×150px, `cx=75 cy=75`, `innerRadius=46 outerRadius=70` — 24px ring, dominant visual presence
- Center label: text-lg font-bold utilization %
- Guide: single column space-y-2.5, `w-3 h-3` dots, text-sm — fully readable
- Hover tooltip: colored pill showing `CategoryName: X%`

---

## 2026-04-04 — Budget V2: Hero Visual Enforcement (donut 120px, text-base KPI, single-col guide, hover tooltip)

**Session type:** Visual enforcement pass. tsc clean.

### Changes
- Grid: `2fr/1px/1fr` → `1.5fr/1px/1fr` (KPI gets 60%, donut gets 40% of card width)
- KPI: wrapped in `bg-gray-50 rounded-xl`, values upgraded `text-sm font-semibold` → `text-base font-bold`, labels `text-[10px]` → `text-xs`
- Donut: 88px → 120px (`cx=60 cy=60`, `innerRadius=37 outerRadius=57`). Center label: `text-[8px]`/`text-[11px]` → `text-[9px]`/`text-sm font-bold`
- Guide: 2×2 grid `text-[9px]` → single column `space-y-1.5`, `w-2.5 h-2.5` dots, `text-xs` names — fully readable
- Hover: Recharts `<Tooltip>` on PieChart shows category name + % of total on segment hover (colored pill)

---

## 2026-04-04 — Budget V2: Hero — Enforced 2fr/1fr Grid (true thirds composition)

**Session type:** Structural correction. tsc clean.

### Root cause
Previous flex layout (`flex-1` KPI + `w-[140px]` donut) rendered as ~equal halves (48%/44%), not visual thirds. Guide was only 44px wide — too cramped.

### Fix
Replaced flex row with explicit CSS grid: `gridTemplateColumns: '2fr 1px 1fr'`.
- KPI (2fr = 2/3 of card width, visual RIGHT in RTL): 3 cells in sub-flex, ~70px each
- Divider (1px): full row height via grid stretch
- Donut+guide (1fr = 1/3 = ~106px, visual LEFT in RTL): donut 88px centered + 2×2 guide below

### Guide improvement
- Guide now in 106px column (50px per 2-col cell): `text-[9px]`, `gap-x-1.5`
- "תחבורה" (7 chars at 9px ≈ 38.5px) fits in 40px text area. No more severe truncation.

---

## 2026-04-04 — Budget V2: Hero Root-Cause Fix (guide beside donut, items-start)

**Session type:** Root-cause structural fix. tsc clean.

### Root cause identified and fixed
- `items-center` caused the ~44px KPI strip to float in the middle of the ~165px donut column (donut 120px + guide 35px below it), leaving 60px of dead white space above AND below the KPI values.
- Fix 1: `items-center` → `items-start` — KPI and donut both pin to top of their columns.
- Fix 2: Guide moved from BELOW the donut (stacking = tall column) to BESIDE the donut (inner flex row). Donut block height collapses from 165px to 88px — now matches KPI height better.
- Donut: 120×120 → 88×88 (`cx=44 cy=44`, `innerRadius=27 outerRadius=41`) — sized for the side-by-side arrangement.
- Guide: `grid grid-cols-2` (below) → `flex-1 flex-col gap-1.5` (beside donut, RTL left of donut).
- `gap-2` → `gap-3` on main flex row for better separation.

### Files changed
- `src/pages/BudgetPage.tsx`

---

## 2026-04-04 — Budget V2: Hero Micro-Fix (KPI spacing + donut proportion)

**Session type:** Micro-pass. 3 className changes. tsc clean.

- Main flex: `gap-3` → `gap-2` (saves 8px overhead, redistributes to content)
- KPI cells: `px-2 py-2.5` → `px-1 py-2` (inter-cell visual gap: 17px → 9px — cells read as one tight unit)
- Donut container: `w-[120px]` → `w-[130px]` (donut 110px now has 10px breathing room on each side vs 5px before)

---

## 2026-04-04 — Budget V2: Hero Side-by-Side Composition (KPI right, donut left)

**Session type:** Hero layout restructuring pass. No data model changes. tsc clean.

### Layout fix
- Donut moved from Row 2 (below KPI strip) to the same main flex row as the KPI block.
- Hero now: `flex gap-3 items-center` — KPI (flex-1, visual RIGHT) | divider | donut+guide (w-[120px], visual LEFT).
- All three KPIs remain in a `grid grid-cols-3` horizontal strip on the right side.
- `self-stretch` divider runs full card height, anchoring the layout.
- `items-center` centers KPI strip vertically alongside taller donut column.

### Donut + guide
- Donut: 110px (`cx=55 cy=55`, `innerRadius=34 outerRadius=52`).
- Guide: 2×2 grid, color-only (no amounts) — `text-[10px]`, `w-2 h-2` dots.
- Container: `w-[120px]`, `flex flex-col items-center gap-2.5`.

### Files changed
- `src/pages/BudgetPage.tsx`

---

## 2026-04-04 — Budget V2: Hero Final Composition (3-col KPI + full donut row)

**Session type:** Hero structural recomposition. No data model changes. tsc clean.

### Title fix
- Monthly tab button: "חודשי" → "ניתוח חודשי"

### KPI strip — 3-col horizontal layout
- All three KPIs now side-by-side in `grid grid-cols-3` (not 2+1 stacked).
- תקציב (blue, text-sm) | בפועל (gray, text-sm, separators both sides) | יתרה/חריגה (color, text-base font-bold, most prominent).
- Reading order in RTL: תקציב → בפועל → יתרה — natural narrative flow.

### Donut + legend — full-width composed row
- Donut moves from a constrained 140px column to a full-width row with the legend beside it.
- Donut size: 110px → 130px (`cx=65 cy=65`, `innerRadius=40 outerRadius=62`).
- Legend: 4 rows of `dot + name (truncate) + amount`, all at `text-sm` — readable, premium.
- No cramped 2×2 grid needed — legend is a natural column with proper spacing.

### Files changed
- `src/pages/BudgetPage.tsx`

---

## 2026-04-04 — Budget V2: Hero Precision Refinement

**Session type:** Targeted hero polish pass. No data model changes. tsc clean.

### Hero KPI panels
- KPI cells (תקציב חודשי / הוצאה בפועל) now have `rounded-lg bg-gray-50 px-2.5 py-2` background panels — creates a designed unit feel rather than loose stacked text.
- Grid gap: `gap-4` → `gap-3` to account for new cell padding.

### Donut side — composed block
- Container: `w-[130px]` → `w-[140px]`.
- Entire donut + legend wrapped in `rounded-xl bg-gray-50 p-2` — donut side now reads as a composed allocation panel, visually distinct from the KPI side.
- Donut center: changed from "מתוקצב + full amount" (redundant with KPI) to "שנוצל + utilization %" (new information).
- `cx={50} cy={55}` fixed to `cx={55} cy={55}` — donut is now pixel-perfectly centered in the 110×110 chart.
- Legend entries: each now shows name (truncated) + amount on a second line (`text-[10px] text-gray-400 tabular-nums`), creating a real allocation breakdown rather than a pure color key. Gap improved `gap-y-1.5` → `gap-y-2`.

### Loans card
- `border-gray-50` → `border-gray-100` for divider line consistency with rest of card grid.

### Files changed
- `src/pages/BudgetPage.tsx`

---

## 2026-04-03 — Budget V2: Loans Card + Hero Final Polish

**Session type:** Targeted repair pass. Two specific issues fixed. tsc clean.

### Fix 1: Loans as real budget card (Option B)
- Loan `Loan` type has no `category` field — cannot map to budget categories.
- Removed the flat info row above the grid (`🏦 תשלומי הלוואות פעילות … / חודש`).
- Added a synthetic "תשלומי הלוואות" card that lives **inside the category grid** as the first card.
- Card structure: header row (icon + "תשלומי הלוואות" + "מחויב" badge), amount row ("תשלום חודשי מחויב" + formatted amount), footer row (link to /loans + "ללא גבול תקציב").
- No progress bar (committed obligation, not a budget limit). No edit affordance.
- Condition: renders only when `totalLoanPayments > 0`.
- Grid condition updated to `totalLoanPayments > 0 || sortedCategories.filter(c => c.budgeted > 0).length > 0`.

### Fix 2: Hero composition final polish
- `p-4` → `p-5` (more breathing room for a hero panel).
- `items-start` → `items-center` on main row flex container.
- `gap-4` → `gap-3` between flex children.
- Added vertical divider `<div className="w-px bg-gray-100 self-stretch" />` between KPI and donut panels.
- `ResponsiveContainer` wrapper removed from hero donut — using `<PieChart width={110} height={110}>` directly (fixed-size container; ResponsiveContainer not needed here).
- Added `startAngle={90} endAngle={-270}` and `paddingAngle={2}` to donut Pie.
- `outerRadius` bumped 50 → 52 (slightly more fill in fixed 110px container).
- KPI labels: `text-gray-500` → `text-gray-400`, `mb-0.5` → `mb-1`.
- Budget/actual numbers: `text-lg` → `text-xl`.
- Remaining: `font-semibold` → `font-bold` (most prominent number on card).
- Goals whisper: `mt-3 pt-3` → `mt-4 pt-3` (slightly more separation from KPI block).
- Legend dot: `w-1.5 h-1.5` → `w-2 h-2` (slightly larger for readability).
- Legend text: `text-gray-400` → `text-gray-500`.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

---

## 2026-04-03 — Budget V2: Hero Restructure + Active Loans Monthly Payment Integration

**Session type:** Targeted implementation pass on Budget V2. Two fixes applied. tsc clean.

### Fix 1: Loans integration
- Added real Supabase query to `fetchData()` — table `loans`, columns `monthly_payment` + `status`, filtered by `account_id` and `status = 'active'`.
- Added `totalLoanPayments` state (number).
- Computed sum of `monthly_payment` across all active loans after `Promise.all` resolves.
- Added loans info row above the category grid: only renders when `totalLoanPayments > 0`. Shows "🏦 תשלומי הלוואות פעילות" + formatted amount per month. Communicates committed monthly outflow from loans as part of the ordinary budget world.

### Fix 2: Hero KPI + Donut restructure
- KPI layout changed from 3 separate stacked divs (`space-y-3`) to: **2-column grid** (budget + actual side-by-side) + **full-width remaining/overrun** below a `border-t border-gray-100`.
- Remaining figure is now `text-2xl` (most prominent number on the hero).
- Donut legend changed from vertical `space-y-0.5` list to **2×2 grid** (`grid grid-cols-2 gap-x-2 gap-y-1`). More compact, better use of horizontal space.
- Donut dimensions reduced from 120×120 to 110×110 (cx/cy 55→50, innerRadius 36→33, outerRadius 55→50).
- RTL order confirmed correct: KPI div is JSX-first (renders RIGHT = primary), Donut is JSX-second (renders LEFT = secondary).
- Goals whisper (Row 2) wrapped in `{hasContent && ...}` guard — no change to copy.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

---

## 2026-04-03 — Budget Top Zone Realignment

**Session type:** Targeted refinement pass on Budget V2 top zone. No data model changes. tsc clean.

### Goals vs Loans semantic fix
- **Removed loans placeholder row** from the "תכנון חודשי" planning card. Loans are budget categories (confirmed monthly expenses), not a planning-layer concept.
- **Removed the entire "תכנון חודשי" card.** It had two dead placeholder rows and felt like broken UI.
- **Goals awareness relocated** into the hero card as a whisper line (Row 2, below KPI+donut). Text: "🎯 יעדי חיסכון — בקרוב תוכל להקצות כאן חלק מהתקציב לטובת יעדים". Feels like a real upcoming feature preview, not a placeholder.

### Hero card recomposition (Option C — three-tier)
- Row 1: KPI stack (flex-1) + Donut (flex-shrink-0) — unchanged structure.
- Row 2 (new): Goals awareness whisper line, separated by a `border-t border-gray-100`. Only visible when budgets exist (inside `hasContent` block). Eliminates any visual dead space below the KPI/donut pair.

### Category card group ordering (semantic + urgency)
- Replaced pure utilization sort with `sortCategoriesV2()`.
- Overrun categories still appear first (sorted by overrun amount desc).
- Non-overrun: sorted by semantic group order (housing → food → dining/entertainment → transport → communication → health → education/children/fitness → clothing/grooming → travel → insurance/pets/gifts → other), then by utilization desc within the same group.
- `CATEGORY_GROUP_ORDER` maps all 16 real category IDs from `categories.ts`.
- `getCategoryGroup()` does exact-match lookup with fallback to group 10 (misc).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

---

## 2026-04-03 — Budget V2: Full Architecture Implementation

**Session type:** Full Budget V2 implementation. BudgetPage.tsx rewritten to spec.

### Hero card (new)
- Replaced 3-column KPI strip with a split hero card: KPI stack (תקציב חודשי / הוצאה בפועל / יתרה|חריגה) on the primary side, interactive donut chart with top-4 legend on secondary side.
- Donut: PieChart/Pie/Cell using `chartColor` from getCategoryMeta, sorted by budget amount desc. Click-to-select toggles `selectedDonutCat` — non-selected slices dimmed to opacity 0.4. Center label shows total budgeted.

### Tabs (new)
- Two-tab navigation: חודשי / מגמות. `bg-gray-100 rounded-xl p-1` container with active tab as white card with shadow-sm.
- MonthSelector shown only when tab === 'monthly'.

### Insights strip (V2)
- Pill 1: month-over-month comparison vs prior month actual (amber if up, green if down, neutral if equal). Prior month fetched in same Promise.all as main fetch — no extra round-trip.
- Pill 2: unbudgeted categories count (amber/warn). Old "total remaining" pill removed in favor of MoM pill.

### Planning section (new)
- תכנון חודשי card with goals + loans placeholders (opacity-50, "בקרוב" title). Shows when totalBudgeted > 0. Bottom row shows תקציב פנוי לניצול.

### Utilization semantics (corrected)
- Exactly 100% → blue tier + "הגעת ליעד" badge (was previously red/overrun). >100% → red. New 5-tier system.
- statusText: "חריגה" only when >100, "הגעת ליעד" when exactly 100, else pct%.
- getCategoryInsight: new messages for exact-100 case, "עברת את התקציב" suffix for overrun, "קרוב לגבול" suffix for near-limit.

### Category grid
- Upgraded to 3-col responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Cards gain `ring-2 ring-[#1E56A0] ring-offset-1` when selected via donut click.

### Trends tab (new)
- Period selector: 3/6/12 months as rounded-full pills.
- Budget vs actual BarChart (light blue budgeted bars, brand blue actual bars, Legend, Tooltip with formatCurrency).
- Category utilization heat table: top 5 categories by total budgeted × months. Each cell colored via getUtilizationColor.badgeBg/badge. Zero cells show "—" in gray-300.

### Performance / cache (new)
- sessionStorage cache key `nmoney_budget_data_${monthStart}`. Cache read before Supabase calls — instant re-display. Cache written after successful fetch. Busted on handleSave, handleInlineSave, handleDelete.

### Removed
- History chart (showHistory toggle, historyData, HistoryPoint, fetchHistory) — replaced entirely by Trends tab.
- KPICard sub-component (replaced by hero card).
- HistoryTooltip sub-component.
- Unused imports: YAxis, CartesianGrid, intervalToMonthly, shortMonthNames.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

---

## 2026-04-03 — Budget: Final Polish Pass

**Session type:** Targeted visual and UX polish pass on BudgetPage.tsx. No data model changes.

### Grid / card layout
- Category section changed from single-column `space-y-3` stack to responsive 2-column grid: `grid grid-cols-1 sm:grid-cols-2 gap-3`. Single column on mobile, 2 columns at sm+ (640px+). RTL-correct — CSS Grid fills right-to-left.

### Utilization color system — 4-tier
- Replaced 2-tier `progressBarColor()` function with `getUtilizationColor()` returning `{bar, badge, badgeBg}` Tailwind classes.
- Thresholds: 0–49% green / 50–79% amber / 80–99% orange / 100%+ red. Infinity (no budget, has spend) → red tier, badge shows "אין תקציב".
- Progress bar, badge background, and badge text all use unified color object. No more hardcoded hex color strings in badge.

### Per-card embedded insights
- New `getCategoryInsight()` function with 4 conditional states: overrun amount, near-limit remaining, zero-spend, low utilization.
- Insight rendered as `text-xs text-gray-400` whisper line inside each card — only when meaningful.
- Silent for normal-range categories (31–79% utilization) — no noise.

### Global insights strip — reduced to 2 global pills max
- Removed overrun count pill (each card now communicates its own overrun state via badge + insight).
- Kept: (1) total remaining budget, (2) unbudgeted categories count.
- Strip hidden entirely when neither condition is true.

### Visual polish
- History chart toggle: title updated to `text-sm font-semibold text-gray-600`; added subtitle `text-xs text-gray-400`.
- History chart height: 140 → 160px.
- Missing-budget nudge heading: now uses `text-amber-800` Tailwind class.
- "ראה בהוצאות" link: now `text-xs text-[#1E56A0]`.
- Card amounts middle value (remaining/overrun) uses utilization color for text emphasis.

### TypeScript
`npx tsc --noEmit` → clean, no output ✅

---

## 2026-04-03 — Budget: Repair and Realignment Pass

**Session type:** Structural repair, semantic fix, and visual realignment. Full BudgetPage.tsx rewrite.

### Semantic fix — actual spend model corrected
- **Root cause:** `actual = variable + fixed` meant recurring projection was added to confirmed movements, inflating "הוצאה בפועל" before any transaction was confirmed. A recurring template of ₪500/month would show as actual spend even if the user never confirmed it, and if the user also logged the movement manually, it would be counted twice.
- **Fix:** `actual = financial_movements ONLY`. Recurring projection is no longer fetched or added to actual spend. This is the truthful model: the KPI "הוצאה בפועל" now reflects confirmed transactions only. `recurringUtils.ts` is still kept as a shared utility but BudgetPage no longer uses it for actual calculation.
- **History chart:** same fix applied — history bars now show confirmed movements only per month (no projection inflation in historical data).

### KPI strip
- Reduced from 4 KPIs to 3: removed "קטגוריות בחריגה" count (moved to insights strip where it belongs).
- KPI value size: `text-xl` → `text-2xl font-semibold` (clearer number hierarchy).

### Insights strip
- Reduced from up to 5 pills to max 3.
- Removed "top category by spend" pill (noise).
- Removed "near limit" pill (low value at this stage).
- Kept: overrun count (warn), remaining budget (good), unbudgeted categories (info).
- Pills redesigned: compact rounded-full pills with colored border and bg tint (not card-style blocks).
- Insight text improved: "X קטגוריות חרגו מהתקציב" (cleaner), "נותרו ₪X מהתקציב החודשי" (cleaner), "X קטגוריות עם הוצאות ללא תקציב" (cleaner).

### Category cards
- Removed fixed/variable whisper line (was clutter; data is in Expense Analysis).
- Removed emoji action buttons (✏️ edit, 🗑️ delete) from card header.
- Delete is now a plain text button in the card footer, next to the navigation link.
- Status badge redesign: single badge in Row 1 right side — green % (under budget), amber % (near limit 80–99%), red "חריגה" (overrun). No separate overrun pill in header.
- Progress bar: `h-2` → `h-1.5` (subtler).
- Navigation link: `"צפה בהוצאות ›"` → `"ראה בהוצאות"` to `/expenses` (no ?category= param — honest navigation; param was passing but not consumed).

### Missing budget nudge
- Section title: `"קטגוריות עם הוצאות — ללא תקציב מוגדר"` → `"קטגוריות ללא תקציב"` (calm, not alarmist).
- Per-row CTA: `"הגדר תקציב"` → `"הגדר"` (short, action-only).

### Carry-forward banner
- Now shows count: `"הועתקו X קטגוריות תקציב מהחודש הקודם. ניתן לערוך כל קטגוריה."`
- New state: `carriedCount` tracks number of categories carried.

### History chart
- Moved behind a collapse toggle button ("היסטוריה — 6 חודשים ▼ פתח") — not the visual centerpiece.
- Collapsed by default.
- Height reduced to 140px when open.
- Removed "קבועות מחושבות כצפי חודשי" disclaimer (no longer needed — history is confirmed movements only).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — full rewrite
- `docs/MODULE_STATUS.md` — semantic change noted
- `docs/CHANGELOG.md` — this entry
- `handoff/SESSION_CHECKPOINT.md` — session entry

---

## 2026-04-03 — Budget: QA + Refinement Pass

**Session type:** Targeted QA fixes — no logic redesign, no new features.

### Bugs fixed
1. **overrunCount KPI was counting unbudgeted categories** — categories with `budgeted === 0` and `actual > 0` were being counted as overruns in the KPI strip and the insights pill. Fixed: `overrunCount` now only counts categories where `budgeted > 0 AND actual > budgeted`. Unbudgeted categories with spend are handled exclusively by the missing-budget nudge card.
2. **Carry-forward banner shown even on failed INSERT** — `sessionStorage.setItem` and `setCarriedForward(true)` were called unconditionally after the insert. Fixed: both are now only called when `insertErr` is falsy.
3. **History chart missing projection disclaimer** — Added `"קבועות מחושבות כצפי חודשי"` subtitle under chart title, consistent with the "(צפי)" honesty convention from Expense Analysis.

### Visual refinements
4. **Page title weight** — `text-2xl font-extrabold` → `text-xl font-semibold` (consistent with Expense Analysis polish pass).
5. **Insights pills** — `px-4 py-3` → `px-3 py-2` (compact, consistent with spec).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — targeted fixes
- `docs/CHANGELOG.md` — this entry
- `docs/MODULE_STATUS.md` — QA pass noted
- `handoff/SESSION_CHECKPOINT.md` — QA pass entry

---

## 2026-04-03 — Budget: Full Implementation Pass

**Session type:** Full rewrite of BudgetPage.tsx. New shared utility. tsc clean.

### What was built
- **Full Budget module** — complete approved architecture implemented in a single pass
- **Shared utility:** `src/lib/recurringUtils.ts` — `intervalToMonthly` extracted as a shared export with a default `legacyFrequency='monthly'` param. FixedExpensesTab and ExpenseAnalysisPage retain their existing imports (FixedExpensesTab is still the source; ExpenseAnalysisPage imports from it). BudgetPage imports from the new shared file.
- **Data model:** variable (financial_movements) + fixed (recurring_expenses projection) combined per category = actual spend
- **Carry-forward:** automatic copy of prior month budgets when current month is empty; sessionStorage guard prevents repeat; dismissible banner shown
- **KPI strip:** 4 cards — תקציב חודשי / הוצאה בפועל / יתרה-or-חריגה / קטגוריות בחריגה (count)
- **Insights strip:** horizontal scroll, up to 5 context-aware pills (overrun alert, near-limit alert, remaining budget, missing budget nudge, top category)
- **Category cards:** full spec — icon, overrun badge, utilization % badge, fixed/variable whisper, color-coded progress bar, amounts row, inline budget edit (tap amount → input → Enter/blur save), "צפה בהוצאות ›" link
- **Missing budget nudge:** amber card for categories with actual > 0 but budgeted = 0; per-row CTA opens panel pre-filled
- **History chart:** Recharts BarChart, 6 months, two bars per month (budget `#BFDBFE` + actual `#1E56A0`), Hebrew short month labels, custom tooltip
- **Panel:** slides from RIGHT (`right-0`) — RTL-correct; category grid picker with pre-fill support; amount input; keyboard support (Enter saves)
- **Sorting:** overrun categories first (desc by overrun), then by utilization desc
- **account_id scoping:** all queries include explicit `.eq('account_id', accountId)` — belt-and-suspenders with RLS

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — complete rewrite
- `src/lib/recurringUtils.ts` — NEW shared utility
- `docs/MODULE_STATUS.md` — Budget marked ✅ CLOSED
- `docs/CHANGELOG.md` — this entry
- `handoff/SESSION_CHECKPOINT.md` — session entry

### Documented v1 limitations (accepted)
- History actual includes recurring projection uniformly — same approximation as Expense Analysis trends
- "צפה בהוצאות ›" passes `?category=` — ExpensesPage does not yet filter by this param (future work)
- No DB UNIQUE constraint on `budgets(account_id, month, category)` — duplicate protection is application-level

---

## 2026-04-03 — Expense Analysis: Stage Closed (Final Closeout Pass)

**Session type:** Docs-only finalization + residual code scan. No code changes made.

### Residual audit result
- `ExpenseAnalysisPage.tsx` scanned for `console.log/error/warn`, `TODO`, `FIXME` — **none found**
- No unused or broken imports detected
- `npx tsc --noEmit` → **clean, exit 0**

### Full implementation arc (4 passes — complete)
1. **Architecture pass:** Two-tab shell (חודשי / מגמות). Full Monthly tab (type filter, attribution filter, payment filter, KPI, donut, breakdowns, category drill-down). Full Trends tab (period selector, AreaChart, stacked BarChart, category heat table).
2. **QA + refinement pass:** 5 bugs fixed (TypeFilter "משתנות" removed as identical to "הכל"; donut cx/cy; RTL period selector; "קבועות (צפי)" honesty label; info state text). tsc clean.
3. **Unified monthly model pass:** "קבועות" mode shows real `recurring_expenses` data (no info state). "הכל" mode: KPI = movements + fixed projection, fixed summary card added. "משתנות" mode restored as meaningful distinct mode. Payment filter hidden in קבועות mode.
4. **UI polish pass:** Typography scaled back throughout (text-4xl → text-3xl KPI; font-extrabold → font-semibold). Spacing tightened. Filter pills compacted. Page reads calm, classic, premium.

### Documented v1 limitations (accepted — not blockers)
- Trends fixed/variable split is estimated (no movement-level `type` flag in `financial_movements` DB)
- "הכל" KPI combines actual + estimated (labeled clearly with subtitle context)
- Recurring attribution in קבועות mode: only reflects attribution if set on template (null-safe)
- Attribution on legacy recurring confirmation rows not retroactively applied

### Docs updated this pass
- `docs/MODULE_STATUS.md` — duplicate "Next step" line removed
- `handoff/LAST_KNOWN_GOOD_STATE.md` — header, section rename, v1 limitations corrected to reflect unified model
- `handoff/SESSION_CHECKPOINT.md` — final closeout entry prepended
- `docs/CHANGELOG.md` — this entry
- `docs/PRODUCT_DECISIONS.md` — no changes needed (all decisions already recorded)

---

## 2026-04-03 — Expense Analysis: UI Polish Pass

### ExpenseAnalysisPage.tsx — visual refinement only (no logic changes)

**Scope:** Typography, spacing, and density pass. All logic, state, data fetching, and component structure unchanged.

**Typography changes:**
- Page title: `text-2xl font-extrabold` → `text-xl font-semibold` (calmer, less dominant)
- KPI number: `text-4xl font-extrabold` → `text-3xl font-semibold` (important but not overwhelming)
- KPI label: `font-bold` → `font-medium` (quiet, secondary role)
- KPI subtitle: `text-sm` → `text-xs` (whisper level)
- Card section titles: `font-bold text-gray-900` → `text-sm font-semibold text-gray-600` (secondary, never competing)
- All `font-bold` amounts in breakdowns/ranking: → `font-semibold text-gray-800` (consistent, less aggressive)
- Tooltip amounts: `text-sm font-bold` → `text-xs font-semibold`
- Filter pill labels: `font-semibold` → `font-medium` (lighter active state)

**Spacing changes:**
- KPI card: `p-6` → `p-5`, `mb-5` → `mb-4`
- All chart/breakdown cards: `p-6` → `p-4`, `mb-5` → `mb-4`
- Card section header: `mb-4` → `mb-3`
- Breakdown rows: `space-y-3` → `space-y-2.5`
- Category ranking rows: `px-4 py-3` → `px-3 py-2`
- Obligation/transaction rows: `py-2.5` → `py-2`
- Filter pills: `px-4 py-2` → `px-3 py-1.5` (compact, still tappable)
- Donut + legend gap: `gap-6` → `gap-4`
- Page header + tab nav: `mb-5` → `mb-4`
- Payment/period filter rows: `mb-5` → `mb-4`

**Polish:**
- Category icon in ranking: `text-lg` → `text-base` (less bulky)
- Drill-down icon: `w-10 h-10 text-xl` → `w-9 h-9 text-lg` (proportional reduction)
- Tooltip padding: `p-3` → `p-2.5`

**TypeScript:** `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Expense Analysis: Unified Monthly Model Fix

### ExpenseAnalysisPage.tsx — major UX fix

**Problem:** Monthly Analysis tab only read from `financial_movements`. Fixed/recurring expenses (from `recurring_expenses`) contributed to monthly spend but were invisible in the analysis. "קבועות" filter showed a dead-end info state. "משתנות" filter did not exist (was removed because it was identical to "הכל").

**Fix:**
- Added `recurring_expenses` fetch to the monthly data load (runs in parallel with movements fetch)
- Introduced `TypeFilter = 'all' | 'variable' | 'fixed'` — all three modes now show real data
- **"הכל" mode:** KPI = variable movements + fixed projection. A "הוצאות קבועות לחודש זה" summary card appears between KPI and donut chart — shows fixed total + category breakdown + CTA to see קבועות detail. Donut/ranking show variable breakdown (labeled "הוצאות משתנות בלבד").
- **"משתנות" mode:** financial_movements only — charts, breakdowns, drill-down all from movements. Restored as a meaningful distinct mode.
- **"קבועות" mode:** recurring_expenses active templates, projected monthly. Shows: KPI, category donut, obligations list (icon + name + monthly amount), attribution breakdown (couple/family). No info state — real data shown.
- Payment filter hidden in "קבועות" mode (not applicable at template level — no per-transaction data).
- Attribution filter applies to both movements (for variable/הכל) and recurring templates (for קבועות — if attribution was set on template).
- `intervalToMonthly` imported from FixedExpensesTab (shared helper — no duplication).

### TypeScript: `npx tsc --noEmit` ✅ clean

### Docs updated
- `docs/MODULE_STATUS.md` — Expense Analysis section updated with unified model description
- `docs/PRODUCT_DECISIONS.md` — קבועות filter decision updated (info state superseded)
- `docs/CHANGELOG.md` — this entry
- `handoff/SESSION_CHECKPOINT.md` — this session

---

## 2026-04-03 — Expenses World: Stage Closed

**Full arc of the Expenses world — all work completed and closed this stage.**

### Modules closed
- `ExpensesPage` (`/expenses`) — 3-tab unified shell: Overview, Variable, Fixed
- `ExpenseAnalysisPage` (`/expenses-analysis`) — two-tab architecture: Monthly + Trends
- `FixedExpensesPage` (`/fixed-expenses`) — redirect stub; all logic in `FixedExpensesTab.tsx`

### Complete feature list (cumulative)
- Unified tab shell with URL-persisted `?tab=` param; MonthSelector in shell header only
- Overview tab: variable actual hero KPI + fixed projection secondary row (semantically separate); compact 120px Recharts donut; top-5 category mini-bars; fixed obligations status card + progress bar; budget bridge row; true empty state for new users; "ניתוח מפורט ›" styled secondary CTA button
- Variable tab: expense CRUD grouped by category (sorted by total desc) with right-border color accent; search; attribution (couple/family); payment source/method; subcategory chips; 2-click delete with inline confirmation; voice input (Hebrew SpeechRecognition → voiceParser → form population, preview bar, no auto-save)
- Fixed tab: monthly confirmation section with progress dots; obligation card list with category icon + frequency badge + billing day; full template CRUD with scope modal (future/retroactive/current-only); subcategory + attribution propagation to confirmed financial_movements; attribution picker for couple/family; always-visible mobile actions
- ExpenseAnalysis Monthly tab: type filter (הכל/קבועות — "משתנות" removed, was identical to "הכל"); attribution filter; payment filter; KPI card; Recharts donut (cx/cy=80, centered); payment breakdown (full month basis, always shown when data exists); attribution breakdown (couple/family, full month basis); full category ranking with click drill-down to subcategory breakdown + transaction list
- ExpenseAnalysis Trends tab: period selector (3/6/12 months); AreaChart (monthly total); stacked BarChart with "קבועות (צפי)" label (honest projection); category heat table (top 5, month-by-month)
- AppLayout: 3 expense nav entries → 1 "הוצאות"; global FAB 2-option popup (fixed backdrop z-index bug resolved); mobile bottom nav updated
- DB migration: `supabase/migrations/20260403_recurring_sub_category.sql` — adds `sub_category`, `attributed_to_type`, `attributed_to_member_id` to `recurring_expenses`
- DB migration: `supabase/migrations/20260403_fix_financial_movements_delete_rls.sql` — account-member-scoped DELETE policy

### Bugs fixed (across all passes)
7+ bugs resolved: FAB backdrop z-index; variable delete silent-failure (RLS + constraint); stale closure on fetchExpenses; voice date logic overwrite; donut cx/cy off-center (ExpensesPage + ExpenseAnalysisPage); RTL `pl-1`→`pr-1` on period selector; FixedExpensesTab confirmError styling; mobile obligation actions hidden (hover-only); payment/attribution breakdown using wrong filtered basis; "משתנות" type filter producing zero-diff result; delete of confirmed recurring triggering DB constraint

### v1 limitations (accepted — not blockers)
- No movement-level `type` flag in `financial_movements` — fixed/variable split in Trends is estimated
- "קבועות" filter in ExpenseAnalysis shows info state (by design)
- Attribution on legacy recurring confirmation rows not retroactively applied

### Residual audit (final closeout pass)
Scanned all three pages for console.log / TODO / FIXME — none found. `npx tsc --noEmit` clean.

---

## 2026-04-03 — Expense Analysis: QA + refinement pass

### ExpenseAnalysisPage.tsx — bugs fixed
- **TypeFilter bug:** Removed "משתנות" option from type filter — it was identical to "הכל" (no movement-level type flag in DB), producing zero visible difference and misleading the user. Now only "הכל" and "קבועות" remain.
- **קבועות info state text:** Rewrote to be unambiguous — old text "כאן מוצגות הוצאות משתנות בלבד" was confusing when the info state shows no data; new text clearly explains the redirect.
- **Donut cx/cy:** Corrected from 75 to 80 (true center of 160px ResponsiveContainer) — was 5px off-center.
- **Trends period selector RTL:** Label had `pl-1` (wrong physical side in RTL); corrected to `pr-1` — consistent with all other filter labels.
- **Stacked bar chart honesty:** "קבועות" bar name updated to "קבועות (צפי)" in Legend/Tooltip — makes clear this is an estimated projection, not actual confirmed spend.

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Expense Analysis: two-tab architecture implementation

### ExpenseAnalysisPage.tsx — full rewrite with approved architecture
- Added two page-level tabs: חודשי (Monthly) and מגמות (Trends)
- Monthly tab: type filter (הכל/משתנות/קבועות) added FIRST before attribution/payment filters
- Monthly tab: KPI card redesigned (clean typography — total + count, no mini-bars)
- Monthly tab: category donut chart preserved with click-to-select behavior
- Monthly tab: payment breakdown bars preserved
- Monthly tab: attribution breakdown preserved (couple/family)
- Monthly tab: full category ranking with drill-down preserved
- Trends tab: period selector (3 / 6 / 12 months) — replaces MonthSelector for this tab
- Trends tab: AreaChart for monthly total spend over time (Recharts)
- Trends tab: stacked BarChart for fixed projection vs variable actual by month (Recharts)
- Trends tab: category trends table (top 5 categories, month-by-month heat cells)
- MonthSelector shown only in Monthly tab header
- All data from real Supabase queries — no mock data

### ExpensesPage.tsx — CTA upgrade
- "ניתוח מפורט ›" link upgraded from plain text link to styled secondary CTA button (blue tint bg, blue text)

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Expense Analysis: breakdown visibility fix

### ExpenseAnalysisPage.tsx
- Payment breakdown now computed from raw `movements` (full month, no filter dependency) — was computed from `filtered` which caused it to disappear when ≤1 method in filtered set
- Removed `pmList.length <= 1` guard — payment breakdown always shown when there is data (single-method users now see "100% credit" which is valid analysis)
- Attribution breakdown now computed from raw `movements` — was computed from `paymentFiltered`, affected by payment filter state
- `paymentFilteredTotal` replaced with `totalMovements` as % basis for both breakdowns
- Zero-amount member rows suppressed in attribution breakdown
- Payment breakdown moved BEFORE attribution breakdown — payment is universal (all account types), attribution is couple/family only
- Both breakdown cards show "כל החודש" label to clarify they reflect full month data, not the filtered view
- Bar height increased from h-1.5 to h-2 for better readability
- `pmList` pre-computed in derived data using `resolvePaymentDisplay` (correct Hebrew labels + colors per method)

---

## 2026-04-03 — Expenses final closeout: attribution + polish

### FixedExpensesTab.tsx
- Added `attributed_to_type` and `attributed_to_member_id` to RecurringExpense interface and SavePayload
- `useAccount()` destructure now includes `isCouple, isFamily, members`
- Fetch SELECT includes attribution columns
- openEdit populates attribution form state
- handleSave computes attribution based on account type (null for personal)
- handleConfirm propagates attribution from template to confirmed financial_movements
- handleApplyScope (both current-only and retroactive) propagates attribution to financial_movements
- Attribution picker UI added to add/edit panel for couple/family accounts (shared + per-member buttons)

### supabase/migrations/20260403_recurring_sub_category.sql (UPDATED)
- Added `ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS attributed_to_type text`
- Added `ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS attributed_to_member_id uuid`
- Run this migration if not already done (idempotent)

### ExpensesPage.tsx
- Removed unused `useNavigate` import and `navigate` constant
- Fixed donut Pie cx/cy from 55→60 for proper centering in 120px container
- Center overlay text size bumped to 11px for readability

---

## 2026-04-03 — Expenses final completion pass

### FixedExpensesTab.tsx + supabase/migrations/20260403_recurring_sub_category.sql (NEW)
- Added `sub_category` field throughout fixed expenses: interface, SavePayload, form, fetch SELECT, handleSave, handleConfirm, handleApplyScope (both retroactive and current-only paths)
- Category picker upgraded: emoji icons added to pills; subcategory chip row shown when SUBCATEGORIES[category] exists
- Migration adds `sub_category text` column to `recurring_expenses` — must be run in Supabase SQL editor

### ExpensesPage.tsx
- Added Recharts PieChart/Pie/Cell/Tooltip/ResponsiveContainer import
- Added `chartColor` to topCategories computation
- Added compact 120px donut above category bars in "קטגוריות מובילות" overview card

### ExpenseAnalysisPage.tsx
- Added "חלוקה לפי אמצעי תשלום" section between attribution breakdown and category ranking
- Computes per-source (paymentSources) or per-payment_method totals from filtered movements
- Renders horizontal bars + % per payment method; hidden when only 1 method found

---

## 2026-04-03 — Variable expense delete: recurring_confirmations constraint fix

### VariableExpensesTab.tsx
- **Root cause:** Confirmed fixed expenses (source='recurring') appear in the Variable tab (all type='expense' rows fetched). Their `movement_id` FK on `recurring_confirmations` uses `ON DELETE SET NULL`. The check constraint `recurring_confirmations_status_movement_match` requires `movement_id IS NOT NULL` when `status='confirmed'`. Deleting the movement triggered the FK → NULL → constraint violation 23514.
- **Fix:** Added `source` to FinancialMovement interface + SELECT query. In `handleDelete`, when `source === 'recurring'`, delete the linked `recurring_confirmations` row first (un-confirms the monthly occurrence), then delete the movement. For `source='manual'` rows, behavior unchanged.
- Side effect: deleting a confirmed recurring expense from the Variable tab resets it to "pending" in the Fixed tab for that month — correct product behavior.

---

## 2026-04-03 — Variable expense delete: RLS policy fix (migration)

### supabase/migrations/20260403_fix_financial_movements_delete_rls.sql (NEW)
- Drops creator-only DELETE policy on `financial_movements` (all common naming variants)
- Creates account-member-scoped DELETE policy: any member of the account can delete any movement in that account
- Cross-account isolation preserved: `account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())`
- **Must be run in Supabase SQL editor** — see CURRENT_BLOCKERS.md for full SQL
- Completes the fix: client-side `.select('id')` guard catches any remaining edge case after policy is applied

---

## 2026-04-03 — Variable expense delete: silent failure fix

### VariableExpensesTab.tsx
- **Root cause:** `.delete()` without `.select()` returns `{ error: null }` even when RLS blocks the DELETE (0 rows affected). Optimistic `setExpenses(filter)` removed the row from local state — row reappeared on next fetch. No `try/catch` could also leave `deletingId` stuck permanently if a network exception occurred.
- **Fix:** Added `.select('id')` to the delete query. Now checks `deleted.length === 0` (silent RLS block) and shows an explicit Hebrew error; row stays in local state. Wrapped in `try/catch` to clear `deletingId` on unexpected throws.
- **Why only some rows:** Rows created by a different household member have a different `user_id`. If the RLS DELETE policy is `user_id = auth.uid()`, those rows are blocked silently.

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Expenses world closeout (QA + docs sync)

### AppLayout.tsx
- **Fix (FAB backdrop):** Desktop FAB outside-click dismissal was broken — backdrop at `z-[-1]` inside `z-30` stacking context never received clicks. Restructured: backdrop moved to sibling at `z-[29]`, whole FAB wrapped in fragment.

### FixedExpensesTab.tsx
- **Fix (confirmError styling):** Deactivation confirmation error used old `bg-red-50` Tailwind classes — not dismissible. Unified to inline-style error banner matching all other error banners + ✕ dismiss.

### Docs
- `docs/MODULE_STATUS.md`: AppLayout FAB label "הוסף עסקה" → "הוסף הוצאה" + popup description; Fixed Expenses standalone section marked as merged into unified module
- `handoff/LAST_KNOWN_GOOD_STATE.md`: TransactionsPage references replaced with unified Expenses module files; tsc note updated
- `handoff/SESSION_CHECKPOINT.md`: Expenses closeout entry added

### TypeScript: `npx tsc --noEmit` ✅ clean
**Expenses world: CLOSED for this stage**

---

## 2026-04-03 — Expenses full audit + repair pass

### VariableExpensesTab.tsx
- **Fix (payment — cash always visible):** When user has named payment sources, generic methods (cash, bit, transfer, credit) were completely hidden. Fixed: sources shown first, then generic methods filtered to only those NOT already covered by a named source. 'הוראת קבע' (standing order) excluded from variable expense payment options — it belongs to fixed/recurring only.
- **Fix (form field order):** Amount moved to top of form (was position 2). Date moved below subcategory (was position 3). New order: amount → description → category → subcategory → date → attribution → payment → notes. Reflects natural expense entry flow.
- **Fix (delete confirmation):** One-click delete replaced with two-click inline confirmation. First click shows "מחק?" in red; second click within 3s executes delete. Auto-reverts after 3s.
- **Add confirmDeleteId state**

### VoiceExpenseButton.tsx
- **Fix (silent failure):** `rec.onerror` was silent — user saw button return to idle with no explanation. Now classifies: 'not-allowed' → "יש לאשר גישה למיקרופון" (persistent); other errors → "ההקלטה נכשלה — נסה שוב" (3s auto-clear). Error clears when recording starts again.

### FixedExpensesTab.tsx
- **Fix (deactivate confirmation):** One-click deactivate replaced with two-click inline confirmation ("בטל?"), same pattern as variable delete.

### docs/PRODUCT_DECISIONS.md
- **Update (voice input):** Was "stub only — injects NO data". Updated to reflect actual full implementation as of 2026-04-03.

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — QA pass: Expenses world — two bug fixes

### VariableExpensesTab.tsx
- **Fix (stale closure):** `fetchExpenses` useCallback dep array was `[user?.id, currentMonth]` — missing `accountId`. If accountId changes without remount, the fetch would use a stale account filter. Added `accountId` to deps.
- **Fix (voice date logic):** `handleVoiceTranscript` used `if (parsed.date)` to set `txDate` — always true because `parsed.date` defaults to today even when no date was spoken. This overwrote any user-set date silently. Changed to `if (parsed.fieldsFound.includes('date'))` to only apply the date when it was actually found in the voice input.

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Voice-to-data: Hebrew expense dictation (VoiceExpenseButton + voiceParser integration)

### New files
- `src/lib/voiceParser.ts` — pure Hebrew text → structured expense parser. No API calls, no side effects. Extracts amount, category (16 IDs), date (relative + absolute), payment method/source, attribution (member name / shared), description.
- `src/components/expenses/VoiceExpenseButton.tsx` — self-contained mic button. Three states: idle (blue "הכתב בקול"), recording (red pulse + interim transcript + "עצור"), unsupported (greyed, disabled, tooltip). Browser support check on mount via `window.SpeechRecognition ?? window.webkitSpeechRecognition`. `lang='he-IL'`, `interimResults=true`. SpeechRecognition created inside `startRecording` (not module-level).

### Modified
- `src/components/expenses/VariableExpensesTab.tsx`:
  - Added `VoiceExpenseButton` import + `parseExpenseText / ParsedExpense` import
  - Added `voiceParsed` state (clears on form reset)
  - Added `handleVoiceTranscript` — runs parser, applies safe merge to form state (only fills non-empty parsed values; attribution only applied for couple/family accounts)
  - Drawer header: voice button shown only when adding (`!editingMovement`) — not during edit
  - "מה הבנתי:" preview bar shown below header when parse result exists — dismissible. Shows amount chip (red), category name chip, date chip (only if date was explicitly found in text)
  - No auto-save — user must review/edit before saving

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## 2026-04-03 — Expenses subfeatures: mobile fix, animation, empty state, budget bridge

### FixedExpensesTab.tsx
- **Fix (critical mobile):** Obligations card edit/deactivate buttons were `opacity-0 group-hover:opacity-100` — permanently invisible on mobile (no hover). Changed to `md:opacity-0 md:group-hover:opacity-100` — always visible below `md`, hover-reveal on desktop only. Added `aria-label` attributes.

### VariableExpensesTab.tsx
- **Fix (animation parity):** Added `slideInRight 0.25s ease` animation to the add/edit drawer — matching FixedExpensesTab which already had it. Added `<style>` block with keyframe.

### ExpensesPage.tsx (Overview)
- **New: true empty state** — when `varTotal === 0 && topCategories.length === 0 && totalFixed === 0` (brand-new user or genuinely empty month), Overview now shows a single welcoming card with two CTAs ("+ הוצאה משתנה" and "+ הוצאה קבועה") instead of an empty card layout showing zeros
- **New: budget bridge** — "תקציב חודשי" row above the add CTA: icon + description + "לתקציב ›" link to `/budget`. Lightweight but creates the explicit connection between spending and budget worlds
- TypeScript: `npx tsc --noEmit` ✅ clean

## 2026-04-03 — Expenses module: UX/product refinement pass

### ExpensesPage.tsx
- **Fix (semantic):** Overview summary card no longer combines variable + fixed into one misleading total. `varTotal` shown as hero "הוצאות בפועל החודש". Fixed monthly projection shown as a clearly secondary labeled row "קבועות — צפי חודשי" — only appears when `fixedTotal > 0`. This distinction is important: variable movements are actual charges; fixed total is a projected monthly equivalent of recurring templates, not actual debits.
- **Fix (data):** Both `financial_movements` queries in `fetchOverview` now include `.eq('account_id', accountId)` — belt-and-suspenders alongside RLS
- **Fix (RTL):** Forward navigation links changed `←` → `›` (RTL-correct: `‹` = back, `›` = forward/detail)
- **Fix (mobile):** Tab nav changed from `w-fit` to `w-full sm:w-fit`; tab buttons get `flex-1` on mobile so all three tabs share space equally
- **Improvement:** Added null state copy under hero total when `varTotal === 0` and no trend available ("עדיין אין הוצאות החודש")

### VariableExpensesTab.tsx
- **Fix (data):** Fetch now includes `.eq('account_id', accountId)` — consistent with all other module queries
- **Fix (guard):** Fetch guard strengthened from `if (!user)` to `if (!user || !accountId)`

### TypeScript: `npx tsc --noEmit` ✅ clean

Format: [date] — summary of meaningful changes

---

## 2026-04-03 — Unified Expenses module: Overview + Variable + Fixed tabs

### Expenses module consolidation
- **New:** `ExpensesPage.tsx` — shell at `/expenses` with 3-tab segmented nav (סקירה | משתנות | קבועות)
- **New:** `VariableExpensesTab.tsx` — expense CRUD with category-grouped list, right-border accent, ?add=true
- **New:** `FixedExpensesTab.tsx` — fixed/recurring management; table replaced with card list; confirmation section redesigned with progress dots
- **Overview tab:** variable total + fixed monthly total + trend delta + top categories mini-bars + fixed status progress + analysis link + add CTA
- **Navigation:** AppLayout consolidated from 3 expense nav items to 1 "הוצאות" → /expenses (desktop + mobile)
- **Redirects:** `/transactions` and `/fixed-expenses` now stub-redirect to /expenses with tab param
- **ExpenseAnalysisPage:** back button now goes to /expenses instead of /dashboard
- **Dashboard:** all /transactions links updated to /expenses?tab=variable
- **FAB:** updated to /expenses?tab=variable&add=true
- TypeScript clean ✓

---

## 2026-04-03 — Expenses module: pure expense view, transfers and income removed

### TransactionsPage → pure Expenses module
- **DB query:** now fetches only `type = 'expense'` — income and transfer rows never loaded
- **grouping:** `buildGroupedSections()` replaced with `buildCategoryGroups()` — groups by expense category only, sorted by total desc; no type-level sections
- **Transfers removed:** no transfer type tab, no transfer form path, no transfer rows displayed
- **Income removed:** no income rows, no income redirect notices, no income filter pill
- **Voice stub removed:** `showVoiceModal`, `isRecording`, `transcription`, `recordingTimer`, `handleVoiceClick` all deleted
- **Filter bar replaced:** type pills removed; search bar only
- **Summary bar replaced:** compact total chip "סה״כ החודש: −X" (expenses only)
- **Drawer:** single expense form, clean — no type tabs, no income notice
- **Copy:** all Hebrew labels updated to expense context; nav label updated "עסקאות" → "הוצאות"
- **AppLayout:** desktop + mobile nav label updated
- TypeScript clean ✓

---

## 2026-04-03 — Transactions: grouped view + income responsibility split

### TransactionsPage rewrite
- **Display model:** flat list replaced with structured grouped sections — movements grouped by type (הכנסות → העברות → הוצאות) then by category within expenses
- **Category groups (expense):** header shows icon + name + count + total; rows sorted date desc; groups sorted by total desc
- **Income responsibility:** income creation removed from Transactions drawer; income rows display read-only with "↗ הכנסות" link; empty state for income filter shows link to IncomesPage
- **Drawer:** type tabs are expense + transfer only; income redirect notice always visible in drawer
- **`buildGroupedSections()`:** new pure function handles all grouping/ordering logic
- **`TxType`:** narrowed from `'expense' | 'income' | 'transfer'` to `'expense' | 'transfer'`
- **`handleEdit`:** guards against income movements (no-op + guard)
- Page title changed from "עסקאות" to "תנועות"
- Preserved: CRUD for expense/transfer, attribution, payment sources, search, month navigation, summary bar, ?add=true param, voice modal stub
- `docs/PRODUCT_DECISIONS.md`: Transactions/Income split locked
- TypeScript clean ✓

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
