# Session Checkpoint

---

## INCOMES UNIFIED CONTROL CENTER — PRODUCT DIRECTION LOCKED — 2026-04-07

### What was decided
- V2 two-section architecture (locked 2026-04-06, implemented in reshape earlier same day) is **superseded** by a new clarified product direction
- New direction locked in PRODUCT_DECISIONS.md: "Incomes Module — Unified Control Center (locked 2026-04-07)"

### New governing decisions
- **Single unified table** — not two separate section tables
- **Three income natures:** קבועה (template-backed) | משתנה (recurring, no template) | חד-פעמית (one-off)
- **Choice drawer:** three options (קבועה / חד-פעמית / משתנה)
- **Unified 11-column table:** שם ההכנסה | סוג הכנסה | [שיוך] | אופי ההכנסה | סטטוס | תאריך | יעד הפקדה | סכום צפוי | סכום בפועל | הערות | פעולות
- **Compact filter UX:** search + "סינון" button + collapsible 4-filter panel (סוג הכנסה / שיוך / אופי ההכנסה / סטטוס)
- **Summary strip:** 4 elements (סכום צפוי / סכום בפועל / פער / pie chart by type)
- **Reduced analytics:** expected vs actual chart only; all other charts/KPIs removed

### Docs updated this session
- `docs/PRODUCT_DECISIONS.md` — V2 section marked superseded; new "Unified Control Center" section added
- `docs/MODULE_STATUS.md` — two-section description replaced with new unified direction
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` — V2 note updated
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/CHANGELOG.md` — new entry

### What is NOT superseded from V2
- Phase 1 schema additions (recurring_income_id FK, recurring_income_confirmations table)
- Confirmation model (מצופה / הגיע / לא הגיע)
- Hard delete guard for templates

### Current code state
- `src/pages/IncomesPage.tsx` still has V2 two-section layout — needs re-implementation
- No code changes in this session (docs-only pass)

### Next step
Implement re-architecture of IncomesPage.tsx to match Unified Control Center locked decisions

---

## INCOMES V2 RESHAPE — COMPLETE — 2026-04-07
> ⚠️ Superseded same day by "Unified Control Center" direction above. Historical record preserved below.

### What was done
- Reshaped IncomesPage.tsx from unified single-tbody table to V2 two-section layout per locked decisions (2026-04-06)
- Removed UnifiedIncomeRow, IncomeRowNature, IncomeRowStatus types
- Removed filterRowTypes, filterDeposit, filterStatus state and all their filter UI
- Removed unifiedRows, filteredRows, depositFilterOptions useMemos
- Added filteredTemplates useMemo (recurringIncomes, respects showInactiveTemplates toggle + V2 filters)
- Added filteredIncomes useMemo (incomes where recurring_income_id == null + V2 filters)
- Added showChoiceDrawer state — single "הוסף הכנסה" CTA now opens choice drawer
- Added showInactiveTemplates toggle in recurring section header

### Architecture compliance (V2 locked 2026-04-06)
- Two distinct visual sections: "הכנסות קבועות" + "הכנסות חד-פעמיות" ✅
- Separate thead/tbody per section ✅
- Recurring columns: סוג הכנסה | תיאור | [שיוך] | יום צפוי | סכום צפוי | סכום בפועל | סטטוס | פעולות ✅
- One-time columns: תאריך | תיאור | [שיוך] | הופקד לחשבון | סכום | פעולות ✅
- Removed V2-rejected filters: סוג שורה, הופקד לחשבון, סטטוס ✅
- Filter bar: סוג הכנסה + שיוך only ✅
- Choice drawer: חד-פעמית / קבועה תבנית ✅
- Inactive templates hidden by default; "הצג לא פעילות" toggle ✅

### Preserved from prior V2 phases
- All confirmation handlers (handleSaveRecurringArrival, handleMarkSkipped, handleOpenArrival)
- templateMonthStatuses useMemo
- All 3 panels (income, recurring template, arrival)
- Analytics section (unchanged)
- Summary strip (unchanged)

### Files changed
- src/pages/IncomesPage.tsx — reshape only, no migrations, no other files touched

### QA
- npx tsc --noEmit: clean
- Browser QA: routing confirmed (no crash), full interactive QA requires live auth session

### Next step
Run full interactive browser QA with authenticated session on /incomes. Then: browser QA for staging deployment (vercel.json + env vars — see STAGING DEPLOYMENT section below).

---

## STAGING DEPLOYMENT — IN PROGRESS — 2026-04-06

### 1. Already done
- 3 Incomes V2 bugfix pass bugs fixed in `src/pages/IncomesPage.tsx`:
  - `recurring_income_id !== null` → `!= null` (pre-migration safety)
  - `handleMarkSkipped` delete error now caught before local state mutation
  - `handleSaveRecurringArrival` sets `arrivalEditingMovementId` after insert so retries UPDATE not INSERT
- `vercel.json` created at project root (build command: `vite build`, SPA rewrite, outputDirectory: `dist`)
- `vite build` verified clean (265ms, no errors)
- Pre-existing TypeScript build errors identified in BudgetPage, DashboardPage, FixedExpensesTab, ExpenseAnalysisPage, ExpensesPage, SettingsPage — NOT blocking staging (vite build skips tsc)

### 2. Still missing
- Vercel CLI install + login
- Vercel project creation and first deploy
- Env vars set in Vercel dashboard
- `VITE_PUBLIC_APP_URL` set to the deployed Vercel URL (requires knowing URL first)
- Supabase Auth → Site URL + Redirect URLs updated for Vercel domain
- Redeploy after env vars are set

### 3. Files created/changed for staging
- `vercel.json` — NEW (created this session, already committed? No — still uncommitted)
- `src/pages/IncomesPage.tsx` — bugfix edits (uncommitted)
- `src/pages/ExpenseAnalysisPage.tsx` — type-only fixes (uncommitted)
- `src/pages/ExpensesPage.tsx` — type-only fix (uncommitted)
- `src/pages/SettingsPage.tsx` — type-only fix (uncommitted)

### 4. Env vars required in Vercel dashboard
```
VITE_SUPABASE_URL=https://xvkobtfilvacfurislvp.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_rdvbyE4v2FO8WDmxWP8OdQ_m6zhD9MB
VITE_PUBLIC_APP_URL=https://<your-vercel-url>.vercel.app   ← set after first deploy
```

### 5. Supabase Auth changes required
In Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `https://<your-vercel-url>.vercel.app`
- **Redirect URLs:** add `https://<your-vercel-url>.vercel.app/**`

### 6. Exact commands to run next
```bash
# Install Vercel CLI (once)
npm install -g vercel

# Login (opens browser)
vercel login

# Deploy from project root (follow prompts: link to new project, no override of settings)
cd /Users/matankadoshian/Desktop/N.Money
vercel

# After first deploy: note the preview URL, then set env vars in Vercel dashboard
# Then redeploy to pick up env vars:
vercel --prod
```
Or use Vercel dashboard: vercel.com → New Project → Import Git repo → set env vars → deploy.

### 7. First prompt for new deployment session
```
Read handoff/SESSION_CHECKPOINT.md top section (STAGING DEPLOYMENT — IN PROGRESS).

The vite build is clean. vercel.json is already created. The only work needed is:
1. Commit all uncommitted changes (vercel.json + bugfix files)
2. Deploy to Vercel (CLI or dashboard)
3. Set the 3 env vars in Vercel dashboard
4. Update Supabase Auth URL Configuration for the Vercel domain
5. Redeploy

Do not touch app code. Do not fix TypeScript errors (pre-existing, not blocking staging).
Return only: the public staging URL and confirmation that auth + invite links work.
```

---

## INCOMES V2 PHASE 3 — COMPLETE — 2026-04-06

### What was done
- 14 new state vars for arrival panel + markingSkippedId
- `handleOpenArrival` — edit or new mode based on existing confirmation
- `handleMarkSkipped` — deletes old movement if previously confirmed, upserts confirmation status='skipped'
- `handleSaveRecurringArrival` — insert/update movement (recurring_income_id, source='recurring', expected_amount=null) + upsert confirmation status='confirmed'
- `filteredIncomes` now excludes `recurring_income_id IS NOT NULL`
- Desktop: action column widened to 160px; status-driven action buttons (רשום קבלה / לא הגיע / ערוך קבלה)
- Mobile: same action buttons added below edit/toggle row
- Arrival drawer: slideInRight panel, template context pill, 6 fields, green save button
- Error banner for `recurringMonthConfirmationsError`
- `npx tsc --noEmit` → clean

### Critical precondition (still required for live operation)
All 3 Phase 1 migrations must be run in Supabase:
1. `supabase/migrations/20260405_income_expected_amount.sql`
2. `supabase/migrations/20260405_recurring_incomes.sql`
3. `supabase/migrations/20260406_incomes_v2_phase1.sql`

### Next step
Browser QA pass:
1. Open recurring template row → "רשום קבלה" opens drawer prefilled from template
2. Fill and save → movement appears with 🔁 status badge "הגיע" + confirmed amount in table
3. One-time section does NOT show the recurring-linked movement
4. "לא הגיע" → status badge changes to "לא הגיע" immediately
5. "ערוך קבלה" (after first confirm) → drawer prefilled from existing movement
6. Existing one-time add/edit/delete still works
7. Analytics still loads

Then: Phase 4 planning (analytics improvements or additional V2 features)

---

## INCOMES V2 PHASE 2 — COMPLETE — 2026-04-06

### What was done
- `RecurringIncomeConfirmation` interface + `TemplateMonthStatus` type (previous session)
- `recurringMonthConfirmations` state + `fetchRecurringMonthConfirmations` callback added
- `recurring_income_id` added to `financial_movements` select strings
- `templateMonthStatuses` useMemo: Map<recurring_id, {status, confirmedAmount}>
- Desktop template rows: TemplateMonthStatus badge (מצופה=amber / הגיע=green / לא הגיע=rose) + confirmed amount in בפועל col
- Mobile template cards: same status badge + בפועל confirmed amount
- `npx tsc --noEmit` → clean
- Docs updated (MODULE_STATUS, CHANGELOG)

### What Phase 2 does NOT do (intentional)
- No write flow — cannot mark income as arrived/skipped from UI
- Confirmations table is empty until: (a) Phase 1 migration runs + (b) Stage 4 write path is built

### Migrations still pending (must be run in Supabase SQL editor)
1. `supabase/migrations/20260405_income_expected_amount.sql` — adds `expected_amount` to `financial_movements`
2. `supabase/migrations/20260405_recurring_incomes.sql` — Stage 3 recurring_incomes table
3. `supabase/migrations/20260406_incomes_v2_phase1.sql` — adds `recurring_income_id` FK + `recurring_income_confirmations` table

### Next step
Stage 4: confirmation write flow — "הגיע" / "לא הגיע" buttons on each template row → upsert to `recurring_income_confirmations`, optionally link to a movement_id. No drawer needed — can be inline row actions.

---

## INCOMES V2 PHASE 1 — SCHEMA CREATED — 2026-04-06

### What was done
- Deep product + architecture planning pass: diagnosed 10 structural problems, locked 14 V2 decisions
- Phase 1 migration file created: `supabase/migrations/20260406_incomes_v2_phase1.sql`
- All docs updated: DATA_MODEL, PRODUCT_DECISIONS, MODULE_STATUS, INCOME_MODEL_PLAYBOOK, CHANGELOG

### What Phase 1 adds (PENDING Supabase execution)
| Object | Type | Status |
|--------|------|--------|
| `financial_movements.recurring_income_id` | nullable FK → recurring_incomes | migration file ready, NOT yet run |
| `recurring_income_confirmations` table | new table + RLS + 2 indexes | migration file ready, NOT yet run |

### Action required before Phase 2 can start
Run `supabase/migrations/20260406_incomes_v2_phase1.sql` in Supabase SQL editor.
Then verify the 6 SQL checks at the bottom of the file pass.

### Next session starting instruction
"Confirm Phase 1 migration is live (run the 6 verification queries). Then start Phase 2: add `recurring_income_confirmations` fetch to IncomesPage.tsx for the selected month, compute per-template monthly status (מצופה/הגיע/לא הגיע), and render the status badge on each recurring template row. Read-only — no write path yet."

---

## INCOMES ANALYTICS SECTION — IMPLEMENTATION COMPLETE — 2026-04-06

### What was done
- Product spec pass: analytics v1 locked (placement, period model, filter independence, 3-concept separation, 4 KPIs, 4 charts, empty states, out-of-scope list)
- Implementation pass: analytics section added to `IncomesPage.tsx` below unified table
- `npx tsc --noEmit` → clean

### What was implemented
| Feature | Status |
|---------|--------|
| `getAnalyticsPeriodBounds()` helper (period → start/end/month labels) | ✅ |
| `analyticsPeriod` state (default 6m) + period selector UI | ✅ |
| `fetchAnalyticsIncomes` — separate query, independent of table | ✅ |
| `analyticsData` + loading/error state | ✅ |
| `analyticsByMonth` — per-month actual + expected aggregation | ✅ |
| `analyticsAvg`, `analyticsPeakMonth`, `analyticsLowMonth` | ✅ |
| `analyticsStabilityPct` (baseline / avg %) | ✅ |
| `analyticsTypeBreakdown` (by sub_category, null → "לא מסווג") | ✅ |
| `analyticsAttributionBreakdown` (couple/family only) | ✅ |
| KPI strip: 4 cards, stability card conditional | ✅ |
| Chart 1: monthly BarChart + recurring baseline ReferenceLine | ✅ |
| Chart 2: expected vs actual grouped bars — hidden when no expected data | ✅ |
| Chart 3: type breakdown horizontal bars | ✅ |
| Chart 4: attribution breakdown — couple/family guard | ✅ |
| Zero-data empty state: muted line "הוסף הכנסות כדי לראות ניתוח" | ✅ |
| Loading/error states for analytics | ✅ |

### Files changed
- `src/pages/IncomesPage.tsx` — analytics section (state + computations + render)
- `docs/CHANGELOG.md`, `docs/MODULE_STATUS.md`, `handoff/SESSION_CHECKPOINT.md` — updated

### Pending (not blocking)
- Browser QA pass
- Run `supabase/migrations/20260405_income_expected_amount.sql` if not yet applied
- Run `supabase/migrations/20260405_recurring_incomes.sql` if not yet applied

### Next session starting instruction
"Browser-verify the Incomes page analytics section. Run `npm run dev`. Check: (1) analytics section appears below the table; (2) period selector changes data; (3) KPI cards correct; (4) Chart 1 bar chart renders; (5) Chart 2 hidden when no expected_amount data; (6) type/attribution breakdowns; (7) mobile layout. Fix any runtime issues found."

---

## INCOMES UNIFIED SCREEN — IMPLEMENTATION COMPLETE — 2026-04-05

### What was done
- Planning pass: 9 technical questions answered (architecture, state model, filter mechanics, column composition, implementation order, regression risks)
- Critical override confirmed: two separate amount columns (`סכום צפוי` / `סכום בפועל`) — overrides earlier single-column dual-line PRODUCT_DECISIONS entry
- Full `src/pages/IncomesPage.tsx` rewrite: unified pinned-section table, 6 multi-select filters, two-column amounts, MonthSelector dimming, mobile dual-section layout
- `npx tsc --noEmit` → clean (0 errors)

### What was implemented
| Feature | Status |
|---------|--------|
| Unified pinned-section table (templates top, movements bottom) | ✅ |
| 8-col shared `<thead>` (7 without attribution) | ✅ |
| Two amount columns: `סכום צפוי` + `סכום בפועל` | ✅ |
| Template rows in table (צפוי = amount/חודש, בפועל = —) | ✅ |
| Actual rows: expectedCol = `expected_amount ?? amount` | ✅ |
| 6 multi-select filters (`Set<string>`, empty=show all, AND logic) | ✅ |
| `filteredTemplates` + `filteredIncomes` via `useMemo` | ✅ |
| Section visibility booleans (showTemplateSection, monthSelectorDimmed, etc.) | ✅ |
| MonthSelector dimming wrapper (no MonthSelector.tsx changes) | ✅ |
| Summary strip unchanged (always unfiltered) | ✅ |
| Both slide panels unchanged | ✅ |
| Mobile dual-section layout | ✅ |
| "הוסף קבועה" button in top bar | ✅ |

### Pending (not blocking — browser QA)
- [ ] **Run migration**: `supabase/migrations/20260405_income_expected_amount.sql` in Supabase SQL editor (adds `expected_amount` column to `financial_movements` — required for Tier 2 to work)
- [ ] Browser verify: unified table renders, filter bar works, both panels open, summary strip correct, mobile sections correct

### Files changed this pass
- `src/pages/IncomesPage.tsx` — full rewrite
- `docs/PRODUCT_DECISIONS.md` — unified screen section + two-column override
- `handoff/SESSION_CHECKPOINT.md`, `handoff/LAST_KNOWN_GOOD_STATE.md`, `docs/MODULE_STATUS.md`, `docs/CHANGELOG.md`, `docs/skills/INCOME_MODEL_PLAYBOOK.md` — docs updated

### Next session starting instruction
"Browser-verify the unified Incomes screen. Run `npm run dev`. Check: (1) filter bar visible + chips work; (2) templates pinned at top in table; (3) two amount columns correct; (4) MonthSelector dims when קבוע-only; (5) both panels open; (6) mobile sections. Fix any runtime issues found."

---

## INCOMES UNIFIED SCREEN — PLANNING PASS COMPLETE — 2026-04-05

### What was done
- Product spec pass: 10 product direction items + 9 questions answered → unified screen spec produced
- Decision reconciliation pass: 4 contradictions resolved, all decisions now locked
- `docs/PRODUCT_DECISIONS.md` updated: Tier 2 drawer labels marked superseded; "Unified Screen" section added with all locked decisions

### All locked decisions (summary)
| Decision | Value |
|----------|-------|
| Table architecture | Pinned-section model: templates top, movements bottom |
| Drawer primary field | "סכום צפוי" (expected) — required, large input |
| Drawer secondary field | "סכום בפועל (אופציונלי)" — optional, small |
| `amount` DB semantics | Actual if provided; expected as fallback if not |
| `expected_amount` DB semantics | Stored only when actual ≠ expected; null = no discrepancy |
| Table amount display | Single "סכום" column, dual-line when discrepancy exists |
| Filter architecture | All multi-select; AND composition; client-side |
| "סוג שורה" | Multi-select: "חד-פעמי" + "קבוע"; neither = show all |
| "סטטוס" | Multi-select: "פעיל" + "לא פעיל"; templates only |
| Summary strip | Option B: always unfiltered month/account totals |
| Month navigation | Open-ended; controls movements only; dimmed in קבוע-only mode |

### Pending before implementation pass
- [ ] User must run `supabase/migrations/20260405_income_expected_amount.sql` in Supabase SQL editor (required for Tier 2 API calls to work — `expected_amount` column still missing)
- [ ] Technical planning pass (file-level task breakdown for unified screen implementation)
- [ ] Implementation pass (`IncomesPage.tsx` major refactor)

### Files changed this pass
- `docs/PRODUCT_DECISIONS.md` — Tier 2 superseded + unified screen section added

### Next session starting instruction
"Start the technical planning pass for the Incomes unified screen. Read `docs/PRODUCT_DECISIONS.md` (Unified Screen section) and current `src/pages/IncomesPage.tsx`. Produce a task-level implementation plan: what changes in IncomesPage.tsx, in what order, with verification steps. Do not write code yet."

---

## INCOMES STAGE 3 — COMPLETE — 2026-04-05

### Context
Stage 3 = `recurring_incomes` templates table + CRUD in IncomesPage + summary strip baseline card.
All app code implemented and verified. Migration file exists — user must run it in Supabase SQL editor.

### Implementation completed
| Item | Status |
|------|--------|
| Architecture decision (Option B — new `recurring_incomes` table) | ✅ Done |
| All 8 product decisions locked | ✅ Done |
| `docs/PRODUCT_DECISIONS.md` — Stage 3 locked decisions section added | ✅ Done |
| `docs/skills/INCOME_MODEL_PLAYBOOK.md` — full Stage 3 spec | ✅ Done |
| `supabase/migrations/20260405_recurring_incomes.sql` — CREATE TABLE + RLS | ✅ Created |
| User must run migration in Supabase SQL editor | ✅ Confirmed (2026-04-05) |
| `src/pages/IncomesPage.tsx` — ALL Stage 3 code changes | ✅ Complete |
| `docs/DATA_MODEL.md` — add `recurring_incomes` table definition | ⚠️ Still pending (low urgency) |
| `npx tsc --noEmit` | ✅ Clean |

### Stage 3 implementation scope (exact)
1. [DB] Create `recurring_incomes` table with exact schema from INCOME_MODEL_PLAYBOOK.md
2. [DB] RLS policy: account-scoped read/write
3. [logic] `RecurringIncome` interface + select string in IncomesPage
4. [logic] `fetchRecurringIncomes` — NOT month-scoped, fires on accountId change only
5. [logic] `recurringIncomes`, `recurringLoading`, `recurringError`, `recurringIsSaving`, `deactivatingId` state
6. [logic] `showRecurringPanel`, `editingTemplate` panel state
7. [logic] `rtDescription`, `rtIncomeType`, `rtAmount`, `rtExpectedDay`, `rtPayment`, `rtSourceId`, `rtAttrType`, `rtAttrMemberId`, `rtNotes` form state
8. [logic] `resetRecurringForm`, `handleEditTemplate` helpers
9. [logic] `handleSaveTemplate` — insert + update paths, `.select().single()` return
10. [logic] `handleToggleActive(id, is_active)` — deactivate/reactivate, no form needed
11. [UI] "הכנסות קבועות" section below movements table
12. [UI] Active template cards (type badge, description, amount, day hint, deposit chip, attribution chip, actions)
13. [UI] Inactive template cards (muted, reactivate button)
14. [UI] Empty state (no templates) — "הוסף הכנסה קבועה ראשונה" CTA
15. [UI] Slide panel (slideInRight, same style as existing income panel)
16. [UI] Drawer: 7 fields in order — see INCOME_MODEL_PLAYBOOK.md
17. [UI] Summary strip: `hasActiveTemplates` guard + "בסיס הכנסה קבועה" card

### Stage 4 deferred (do not start in Stage 3 session)
- `recurring_income_confirmations` table
- Monthly "האם הגיעה ההכנסה?" confirmation flow
- `recurring_income_id` FK on `financial_movements`
- Auto-generation of movements from templates
- Weekly / yearly frequencies

### Files that will change in implementation
- `src/pages/IncomesPage.tsx`
- `supabase/migrations/YYYYMMDD_recurring_incomes.sql` (new)
- `docs/DATA_MODEL.md`
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` (mark Stage 3 as complete)
- `docs/MODULE_STATUS.md`
- `docs/CHANGELOG.md`
- `handoff/LAST_KNOWN_GOOD_STATE.md`
- `handoff/SESSION_CHECKPOINT.md`

### Files that must NOT change
- `src/components/expenses/FixedExpensesTab.tsx` — CLOSED
- `src/pages/DashboardPage.tsx` — no changes in Stage 3
- Any other file

### Required execution order for next session

**Step 1 — Remaining doc updates (before code)**
- Update `docs/skills/INCOME_MODEL_PLAYBOOK.md`: mark Tier 2 as in-progress, add expected_amount semantics
- `docs/PRODUCT_DECISIONS.md` and `docs/DATA_MODEL.md` are already updated — do NOT re-edit

**Step 2 — Create migration file**
Write `supabase/migrations/20260405_income_expected_amount.sql`:
```sql
-- Migration: add expected_amount to financial_movements for Incomes Tier 2
-- Date: 2026-04-05
-- Risk: low — nullable column, no impact on existing rows
ALTER TABLE public.financial_movements
  ADD COLUMN expected_amount numeric NULL;
-- Verify:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'financial_movements' AND column_name = 'expected_amount';
```
Note: user must run this in Supabase SQL editor. Cannot be auto-verified from CLI.

**Step 3 — IncomesPage.tsx code changes (all in one pass)**
Changes needed (use Edit tool, targeted):
1. Extend `IncomeMovement` interface: add `expected_amount: number | null`
2. Add helper constant: `const parseExpectedAmount = (v: string): number | null => { const n = parseFloat(v); return n > 0 ? n : null; };`
3. Extend select string: add `expected_amount` to all three `.select()` calls (fetch, insert return, update return)
4. Add form state: `const [txExpectedAmount, setTxExpectedAmount] = useState('');`
5. Update `resetForm()`: add `setTxExpectedAmount('')`
6. Update `handleEdit()`: add `setTxExpectedAmount(income.expected_amount != null ? String(income.expected_amount) : '')`
7. Update insert payload: add `expected_amount: parseExpectedAmount(txExpectedAmount)`
8. Update update payload: add `expected_amount: parseExpectedAmount(txExpectedAmount)`
9. Drawer: rename label "סכום" → "סכום בפועל"; add new optional field "סכום צפוי (אופציונלי)" below it (smaller, text-base not text-2xl)
10. Table amount cell: add conditional secondary text `{income.expected_amount !== null && income.expected_amount !== income.amount && (<p ...>צפוי: {formatCurrency(income.expected_amount)}</p>)}`
11. Mobile card amount: same conditional secondary text
12. Computed section: add `const hasAnyExpected = incomes.some(i => i.expected_amount !== null);` and `const totalExpected = incomes.reduce((s, m) => s + (m.expected_amount ?? 0), 0);`
13. Summary strip: change grid to `grid-cols-2` or `grid-cols-3` based on `hasAnyExpected`; add conditional third card showing `צפוי ₪X | התקבל ₪Y`

**Step 4 — Verification**
- `npx tsc --noEmit` → must be clean
- Verify: null expected renders safely; blank saves as null; variance shows only when different

**Step 5 — Closeout docs**
- `docs/CHANGELOG.md` — add Tier 2 entry
- `handoff/LAST_KNOWN_GOOD_STATE.md` — add/update Incomes entry
- `docs/MODULE_STATUS.md` — update Incomes to Tier 2 complete
- `handoff/SESSION_CHECKPOINT.md` — mark Tier 2 complete

### Locked Tier 2 decisions (already in PRODUCT_DECISIONS.md)
- `expected_amount = null` → show only actual amount (no change to display)
- `expected_amount = amount` → show only actual amount (no extra indicator)
- `expected_amount ≠ amount AND ≠ null` → show secondary muted "צפוי: ₪X" below actual
- Blank or 0 input → saved as null
- Dashboard: zero changes required
- No `status = 'planned'` rows in Tier 2

### Next session starting instruction
"Continue Incomes Tier 2 implementation. PRODUCT_DECISIONS.md and DATA_MODEL.md are already updated. Start from Step 1 (INCOME_MODEL_PLAYBOOK update), then create the migration file, then implement all IncomesPage.tsx changes per the SESSION_CHECKPOINT execution order. Follow SAFE_IMPLEMENTATION. Run tsc after code changes. Close out with the 5 mandatory docs after verification."

---

## INCOMES TIER 1 — VERIFIED AND CLOSED — 2026-04-05

### Closeout verification (static analysis — no runtime browser available)

**All items passed:**
- Interface, select string, insert/update payloads, resetForm, handleEdit: all include new fields ✅
- `showAttribution = isCouple || isFamily`: attribution col + picker hidden for personal ✅
- AttrChip: null-safe for null type, null memberId, missing member ✅
- Type badge: conditional `{income.sub_category && ...}` — legacy nulls render safely ✅
- Deposit field: `depositSources` = bank only; `DEPOSIT_FALLBACK_PM` = transfer+cash only ✅
- UTC fix: `Date.UTC(y, m, 1)` / `Date.UTC(y, m+1, 0)` ✅
- account_id filter present ✅
- colSpan total row: `showAttribution ? 4 : 3` — correct column count for both account types ✅
- slideInRight animation: keyframe + style applied ✅
- Loading / empty / error states all present ✅
- Cross-module: Dashboard reads amount+type only → unaffected ✅
- `npx tsc --noEmit` → clean (strict: true, noUnusedLocals: true, verified) ✅

**No code fixes required.** Tier 1 passed code audit without modification.

**Accepted limitations documented:**
1. Legacy income rows with non-bank payment_source_id: edit picker won't highlight, save persists old value
2. `s.is_active` check redundant (AccountContext pre-filters); harmless

**Module status:** `✅ CLOSED — Tier 1 (2026-04-05)`

### Next step
Incomes Tier 2 — expected income:
1. Planning pass: confirm `expected_amount` column absent on `financial_movements`
2. DB_CHANGE_PLAYBOOK path: ALTER TABLE migration → implementation
3. UI: expected vs actual in summary strip and table

---

## INCOMES TIER 1 — COMPLETE — 2026-04-05

### What changed
- `src/pages/IncomesPage.tsx` — single file, no DB migrations, no other files touched
- Income type: 7-type picker using `sub_category` (משכורת/עצמאי/מתנה/שכירות/מילואים/בונוס/אחר)
- Attribution: wired for couple/family; real member names from AccountContext
- Deposit field: "הופקד לחשבון" — bank sources only; transfer/cash fallback
- Table: type badge + notes in description cell; attribution column (conditional); renamed deposit column; total row colSpan adjusted for attribution
- Mobile cards: type badge + notes secondary text + attribution chip
- Drawer: type picker first, logical field order, attribution picker, slideInRight animation
- UTC timezone fix + account_id defensive filter

### TypeScript
- `npx tsc --noEmit` → clean (no output)

### Docs updated
- `docs/skills/INCOME_MODEL_PLAYBOOK.md` — Tier 1 complete, Tier 2/3 boundaries documented
- `docs/PRODUCT_DECISIONS.md` — Tier 1 income decisions locked
- `docs/MODULE_STATUS.md` — Incomes updated to "Tier 1 complete"
- `docs/CHANGELOG.md` — entry added

### Known limitations (accepted, Tier 2+)
- No expected vs actual (requires DB migration)
- No recurring income (requires new table)
- No income analytics

### Next step
Incomes Tier 2 — expected income:
1. Planning pass: confirm `expected_amount` column does not yet exist on `financial_movements`
2. DB_CHANGE_PLAYBOOK path: ALTER TABLE migration first, then implement
3. UI: expected vs actual in summary strip and table

---

## WORKING ENVIRONMENT — FORMALLY CLOSED — 2026-04-04

The N.Money Claude Code working environment is formally closed out. Do not iterate further on the environment system. Return to product work.

### What is now in place and expected by default

The following are no longer "new features" — they are the standard operating mode for every session:

1. **WORKFLOW_ORCHESTRATION** is the first step of any non-trivial task — read it, identify the pass type, then proceed. This is not optional.
2. **SAFE_IMPLEMENTATION** governs every code change. Stall detection is mandatory. 3-gate verification runs before any completion declaration.
3. **DEBUGGING_ESCALATION** is self-invoked the moment a fix attempt fails or behavior is unexpected. Do not wait to be asked.
4. **CLOSEOUT_PLAYBOOK** and its 5 mandatory docs run at the end of every module that reaches CLOSED status.
5. **AskUserQuestion** is the correct tool for blocked product decisions and unverifiable DB/RLS state. Do not guess.
6. **Module playbooks** are pre-reads before any module work — not optional reading material.

### What remains as first-use proof points only (not open gaps)

- **LSP** — wired in SAFE_IMPLEMENTATION and CLAUDE_TOKEN_EFFICIENCY; first real invocation expected during Incomes attribution work
- **TaskCreate / TaskUpdate** — wired in CLAUDE_TOKEN_EFFICIENCY for >5-step passes; first real invocation expected during a multi-step Incomes or Goals pass
- **`gsd-integration-checker`** — wired in CLOSEOUT_PLAYBOOK for Loans→Dashboard and Assets→Dashboard; first real invocation at Loans or Assets closeout
- **`gsd-debugger`** — wired in DEBUGGING_ESCALATION Investigation Pass; first real invocation at first genuinely stuck debugging pass

These are not environment gaps. They are capabilities that require a real use case to prove. If any proves unworkable, update the relevant skill at that time.

### Next session should begin

Product work — Incomes module.

**Recommended pass sequence (per WORKFLOW_ORCHESTRATION):**
```
Audit pass   → read IncomesPage.tsx, run MODULE_AUDIT checklist, read INCOME_MODEL_PLAYBOOK
Planning     → confirm which stage (1, 2, or 3); confirm Stage 2 DB columns exist (grep attributed_to)
Implementation → SAFE_IMPLEMENTATION; Stage 1 has zero DB change; Stage 2 requires DB column confirmation
Verification → 3-gate; REGRESSION_PASS; verify IncomesPage + Dashboard still correct
Closeout     → CLOSEOUT_PLAYBOOK; update MODULE_STATUS, PRODUCT_DECISIONS, LAST_KNOWN_GOOD_STATE, SESSION_CHECKPOINT, CHANGELOG
```

**Open blocker before Stage 2:** Confirm `attributed_to_type` and `attributed_to_member_id` exist on `financial_movements` for income rows. `grep "attributed_to" src/pages/IncomesPage.tsx` — if not in the select string, verify with Supabase table editor before writing any Stage 2 code.

---

## ENVIRONMENT HARDENING PASS — COMPLETE — 2026-04-04

### What was hardened
- RECURRING_EXPENSES_PLAYBOOK: fixed stale FixedExpensesPage → FixedExpensesTab.tsx references
- UX_POLISH_PASS: added to CLAUDE.md routing as situational entry
- PRODUCT_DECISIONS.md: added superseded notes to 2 Transactions-era sections
- DATA_MODEL.md: synced `payment_sources.type` (added transfer) + `recurring_expenses` (added 3 columns from 2026-04-03 migration)

### Environment status after hardening
- All skills current and internally consistent
- All docs cross-references accurate
- DATA_MODEL.md synced with known applied migrations
- Routing discoverability complete
- Autonomy/self-correction layer embedded and tested-in-theory
- Ready for final environment closeout pass

---

## WORKING ENVIRONMENT VALIDATION PASS — COMPLETE — 2026-04-04

### Context
Following a full working-environment build-out session (2026-04-04), all major workflow/skills layers have been completed. The next session must run a validation pass to confirm every new layer is internally consistent, correctly integrated, and actually usable before starting any product implementation work.

### Environment layers completed this session (all docs-only, no code changes)

**Skills updated (existing):**
1. `SETTINGS_PLAYBOOK.md` — 9-tab architecture, locked rules, billing model
2. `DB_CHANGE_PLAYBOOK.md` — removed dead template ref, added Path B (new table + RLS)
3. `TAXONOMY_CHANGE.md` — TransactionsPage → VariableExpensesTab
4. `PAYMENT_SOURCE_CHANGE.md` — call sites verified, current source types, updated page refs
5. `DASHBOARD_ANALYTICS_PLAYBOOK.md` — net worth data path, health score warning, integration surface rule
6. `INCOME_MODEL_PLAYBOOK.md` — Stage 2 stale ref fixed (TransactionsPage → VariableExpensesTab)
7. `CLAUDE_TOKEN_EFFICIENCY.md` — LSP-vs-Grep rule, TaskCreate usage rule
8. `SAFE_IMPLEMENTATION.md` — stall detection, escalation trigger, 3-gate verification, LSP trigger, AskUserQuestion trigger

**Skills created (new):**
9. `LOANS_PLAYBOOK.md` — amortization, dual display mode, balance drift, cross-module
10. `ASSETS_PLAYBOOK.md` — point-in-time valuation, filter independence, net worth dependency
11. `GOALS_PLAYBOOK.md` — mock inventory, decision gates, implementation plan
12. `CLOSEOUT_PLAYBOOK.md` — 6 status levels, 7-step workflow, 5 mandatory docs, accepted limitation examples
13. `DEBUGGING_ESCALATION.md` — 3 escalation states, stall detection, hypothesis protocol, N.Money bug pattern table, stop/report format
14. `WORKFLOW_ORCHESTRATION.md` — routing layer for 6 pass types (Audit/Planning/Implementation/Debugging/Verification/Closeout)
15. `CLOSEOUT_PLAYBOOK.md` updated — gsd-integration-checker trigger for cross-module modules

**Other docs fixed:**
- `docs/QA_CHECKLISTS.md` — Transactions → Expenses (Variable + Fixed tabs); AppLayout FAB corrected; Acceptable Weaknesses updated

### What the next pass must validate

The validation pass is NOT implementation. It is a consistency + usability audit of the new skills layer.

**Validate in this order:**

1. **Internal consistency** — do any two skills contradict each other? Specifically check:
   - SAFE_IMPLEMENTATION ↔ DEBUGGING_ESCALATION (do stall triggers align?)
   - CLOSEOUT_PLAYBOOK ↔ WORKFLOW_ORCHESTRATION (do closeout paths match?)
   - REGRESSION_PASS ↔ the 3-gate verification model in SAFE_IMPLEMENTATION (do they mesh, or is there overlap/gap?)

2. **Reference integrity** — do all skill cross-references point to real, current files?
   - DEBUGGING_ESCALATION references `superpowers:systematic-debugging`, `gsd-debugger`, LSP, TaskCreate — all verified available
   - WORKFLOW_ORCHESTRATION references `docs/templates/AUDIT_TEMPLATE.md`, `docs/templates/QA_REPORT_TEMPLATE.md` — confirm these exist and are usable
   - GOALS_PLAYBOOK references `docs/PRODUCT_DECISIONS.md` decisions — confirm they are still accurate post-session

3. **Routing completeness** — does WORKFLOW_ORCHESTRATION cover all task types a real N.Money session would encounter? Look for missing pass types or ambiguous entry conditions.

4. **CLAUDE.md alignment** — does CLAUDE.md still route correctly to the current skills? Skills list in CLAUDE.md may not include new skills. Check whether WORKFLOW_ORCHESTRATION, DEBUGGING_ESCALATION, CLOSEOUT_PLAYBOOK, LOANS_PLAYBOOK, ASSETS_PLAYBOOK, GOALS_PLAYBOOK should be added to the CLAUDE.md "Skills to invoke" list.

5. **QA_CHECKLISTS usability** — read the updated QA_CHECKLISTS.md as if running a real QA pass. Are the Expenses (Variable + Fixed) sections complete enough? Are any critical checks still missing?

### Constraints for the validation pass

- **Read-only audit first** — identify issues before fixing any
- **Do not start product implementation** — this pass is environment-only
- **Do not rewrite skills** — targeted fixes only; if a skill needs more than 5 lines changed, flag it for a separate dedicated pass
- **Do not add new skills** — only validate and fix what exists
- **Preserve token efficiency** — audit each skill with targeted reads, not full re-reads of everything

### Known quick-fix candidates already suspected

1. **CLAUDE.md "Skills to invoke" section** — likely needs the new skills added (WORKFLOW_ORCHESTRATION, DEBUGGING_ESCALATION, CLOSEOUT_PLAYBOOK, module playbooks). Estimated: small targeted Edit.
2. **REGRESSION_PASS.md** — may have a gap or overlap with the new 3-gate verification model in SAFE_IMPLEMENTATION. Needs a quick read to confirm they mesh correctly.
3. **`docs/templates/`** — WORKFLOW_ORCHESTRATION and CLOSEOUT_PLAYBOOK reference these templates. Need to confirm AUDIT_TEMPLATE, QA_REPORT_TEMPLATE, IMPLEMENTATION_REPORT_TEMPLATE are actually usable as-is or need minor updates.
4. **SESSION_CHECKPOINT reference to skills pass** — the section below this one marks "skills 2–5 completed" but may be confusing alongside this new checkpoint entry. Low priority.

### Next session start instructions

1. Read this checkpoint
2. Read `docs/MASTER_CONTEXT.md` and `docs/MODULE_STATUS.md` (standard)
3. Read CLAUDE.md to check skills routing section
4. Run the validation pass in the order listed above
5. Apply quick fixes found
6. Update this checkpoint when validation is complete
7. Only then move to the next product implementation phase (Incomes is next in queue)

---

## SKILLS MAINTENANCE PASS — IN PROGRESS — 2026-04-04

### Context
Skills audit + maintenance pass following Budget module closeout.
Previous audit identified 5 skills needing update and 4 new skills to add (new skills deferred to next pass).

### Already completed this session

**1. `docs/skills/SETTINGS_PLAYBOOK.md` — ✅ UPDATED**
- Was: stale 7-section architecture, incomplete DB-backed tab inventory
- Now: reflects final 9-tab architecture, each tab has persistence type + status, billing rules, downgrade guard, payment source current types (credit/bank/transfer/bit/paybox/cash)
- Key additions: "Settings is CLOSED" header, account type change locked to handleSavePlan, no client writes to account_subscriptions

---

### Still to complete (4 skills remaining)

**2. `docs/skills/DB_CHANGE_PLAYBOOK.md` — NOT YET UPDATED**

Current problem: dead reference to `docs/templates/SQL_CHANGE_TEMPLATE.md` (file doesn't exist). Not strong enough for creating a brand-new table (needed for Goals).

Required updates:
- Remove dead SQL template reference
- Add "New table creation" section (not just ADD COLUMN)
- Include: RLS policy template, TypeScript interface creation, select string, empty/loading/error state requirements
- Add docs sync step (DATA_MODEL.md + MODULE_STATUS.md)
- Keep existing ADD COLUMN flow, just strengthen it

Constraints:
- Goals will need a brand-new `goals` table — this playbook must cover that scenario
- Always nullable for new columns on existing tables (existing rule — keep)
- Never NOT NULL without DEFAULT on existing tables (existing rule — keep)

---

**3. `docs/skills/TAXONOMY_CHANGE.md` — NOT YET UPDATED**

Current problem: references TransactionsPage as an active page (now a redirect stub).

Required updates:
- Replace "TransactionsPage" with "VariableExpensesTab (`src/components/expenses/VariableExpensesTab.tsx`)"
- Replace "TransactionsPage category grid" with "ExpensesPage variable tab category picker"
- All other safety rules (never rename IDs with DB data, CATEGORY_ALIASES, chartColor warning) are correct — keep them

Constraints:
- Do not change the safety rules — they are correct
- The only changes are the stale page references
- FixedExpensesPage reference: replace with "FixedExpensesTab (`src/components/expenses/FixedExpensesTab.tsx`)"

---

**4. `docs/skills/PAYMENT_SOURCE_CHANGE.md` — NOT YET UPDATED**

Current problem: "Pages That Use Payment Sources" section lists TransactionsPage — now a redirect stub.

Required updates:
- Replace "TransactionsPage: form chips + row display" with "VariableExpensesTab: form chips + row display"
- Replace "FixedExpensesPage: form chips" with "FixedExpensesTab (`src/components/expenses/FixedExpensesTab.tsx`): form chips"
- `resolvePaymentDisplay()` call sites: update list to reflect current real consumers
- All other content (adding/removing source types, SOURCE_TYPE_ALIASES, DB change flow) is correct — keep

Constraints:
- resolvePaymentDisplay is called in: VariableExpensesTab, IncomesPage, ExpenseAnalysisPage, FixedExpensesTab, DashboardPage, SettingsPage — verify and list these correctly
- Do not change the core technical rules — only fix the stale page references

---

**5. `docs/skills/DASHBOARD_ANALYTICS_PLAYBOOK.md` — NOT YET UPDATED**

Current problem: data dependency map is incomplete — does not document assets/loans/net worth data path. Health score sub-formula warning exists but is incomplete.

Required updates:
- Expand "Dashboard Data Dependencies" to include:
  - `assets` → net worth KPI (totalAssets)
  - `loans` → net worth KPI (totalLiabilities = sum of `balance` on active loans)
  - Net worth = totalAssets - totalLiabilities
  - All fetched in the same Promise.all — do not add separate useEffect
- Add explicit warning: health score has 4 sub-scores × 25pts. Only savings rate formula is confirmed. Other 3 (spending control, budget adherence, financial diversity) need product owner confirmation before any change — do not touch without confirmation
- Add note: Dashboard is the integration surface for all other modules — any module that adds new data (Goals, etc.) must document how it surfaces in Dashboard before implementation

Constraints:
- ExpenseAnalysis filter chain rules are correct — keep
- Do not weaken existing rules — only add the missing data dependency section and health score warning
- Keep the "Adding a New Dashboard Widget" steps

---

### Status: ✅ ALL 5 SKILLS COMPLETED (2026-04-04)

Skills 2–5 updated in the follow-up session. All rewritten in full.

**Next:** New skills pass — LOANS_PLAYBOOK, ASSETS_PLAYBOOK, GOALS_PLAYBOOK, CLOSEOUT_PLAYBOOK

---

## BUDGET MODULE QA + CLOSEOUT — 2026-04-04

**3 bugs found and fixed:**

1. **`toMonthEnd` timezone bug (data correctness):** `new Date(y, m+1, 0).toISOString()` gives the previous day in UTC for Israel (UTC+2/+3). Last day of every month excluded from budget actuals. Fixed to `Date.UTC(getUTCFullYear, getUTCMonth+1, 0)`.
2. **`priorStartStr` timezone bug:** Same pattern — prior month comparison missed the 1st of that month. Fixed with `Date.UTC`.
3. **`budgets.sort()` state mutation:** `donutData` computation mutated React state in place. Fixed with `[...budgets].sort()`.

**No false positives:** Rolling 3/6/12 period in fetchTrends is correct for Israel (operates on existing UTC-parsed Date objects, not new LOCAL Date construction). YTD string-based construction is correct.

**tsc:** clean ✅

---

## BUDGET TRENDS: YTD PERIOD OPTION — 2026-04-04

**What changed:** Added "מתחילת השנה" as a fourth option in the Budget Trends period selector.

**Logic:** `fetchTrends('ytd')` builds a months array from January 1 of the year containing `monthStart` through `monthStart` inclusive. Dynamic length: January = 1 month, April = 4 months, December = 12 months. Distinct from "12 חודשים" (rolling window).

**File changed:** `src/pages/BudgetPage.tsx`
- `trendPeriod` type: `3 | 6 | 12 | 'ytd'`
- `fetchTrends` parameter: `3 | 6 | 12 | 'ytd'`
- YTD branch added before existing rolling-window loop
- New pill button in selector UI, same style, `flex-wrap` on container

**tsc:** clean ✅

**Decision locked (PRODUCT_DECISIONS.md):** YTD ≠ rolling 12 months. Do not conflate.

---

## BUDGET V2: HERO NEW LAYOUT — 2026-04-04 (pass 14)

**Decision locked:** Abandoned equal-thirds. New macro: `1fr 2fr 1fr`.

**Why:** Equal thirds = ~101px per column on mobile. Donut had 0px SVG margin (clips), legend 2-col was unreadable (~4 chars per cell), ring was too thin for a premium hero. No resolution within that constraint.

**What changed:**
- Grid: `grid-cols-3` → `gridTemplateColumns: '1fr 2fr 1fr'`
- Donut: 100×100 → **148×148** (`cx=74 cy=74 innerRadius=44 outerRadius=69`). 5px SVG margin, 25px ring width. Visually complete and correctly proportioned.
- KPI: `text-lg` → `text-sm` (fits 1fr column); layout/spacing preserved
- Legend: single-column → **2-column** `grid-cols-2 gap-x-1 gap-y-1.5`; dots `w-1.5 h-1.5`; `text-[9px]`; all categories visible; no +N overflow
- Goals whisper: unchanged
- Hover tooltip: preserved (colored pill, name + %)
- Click-to-select donut: preserved

**tsc:** clean ✅

---

## BUDGET V2: HERO RECONCILE — 2026-04-04 (pass 13)

Reconciled actual file state with pass 12 checkpoint spec. Three deltas found and fixed:

1. **Donut canvas:** `height={180} cy={90}` → `height={100} cy={50}` — portrait SVG was creating ~90px dead space below the ring. Now square 100×100.
2. **Donut radii:** `innerRadius={32} outerRadius={48}` → `innerRadius={27} outerRadius={43}` — restores 7px SVG margin so ring does not clip at edges.
3. **KPI values:** `text-xl` → `text-lg` — matches pass 12 spec.

Center text overlay (`absolute inset-0 justify-center`) correctly centers at (50,50) matching new `cy={50}`.

**tsc:** clean ✅

---

## BUDGET V2: FINAL POLISH + TRENDS + CLEANUP — 2026-04-04 (pass 12)

### Hero
- KPI: text-lg values, text-[11px] labels, py-5 gap-5
- Donut: outerRadius=43 (7px SVG margin), innerRadius=27
- Legend: legendData (semantic sort via CATEGORY_GROUP_ORDER), text-[11px], gap-y-2

### Removed from monthly tab
- "חלוקה לפי קטגוריות" allocation card
- "תקציב מול ביצוע" bar chart card

### Trends improvements
- Heat table: ALL categories (removed slice(0,5)), average "ממוצע" column added
- New line chart: "מגמת תקציב מול ביצוע" — LineChart, budget + actual lines, below heat table

**tsc:** clean ✅

---

## BUDGET V2: FINAL POLISH + NEW SECTIONS — 2026-04-04 (pass 11)

### Hero
- Donut: 100px (`cx=50 cy=50 inner=32 outer=47`), 3px SVG margin — no clip
- Legend: 2-col grid (`grid-cols-2 gap-x-1.5 gap-y-1.5`), `text-[10px] w-2 h-2`, ALL categories

### New: "חלוקה לפי קטגוריות" card
- ALL budgeted categories with: color dot, name, utilization %, actual/budget, progress bar
- Placed after insights strip, before category cards

### New: "תקציב מול ביצוע" chart card
- Grouped BarChart: budget (gray) + actual (category color, red if overrun)
- Top 8 categories (sorted by overrun-first via sortedCategories)
- Custom Tooltip: full name + budget + actual

**tsc:** clean ✅

---

## BUDGET V2: HERO POLISH + REFRESH ROOT-CAUSE FIX — 2026-04-04 (pass 10)

### Hero polish
- KPI: text-xs labels, text-base bold values, py-4 gap-4 breathing room
- Donut: 96px (cx=48 cy=48 inner=30 outer=45), 3px SVG margin → no clipping
- Legend: ALL donutData categories shown (no slice), text-xs, w-2.5 h-2.5 dots, py-4 gap-1.5

### Refresh root-cause fixed
Previous dep-array fix stopped infinite loops but NOT the visual refresh.
Root cause: `setLoading(true)` ran after cache path → cached data shown → spinner shown → data reloads.
Fix: `showedCache` flag — `setLoading(true)` only when no cache. Background refresh is now silent.

**tsc:** clean ✅

---

## BUDGET V2: HERO FINAL + REFRESH FIX — 2026-04-04 (pass 9)

### Hero
`grid grid-cols-3` one row:
- Col 1 (RIGHT): vertical KPI stack: תקציב / שימוש בפועל / יתרה (label above, value below each)
- Col 2 (CENTER): donut 90px, `cx=45 cy=45 inner=28 outer=43`, center label, Tooltip hover
- Col 3 (LEFT): guide top-5 + "+N" overflow, text-[10px], w-2 h-2 dots, no amounts

### Refresh bug fixed
`currentMonth` (Date object) removed from `fetchData` useCallback deps.
New deps: `[user, accountId, monthStart]` — all stable.
`toMonthEnd` and `getPriorMonthStart` now called with `new Date(monthStart)` inside callback.

**tsc:** clean ✅

---

## BUDGET V2: HERO CORRECT COMPOSITION — 2026-04-04 (pass 8)

**Correction:** grid-cols-3 had יתרה KPI stacked above the donut inside the left cell. This is rejected. 

**New structure:** `flex gap-3 items-stretch` — pure two-block layout:
- RIGHT block (flex-1): ONLY the 3 KPI values in a `bg-gray-50 rounded-xl justify-center` panel. No donut here.
- LEFT block (w-[155px]): ONLY the donut (110px) + guide. No KPI here.

Both blocks fill the same height (driven by donut side via `items-stretch`). Divider spans full height. KPI values appear centered within the gray panel. Donut starts at the top of its block.

Guide: top-4 + explicit "+N more" overflow indicator.
Hover: Recharts Tooltip, colored pill.
tsc: clean ✅

---

## BUDGET V2: HERO THIRDS RESTORATION — 2026-04-04 (pass 7)

**Regression fixed:** Two-zone stacked layout (KPI row on top, donut below) replaced. Donut is NOW in the same `grid-cols-3` row as all 3 KPI values.

**Structure:** `grid grid-cols-3` — one grid row:
- Cell 1 (RIGHT): תקציב, text-base font-bold
- Cell 2 (CENTER): בפועל, text-base font-bold + border-r border-l separators
- Cell 3 (LEFT): יתרה KPI + border-t separator + donut 96px + ALL categories guide

Cell 3 drives row height. Cells 1+2 stretch by default (grid stretch). All 3 KPI values at same pt-3 top = horizontal unit.

Guide: `donutData.map(...)` — no slice limit — shows ALL budgeted categories.
Hover: Recharts Tooltip showing `CategoryName: X%` preserved.

**tsc:** clean ✅

---

## BUDGET V2: HERO FULL REBUILD — 2026-04-04 (pass 6)

**Root cause of all previous failures:** Side-by-side KPI strip + large donut on 318px mobile is physically impossible. One side is always too small or too narrow.

**Solution:** Two-zone hero within one card surface.
- Zone 1: full-width KPI strip on bg-gray-50, text-xl font-bold values, border-b separator
- Zone 2: Guide (flex-1, text-sm, right in RTL) + Donut (150px, left in RTL)
- overflow-hidden on card for clean rounded corners on bg-gray-50 zone

**Key sizing:**
- KPI cells: 106px each (318px ÷ 3) — text-xl values fit comfortably
- Donut: 150×150, inner=46 outer=70, 24px ring width
- Guide: text-sm, w-3 h-3 dots, space-y-2.5 — clearly readable
- Hover: Recharts Tooltip shows category name + % of total

**tsc:** clean ✅

---

## BUDGET V2: HERO VISUAL ENFORCEMENT — 2026-04-04 (pass 5)

**Session type:** Visual enforcement. tsc clean.

### Diagnosis of rendered failure
- Donut was 88px — invisible as a hero element at 100% zoom
- Guide was `text-[9px]` in a 2×2 grid — microscopic, unreadable
- KPI `text-sm font-semibold` in a flat strip — too weak for a hero surface

### Changes
- Grid: `1.5fr/1px/1fr` (KPI 60%, donut 40%)
- KPI: `bg-gray-50 rounded-xl` contained panel, `text-base font-bold`, `text-xs` labels
- Donut: 120px, `inner=37 outer=57`
- Guide: single column, `text-xs`, `w-2.5 h-2.5` dots — readable
- Hover tooltip: Recharts `<Tooltip>` shows `Category: X%` on segment hover, colored pill
- tsc clean ✅

---

## BUDGET V2: HERO ROOT-CAUSE FIX — 2026-04-04 (pass 4)

**Root cause:** `items-center` on the outer flex caused the 44px KPI strip to float in the vertical center of the 165px donut column. 60px dead space above and below KPI = disconnected, floating appearance.

**Fix:**
- `items-center` → `items-start` (both blocks top-aligned)
- Guide moved from BELOW donut (vertical stack, 165px tall) to BESIDE donut (horizontal, 88px tall)
- Donut: 120px → 88px (`cx=44 cy=44`, `inner=27 outer=41`)
- Donut container: `w-[140px] flex items-center gap-2` (inner horizontal composition)
- Guide: `flex-1 flex-col gap-1.5` beside donut, no amounts

**Height match after fix:** KPI 44px, donut+guide 88px — 44px difference with `items-start` = both top-aligned, no floating.

**tsc:** clean ✅

---

## BUDGET V2: HERO SIDE-BY-SIDE — 2026-04-04 (pass 3)

**Session type:** Hero layout restructuring. No data model changes. tsc clean.

### Change: donut moved beside KPI (not below)
- Main row is now `flex gap-3 items-center` — KPI (flex-1, RIGHT) | divider | donut+guide (120px, LEFT).
- Donut no longer in a separate Row 2 below the KPI strip.
- KPI: `grid grid-cols-3`, cells `py-2.5 px-2`, separators on center cell.
- Donut: 110px, `cx=55 cy=55`, `innerRadius=34 outerRadius=52`.
- Guide: 2×2, color+name only, NO amounts. `text-[10px]`.
- `self-stretch` divider spans full row height.
- `items-center` centers KPI strip vertically alongside taller donut column.

### tsc
`npx tsc --noEmit` → clean ✅

### Files
- `src/pages/BudgetPage.tsx`
- `docs/CHANGELOG.md`, `docs/PRODUCT_DECISIONS.md`, `handoff/SESSION_CHECKPOINT.md`

---

## BUDGET V2: HERO FINAL COMPOSITION — 2026-04-04 (pass 2)

**Session type:** Hero structural recomposition. No data model changes. tsc clean.

### Changes applied

1. **Title fix:** Monthly tab "חודשי" → "ניתוח חודשי"

2. **KPI strip — 3-col horizontal**
   - All 3 KPIs now in `grid grid-cols-3` horizontal strip (not 2+1 stacked).
   - RTL visual order: תקציב (right) | בפועל (center, separated) | יתרה (left, font-bold colored).
   - Reading narrative: budget → actual → outcome — left-to-right reading in Hebrew context.

3. **Donut + legend — full-width row**
   - Donut promoted from constrained 140px column to a flex row with the legend beside it.
   - Donut: 110px → 130px (`cx=65 cy=65`, `innerRadius=40 outerRadius=62`). More presence.
   - Legend: 4 rows at `text-sm` — `dot (2.5px) + name (truncate) + amount`. Readable, premium. No cramped 2×2 grid.
   - RTL: donut is JSX-first (visual RIGHT), legend is JSX-second (visual LEFT). ✓

4. **Structural rhythm**
   - Row 1 → Row 2 separated by `border-t border-gray-100 mt-3 pt-4`
   - Row 2 → Row 3 (goals) separated by `border-t mt-4 pt-3`
   - Hero reads: summary → allocation → planning → grid below

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — tab title + hero full recomposition
- `docs/CHANGELOG.md` — session entry
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/PRODUCT_DECISIONS.md` — hero composition lock updated

### What's next
- Budget V2 ready for final QA
- Goals integration blocked until real Goals DB table exists

---

## BUDGET V2: HERO PRECISION REFINEMENT — 2026-04-04

**Session type:** Targeted hero polish pass only. No data model changes. tsc clean.

### Changes applied

1. **KPI panel — contained cell design**
   - Each KPI cell (תקציב חודשי / הוצאה בפועל) now wrapped in `rounded-lg bg-gray-50 px-2.5 py-2`.
   - Grid gap: `gap-4` → `gap-3`.
   - Effect: KPI block reads as a designed unit rather than loose stacked rows.

2. **Donut side — composed allocation block**
   - Container: `w-[130px]` → `w-[140px]`.
   - Entire donut + legend wrapped in `rounded-xl bg-gray-50 p-2` — panel feel, visually distinct from KPI side.
   - Donut center: was "מתוקצב + ₪{budget}" (duplicate of KPI). Now: "שנוצל + X%" (utilization %, new information).
   - Donut `cx={50} cy={50}` → `cx={55} cy={55}` — pixel-perfect centering (3px margin on all sides).
   - Legend entries: now 2-line per cell (name truncated + amount below) with `gap-y-2`. Gives real allocation context, not just a color key.

3. **Loans card**
   - `border-gray-50` → `border-gray-100` (internal divider line now visible, consistent with category cards).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — hero KPI panels + donut composition + loans card border
- `docs/CHANGELOG.md` — session entry
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/PRODUCT_DECISIONS.md` — hero layout lock updated

### What's next
- Budget V2 is ready for final QA
- Goals integration blocked until real Goals DB table exists
- Remaining audit: Assets, Loans, Goals, Calculators, Guides pages

---

## BUDGET V2: LOANS CARD + HERO FINAL POLISH — 2026-04-03

**Session type:** Targeted repair pass. Two specific issues fixed. tsc clean.

### Changes applied

1. **Loans card (Option B — synthetic card in grid)**
   - `Loan` interface has no `category` field → Option B (synthetic read-only card).
   - Removed flat info row above the grid ("🏦 תשלומי הלוואות פעילות … / חודש").
   - Added loan obligations card as first child inside the `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` wrapper.
   - Card: "מחויב" badge, "תשלום חודשי מחויב" + formatted total, "לניהול הלוואות ›" link, "ללא גבול תקציב" label. No progress bar.
   - Grid condition: `totalLoanPayments > 0 || sortedCategories.filter(c => c.budgeted > 0).length > 0`.

2. **Hero composition polish**
   - `p-4` → `p-5`, `items-start` → `items-center`, `gap-4` → `gap-3`.
   - Vertical divider added between KPI panel and donut panel.
   - `ResponsiveContainer` removed from hero donut; using `<PieChart width={110} height={110}>` directly.
   - `paddingAngle={2}`, `startAngle={90}`, `endAngle={-270}` added to Pie.
   - KPI label color `text-gray-500` → `text-gray-400`; budget/actual `text-lg` → `text-xl`.
   - Remaining: `font-semibold` → `font-bold` (most prominent number on hero).
   - Goals whisper `mt-3` → `mt-4`.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — loans card + hero polish
- `docs/CHANGELOG.md` — session entry
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/PRODUCT_DECISIONS.md` — locks updated

### What's next
- Goals: blocked until real Goals DB table is created
- Budget V2 ready for final QA

---

## BUDGET V2: HERO RESTRUCTURE + LOANS INTEGRATION — 2026-04-03

**Session type:** Targeted implementation. Two changes to BudgetPage.tsx only. tsc clean.

### Changes applied

1. **Loans integration (Fix 1)**
   - Added `const [totalLoanPayments, setTotalLoanPayments] = useState(0)` state.
   - Expanded `Promise.all` in `fetchData()` to include `supabase.from('loans').select('monthly_payment, status').eq('account_id', accountId).eq('status', 'active')`.
   - Summed `monthly_payment` for all returned active loans → `setTotalLoanPayments(loanTotal)`.
   - Rendered a conditional info row above the category grid when `totalLoanPayments > 0`: "🏦 תשלומי הלוואות פעילות … {amount} / חודש".
   - Connects to real `loans` table (same table as LoansPage.tsx). No mock data.

2. **Hero KPI + Donut restructure (Fix 2)**
   - KPI section: changed from 3 stacked divs to `grid grid-cols-2` (budget + actual) + full-width `text-2xl` remaining/overrun below `border-t`.
   - Donut legend: changed from vertical `space-y-0.5` list to `grid grid-cols-2` 2×2 layout.
   - Donut dimensions: 120→110px, radii adjusted proportionally.
   - RTL order: confirmed KPI is JSX-first (right), Donut is JSX-second (left). No swap needed.
   - Goals whisper Row 2: now wrapped in `{hasContent && ...}` guard; copy unchanged.

3. **Goals integration: no change**
   - Goals module is 100% mock data. No real DB table. CTA whisper preserved as-is.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — loans query + state + info row + hero JSX restructure
- `docs/CHANGELOG.md` — session entry
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/PRODUCT_DECISIONS.md` — hero layout + loans integration decisions recorded

### What's next
- Goals: blocked until real Goals DB table is created
- Loans info row: consider linking to /loans page for discoverability
- Budget V2 ready for final QA

---

## BUDGET TOP ZONE REALIGNMENT — 2026-04-03

**Session type:** Targeted refinement pass on Budget V2 top zone. No data model changes. tsc clean.

### Changes applied

1. **Goals vs Loans semantic fix**
   - Removed the loans placeholder row from the "תכנון חודשי" section. Loans are budget categories (confirmed monthly expenses belonging in the grid), not a planning concept.
   - Removed the entire "תכנון חודשי" card. It had two dead placeholder rows and mixed goals and loans semantics.

2. **Hero card recomposition — Option C (three-tier)**
   - Row 1: KPI stack (flex-1) + donut (flex-shrink-0) — unchanged.
   - Row 2 (new): Goals awareness whisper line below a `border-t border-gray-100` separator. Text: "🎯 יעדי חיסכון — בקרוב תוכל להקצות כאן חלק מהתקציב לטובת יעדים". Lives inside the hero card. No dead space. Feels like a real upcoming feature preview.

3. **Category sort: semantic group ordering**
   - Replaced pure utilization sort with `sortCategoriesV2()`.
   - Overrun categories still appear first (sorted by overrun desc).
   - Non-overrun: sorted by `CATEGORY_GROUP_ORDER` map (all 16 real IDs from categories.ts), then by utilization desc within the same group.
   - `getCategoryGroup()` does exact-match on category ID, fallback to group 10.

4. **Product decisions locked**
   - Goals = planning layer above budget. Loans = budget category. These must never be mixed in the same UI section.
   - `sortCategoriesV2()` locked as the canonical sort — no revert to pure utilization sort.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — top zone realignment + category sort
- `docs/CHANGELOG.md` — this pass entry
- `docs/PRODUCT_DECISIONS.md` — goals/loans semantic distinction + sort order locked
- `handoff/SESSION_CHECKPOINT.md` — this entry

---

## BUDGET V2 FULL IMPLEMENTATION — 2026-04-03

**Session type:** Full Budget V2 architecture implementation. BudgetPage.tsx fully rewritten. tsc clean.

### Changes applied

1. **Two-tab structure:** חודשי / מגמות tabs. MonthSelector conditionally shown (monthly tab only). Tab nav: `bg-gray-100 rounded-xl p-1` pill container, active = white card shadow-sm.

2. **Hero card:** KPI split (תקציב חודשי/הוצאה בפועל/יתרה|חריגה) + interactive donut chart (PieChart/Pie/Cell, chartColor from getCategoryMeta, click toggles selectedDonutCat, opacity 0.4 on non-selected, center label overlay with absolute positioning, top-4 legend below).

3. **Global insights V2:** Pill 1 = MoM comparison (prior month fetched in same Promise.all, amber if expenses rose, green if fell, neutral if equal). Pill 2 = unbudgeted count (amber/warn). Old "total remaining" pill removed.

4. **Planning section:** תכנון חודשי card with goals + loans placeholders (opacity-50), "תקציב פנוי לניצול" summary row. Shows when totalBudgeted > 0.

5. **Utilization semantics corrected:** Exactly 100% → blue + "הגעת ליעד" badge. >100% → red + "חריגה". getCategoryInsight updated with new messages for each case.

6. **Category grid:** Upgraded to `lg:grid-cols-3`. Cards get `ring-2 ring-[#1E56A0]` when selected via donut.

7. **Trends tab:** Period selector (3/6/12), Budget vs actual BarChart, category utilization heat table (top 5 by budgeted × months). Separate fetchTrends() with useEffect dependency on budgetTab + trendPeriod + accountId + monthStart.

8. **sessionStorage cache:** `nmoney_budget_data_${monthStart}` — read before fetch (instant re-display), written after fetch, busted on save/delete/inline-save.

9. **History chart removed:** showHistory, historyData, HistoryPoint, fetchHistory, HistoryTooltip all eliminated. Trends tab owns all historical data.

10. **Removed imports:** YAxis, CartesianGrid, intervalToMonthly, shortMonthNames (no longer used).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — full V2 rewrite
- `docs/CHANGELOG.md` — V2 entry
- `docs/MODULE_STATUS.md` — Budget status updated to V2
- `handoff/SESSION_CHECKPOINT.md` — this entry

---

## BUDGET FINAL POLISH PASS — 2026-04-03

**Session type:** Targeted visual/UX polish on BudgetPage.tsx. No data model changes. tsc clean.

### Changes applied

1. **Grid layout:** Category section `space-y-3` → `grid grid-cols-1 sm:grid-cols-2 gap-3`. Responsive 2-col on sm+, single column on mobile. RTL-correct (grid fills right-to-left).

2. **Utilization color system — 4-tier:** New `getUtilizationColor()` returns `{bar, badge, badgeBg}` Tailwind classes. Thresholds: 0–49% green / 50–79% amber / 80–99% orange / 100%+ red. Infinity edge case → red. Badge text, badge background, and progress bar fill all unified through this function. No more hardcoded hex in badge logic.

3. **Per-card embedded insights:** `getCategoryInsight()` — 4 conditional states (overrun amount / near-limit remaining / zero-spend / low utilization). Rendered as `text-xs text-gray-400` whisper line, only when meaningful. Silent for 31–79% normal range.

4. **Global insights strip:** Reduced from 3 pills to max 2. Removed overrun count pill (redundant with per-card state). Kept: total remaining + unbudgeted categories count. Strip hidden when neither condition is true.

5. **Visual polish:** History chart title → `text-sm font-semibold text-gray-600` + subtitle `text-xs text-gray-400`. Height → 160px. Missing-budget heading → `text-amber-800` Tailwind class. "ראה בהוצאות" → `text-xs text-[#1E56A0]`. Amounts middle value uses utilization color.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — polish pass
- `docs/CHANGELOG.md` — final polish entry
- `docs/MODULE_STATUS.md` — status updated to polished/closed
- `handoff/SESSION_CHECKPOINT.md` — this entry

---

## BUDGET REPAIR AND REALIGNMENT PASS — 2026-04-03

**Session type:** Structural repair, semantic fix, visual realignment. Full BudgetPage.tsx rewrite.

### Critical semantic fix
- **Double-counting bug eliminated:** Previous model: `actual = variable (movements) + fixed (recurring projection)`. This inflated "הוצאה בפועל" with unconfirmed recurring projections, and double-counted any recurring expense that the user also logged as a financial_movement.
- **New model:** `actual = financial_movements ONLY`. "הוצאה בפועל" now means confirmed transactions. Period. Recurring templates removed from BudgetPage data fetch entirely.
- **History chart:** Same fix — historical bars use confirmed movements only per month.

### KPI / insights
- KPI strip: 4 → 3 cards. "קטגוריות בחריגה" KPI removed (it's an insight, not a top-level KPI).
- Insights: max 5 → max 3 pills. Removed top-category pill (noise) and near-limit pill (low value). Pills redesigned as compact rounded-full pills, not card-style blocks.

### Category cards
- Fixed/variable whisper line removed.
- ✏️🗑️ emoji action buttons removed from header.
- Status badge unified (single badge, color-coded).
- Progress bar: h-2 → h-1.5.
- Navigation link: "צפה בהוצאות ›" with ?category= → "ראה בהוצאות" to /expenses (honest — param was not consumed by ExpensesPage).
- Delete now a text button in card footer.

### Copy / state
- Carry-forward banner now shows count: "הועתקו X קטגוריות תקציב מהחודש הקודם."
- Missing-budget nudge title: "קטגוריות ללא תקציב". Per-row CTA: "הגדר".
- Empty state: "הגדר את התקציב החודשי שלך" + "הוסף קטגוריה" button.

### History chart
- Collapsed by default behind a toggle button. h-140 when open. No longer the visual centerpiece.

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — full rewrite
- `docs/MODULE_STATUS.md` — semantic change noted, limitations updated
- `docs/CHANGELOG.md` — entry added
- `handoff/SESSION_CHECKPOINT.md` — this entry

---

## BUDGET QA + REFINEMENT PASS — 2026-04-03

**Session type:** Targeted QA pass on the newly implemented Budget module. No redesign. No new features.

### Bugs found and fixed
1. **overrunCount KPI / insights — unbudgeted categories falsely counted as overruns**
   - Root cause: `overrunCount = mergedCategories.filter(c => c.overrun > 0)` included categories with `budgeted === 0` and `actual > 0` (because `overrun = Math.max(0, actual - 0) = actual`).
   - Fix: `overrunCount` now filtered to `c.budgeted > 0 && c.overrun > 0`. The insights pill uses `overrunCategories` (same filtered list). Unbudgeted categories with spend remain in the missing-budget nudge only.
2. **Carry-forward banner shown on silent INSERT failure**
   - Root cause: `sessionStorage.setItem` and `setCarriedForward(true)` called unconditionally after `await supabase.from('budgets').insert(...)` without checking the returned error.
   - Fix: destructured `{ error: insertErr }` from the insert call; both side-effects now guarded by `if (!insertErr)`.
3. **History chart — no projection disclaimer**
   - Root cause: chart had no label indicating the fixed component is estimated.
   - Fix: added `"קבועות מחושבות כצפי חודשי"` subtitle under chart title (matches "(צפי)" honesty convention from Expense Analysis).

### Visual refinements
4. Page title: `text-2xl font-extrabold` → `text-xl font-semibold` (consistent with Expense Analysis polish pass).
5. Insights pills: `px-4 py-3` → `px-3 py-2` (compact, consistent with spec).

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — 5 targeted fixes
- `docs/CHANGELOG.md` — QA pass entry
- `docs/MODULE_STATUS.md` — status updated
- `handoff/SESSION_CHECKPOINT.md` — this entry

---

## BUDGET FULL IMPLEMENTATION — 2026-04-03

**Session type:** Full BudgetPage.tsx rewrite. New shared utility `src/lib/recurringUtils.ts`. tsc clean.

### What was built
1. **Pre-flight checks**
   - No UNIQUE constraint on `budgets(account_id, month, category)` found in migrations — duplicate protection is application-level (existing pattern preserved + improved).
   - `intervalToMonthly` signature confirmed: 4 params `(amount, interval_unit, interval_value, legacyFrequency)`. Default added in shared file. FixedExpensesTab and ExpenseAnalysisPage retain their existing imports (no circular risk).
   - Confirmed patterns: `useAuth()`, `useAccount()` (for `accountId`), `useMonth()` (for `currentMonth`), `supabase` direct import.

2. **Shared utility extracted**
   - `src/lib/recurringUtils.ts` — exports `intervalToMonthly` with `legacyFrequency='monthly'` default.
   - BudgetPage imports from here. Existing ExpenseAnalysisPage + FixedExpensesTab imports unchanged.

3. **BudgetPage.tsx — complete rewrite**
   - Actual spend = variable (financial_movements) + fixed (recurring_expenses projection)
   - Carry-forward logic with sessionStorage guard + dismissible banner
   - 4 KPI cards, insights strip (up to 5 pills), category cards with inline edit
   - Missing budget nudge (amber card, per-row CTA)
   - History chart (Recharts BarChart, 6 months)
   - Panel slides from right (`right-0`) — RTL-correct
   - All Supabase queries scoped by `account_id` (belt-and-suspenders with RLS)

### TypeScript
`npx tsc --noEmit` → **clean, no output** ✅

### Files changed
- `src/pages/BudgetPage.tsx` — complete rewrite
- `src/lib/recurringUtils.ts` — NEW
- `docs/MODULE_STATUS.md` — Budget ✅ CLOSED
- `docs/CHANGELOG.md` — entry added
- `handoff/SESSION_CHECKPOINT.md` — this entry

### Next logical work area
1. **Income attribution** — Stage 2 per `docs/skills/INCOME_MODEL_PLAYBOOK.md`
2. **AssetsPage / LoansPage / GoalsPage** — ⚠️ all need audit passes
3. **Billing activation** — infrastructure ops (run migrations, deploy Edge Functions, configure Tranzila secrets)

---

## EXPENSE ANALYSIS FINAL CLOSEOUT — 2026-04-03

**Session type:** Docs-only finalization + residual code scan. No logic/layout/styling changes.

### Residual audit — ExpenseAnalysisPage.tsx
- Scanned for `console.log`, `console.error`, `console.warn`, `TODO`, `FIXME`: **none found**
- No unused or broken imports detected
- No code changes required

### TypeScript
- `npx tsc --noEmit` → **clean, no output** (exit 0)

### Docs updated
- `docs/MODULE_STATUS.md` — removed duplicate "Next step: None — CLOSED for this stage" line in Expense Analysis section
- `handoff/LAST_KNOWN_GOOD_STATE.md` — updated header timestamp; renamed section to "Expense Analysis — CLOSED"; rewrote v1 limitations to reflect unified model (קבועות shows real data, not info state); added 4-pass arc summary; corrected tsc verification timestamp
- `handoff/SESSION_CHECKPOINT.md` — this entry prepended
- `docs/CHANGELOG.md` — "Expense Analysis — Stage Closed" entry added
- `docs/PRODUCT_DECISIONS.md` — no changes needed; all three filter mode decisions already recorded from prior passes

### Expense Analysis verdict: FULLY CLOSED ✅
All four implementation passes complete. TypeScript clean. Docs finalized. No residual code issues.

### Next logical work area (from MASTER_CONTEXT.md + MODULE_STATUS.md)
1. **BudgetPage** — ⚠️ needs audit pass (category display names may still be raw IDs)
2. **Income attribution** — Stage 2 per `docs/skills/INCOME_MODEL_PLAYBOOK.md`
3. **AssetsPage / LoansPage / GoalsPage** — ⚠️ all need audit passes
4. **Billing activation** — infrastructure ops (run migrations, deploy Edge Functions, configure Tranzila secrets) — see `handoff/CURRENT_BLOCKERS.md`

---

## EXPENSE ANALYSIS UI POLISH PASS — 2026-04-03

**Session type:** UI/UX refinement only — no logic, no data, no structure changes.

### Problem addressed
ExpenseAnalysisPage felt visually heavy, aggressive, and not premium. Typography was too dominant (text-4xl KPI, font-extrabold everywhere), cards were bulky (p-6 throughout), filter pills were chunky (px-4 py-2), and section titles competed with content.

### What changed — ExpenseAnalysisPage.tsx (className changes only)

**Typography:**
- Page title: text-2xl font-extrabold → text-xl font-semibold
- KPI number: text-4xl font-extrabold → text-3xl font-semibold (both KPI cards)
- KPI label: font-bold → font-medium
- KPI subtitle: text-sm → text-xs
- All card section titles: font-bold text-gray-900 → text-sm font-semibold text-gray-600
- All breakdown/ranking amounts: font-bold text-gray-900 → font-semibold text-gray-800
- Tooltip amounts: text-sm font-bold → text-xs font-semibold
- Filter pill label weight: font-semibold → font-medium

**Spacing:**
- KPI cards: p-6 → p-5, mb-5 → mb-4
- All chart/breakdown cards: p-6 → p-4, mb-5 → mb-4
- Card header spacing: mb-4 → mb-3
- Breakdown row spacing: space-y-3 → space-y-2.5
- Category ranking rows: px-4 py-3 → px-3 py-2
- Obligation/transaction rows: py-2.5 → py-2
- All filter pills: px-4 py-2 → px-3 py-1.5
- Donut+legend gap: gap-6 → gap-4
- Page header, tab nav, filter rows: mb-5 → mb-4

**Polish:**
- Category icon: text-lg → text-base in ranking rows
- Drill-down header icon: w-10 h-10 text-xl → w-9 h-9 text-lg
- Tooltip padding: p-3 → p-2.5

### TypeScript: `npx tsc --noEmit` ✅ clean (no output)

### Files changed
- `src/pages/ExpenseAnalysisPage.tsx`
- `docs/CHANGELOG.md`
- `handoff/SESSION_CHECKPOINT.md`

### Design result
Page now reads as calm, classic, and premium. KPI is legible but not dominant. Cards breathe without being spacious. Filters are compact. Section hierarchy is clear through color and weight, not size aggression.

---

## EXPENSE ANALYSIS UNIFIED MONTHLY MODEL — 2026-04-03

**Session type:** Product fix — ExpenseAnalysisPage.tsx. Unified monthly data model for Monthly tab. tsc clean.

### Problem addressed
Monthly Analysis tab only showed `financial_movements`. Fixed expenses from `recurring_expenses` were invisible. "קבועות" filter showed a dead-end info state. "משתנות" was absent (removed in prior session as "identical to הכל").

### What changed — ExpenseAnalysisPage.tsx
1. **Added recurring_expenses fetch** — parallel fetch alongside movements in `fetchMovements`. Returns active templates with all fields needed for monthly analysis.
2. **New TypeFilter = 'all' | 'variable' | 'fixed'** — all three modes now show real data.
3. **"הכל" mode:** KPI includes recurring projection total. Fixed summary card (between KPI and donut) shows fixed total + category breakdown + CTA to קבועות detail. Donut shows variable breakdown labeled "הוצאות משתנות בלבד".
4. **"משתנות" mode:** Movements only — fully functional, all charts, breakdowns, drill-down.
5. **"קבועות" mode:** Recurring templates projected monthly. KPI, category donut, obligations list, attribution breakdown (couple/family). No info state.
6. **Payment filter hidden in קבועות mode** — not applicable at template level.
7. **Attribution filter** — applies to movements (הכל/משתנות) and recurring templates (קבועות).
8. **`intervalToMonthly` imported from FixedExpensesTab** — shared helper, no duplication.

### TypeScript: `npx tsc --noEmit` ✅ clean (no output)

### Files changed
- `src/pages/ExpenseAnalysisPage.tsx`
- `docs/MODULE_STATUS.md`
- `docs/PRODUCT_DECISIONS.md`
- `docs/CHANGELOG.md`
- `handoff/SESSION_CHECKPOINT.md`

### v1 limitations (accepted, not blockers)
- "הכל" KPI combines actual (movements) + estimated (recurring projection) — labeled clearly with "(צפי)" context in subtitle.
- Recurring attribution breakdown in קבועות mode only reflects attribution if set on the template (null-safe, shows only non-zero rows).
- Trends tab unchanged — still uses projection estimate approach (accepted since prior session).

### Next session priority
- Unchanged from prior session: BudgetPage audit, Income attribution, AssetsPage/LoansPage/GoalsPage audits, Billing activation.

---

## EXPENSES WORLD FINAL CLOSEOUT — 2026-04-03

**Session type:** Docs/handoff finalization. No code changes (residual audit found nothing to fix).

### Residual audit results
- `ExpensesPage.tsx` — scanned for console.log / TODO / FIXME: **none found**
- `ExpenseAnalysisPage.tsx` — scanned: **none found**
- `FixedExpensesPage.tsx` — scanned (confirmed: pure `<Navigate>` redirect stub, clean)
- `npx tsc --noEmit` → **clean, no output**

### Docs updated
- `docs/MODULE_STATUS.md` — Expenses, ExpenseAnalysis, FixedExpenses all marked ✅ CLOSED; v1 limitations documented as accepted gaps, not blockers; "in progress" language removed
- `handoff/LAST_KNOWN_GOOD_STATE.md` — updated: tsc status, Expenses World CLOSED section added with full completion summary and v1 limitations
- `handoff/SESSION_CHECKPOINT.md` — this entry
- `docs/CHANGELOG.md` — "Expenses World — Stage Closed" entry added

### Expenses world verdict: FULLY CLOSED ✅
All modules (ExpensesPage, ExpenseAnalysisPage, FixedExpensesTab) are implemented, QA'd, TypeScript clean, and documented. No code changes were required in this pass.

### Next logical work area (from MASTER_CONTEXT.md + MODULE_STATUS.md)
Recommended sequence after Expenses world:
1. **BudgetPage** — ⚠️ needs audit pass (category display names may still be raw IDs)
2. **Income attribution** — Stage 2 per `docs/skills/INCOME_MODEL_PLAYBOOK.md`
3. **AssetsPage / LoansPage / GoalsPage** — ⚠️ all need audit passes
4. **Billing activation** — infrastructure ops (run migrations, deploy Edge Functions, configure Tranzila secrets) — see `handoff/CURRENT_BLOCKERS.md`

---

**Date:** 2026-04-03
**Session summary:** ExpenseAnalysisPage QA + refinement pass. 5 bugs fixed. tsc clean.

## Completed This Session (Expense Analysis QA Pass)

### Bugs fixed — ExpenseAnalysisPage.tsx
1. **"משתנות" type filter removed** — was identical to "הכל" (no `type` flag on `financial_movements`). TypeFilter union type narrowed to `'all' | 'fixed'`. Only "הכל" and "קבועות" now shown.
2. **קבועות info state text clarified** — old: "כאן מוצגות הוצאות משתנות בלבד" (confusing when the info state shows nothing). New: "ניתוח זה מציג הוצאות משתנות בלבד" — unambiguous.
3. **Donut cx/cy fixed** — was 75 in 160px ResponsiveContainer (5px off-center). Corrected to 80.
4. **Trends period selector RTL** — label had `pl-1` (wrong side in RTL). Corrected to `pr-1`.
5. **Stacked bar honesty** — "קבועות" bar renamed "קבועות (צפי)" — makes projection nature explicit in Legend and Tooltip.

### TypeScript: `npx tsc --noEmit` ✅ clean

### Files changed
- `src/pages/ExpenseAnalysisPage.tsx`
- `docs/MODULE_STATUS.md`
- `docs/CHANGELOG.md`
- `handoff/SESSION_CHECKPOINT.md`

### Remaining known limitations (accepted for v1)
- Trends fixed/variable split: fixed = current recurring template projection, applied identically to all months in the period. Does not account for template changes mid-period. Variable = total − fixed, clamped to ≥0.
- No movement-level type flag in `financial_movements` — "קבועות" filter shows info state by design.

---

**Date:** 2026-04-03
**Session summary:** ExpenseAnalysisPage full two-tab implementation (חודשי + מגמות). ExpensesPage CTA button upgrade. tsc clean.

## Completed This Session (Expense Analysis Two-Tab Architecture)

### ExpenseAnalysisPage.tsx — full implementation
- **Two page-level tabs:** חודשי (Monthly) and מגמות (Trends)
- **Monthly tab:**
  - Type filter: הכל / משתנות / קבועות — FIRST before all other filters
  - Attribution filter: unchanged (couple/family only)
  - Payment filter: unchanged
  - KPI card: total spend + count, clean typography (no mini-bars inline)
  - Category donut chart: Recharts PieChart with click-to-select and legend
  - Payment breakdown: bar rows from full month movements
  - Attribution breakdown: bar rows (couple/family)
  - Category ranking: full list with click drill-down → subcategory breakdown + transaction list
  - MonthSelector in header (existing behavior preserved)
- **Trends tab:**
  - Period selector: 3 / 6 / 12 months (NO MonthSelector — own time control)
  - AreaChart: monthly total spend over time (Recharts)
  - Stacked BarChart: fixed projection vs variable actual by month (Recharts)
  - Category trends table: top 5 categories, month-by-month cells with heat tinting
  - All data real from Supabase (financial_movements + recurring_expenses)
- TypeScript: `npx tsc --noEmit` ✅ clean

### ExpensesPage.tsx — CTA upgrade
- "ניתוח מפורט ›" upgraded from plain `<Link>` text to styled secondary button (blue tint background, blue text, hover opacity)

### Files changed
- `src/pages/ExpenseAnalysisPage.tsx`
- `src/pages/ExpensesPage.tsx`
- `docs/MODULE_STATUS.md`
- `docs/CHANGELOG.md`
- `handoff/SESSION_CHECKPOINT.md`

### Known limitation
- Trends fixed/variable split: `fixed` = recurring template monthly projection (estimate, not actual confirmed movements); `variable` = total − fixed. No movement-level type flag in `financial_movements` DB.

---

## Completed This Session (Analysis Visibility Fix)

### ExpenseAnalysisPage.tsx — breakdown visibility
- Both breakdowns (payment + attribution) now compute from raw `movements`, not filtered subsets
- Payment breakdown: removed `pmList.length <= 1` guard — always shown when data exists
- Payment breakdown: moved before attribution (universal vs couple/family-only)
- Attribution: zero-amount member rows suppressed
- `totalMovements` used as % basis for both, not `paymentFilteredTotal`
- tsc clean ✅

---

## Completed This Session (Expenses Final Closeout)

### Fix — FixedExpensesTab: attribution support (CRITICAL)
- `attributed_to_type` + `attributed_to_member_id` added to RecurringExpense, SavePayload, EMPTY_FORM
- `useAccount()` now includes `isCouple, isFamily, members`
- Fetch SELECT includes attribution
- openEdit, handleSave, handleConfirm, handleApplyScope all propagate attribution
- Attribution picker added to form panel (couple/family only): "משותף" + per-member buttons
- Migration updated: `20260403_recurring_sub_category.sql` now adds all 3 columns (sub_category + 2 attribution)

### Fix — ExpensesPage: donut centering + cleanup
- Donut cx/cy corrected to 60 (was 55) for proper centering in 120px container
- Removed unused `useNavigate` import and declaration

### TypeScript: `npx tsc --noEmit` ✅ clean

---

## Completed This Session (Expenses Final Completion Pass)

### Fix 1 — FixedExpensesTab: subcategory support
- `sub_category` added to `RecurringExpense`, `SavePayload`, `EMPTY_FORM`
- Fetch SELECT includes `sub_category`
- Category picker upgraded: icons added to pills; subcategory chips shown when `SUBCATEGORIES[category]` exists
- `openEdit` populates `sub_category`; `handleSave` sends it; `handleConfirm` and `handleApplyScope` propagate it to `financial_movements`
- Migration: `supabase/migrations/20260403_recurring_sub_category.sql` — run in Supabase SQL editor: `ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS sub_category text;`

### Fix 2 — ExpensesPage Overview: compact donut
- Added Recharts imports to ExpensesPage
- `chartColor` added to `topCategories` computation
- Small 120px Recharts donut added above the category bars in "קטגוריות מובילות" card

### Fix 3 — ExpenseAnalysisPage: payment breakdown section
- Added "חלוקה לפי אמצעי תשלום" section after attribution breakdown
- Shows per-source (if paymentSources exist) or per-payment_method breakdown with bars + %
- Section hidden if only 1 payment method found (no breakdown value)

### TypeScript: `npx tsc --noEmit` ✅ clean

---

**Previous session summary:** Variable expense delete silent-failure bug fixed. Root cause: `.delete()` without `.select()` returned no error when RLS blocked the operation (0 rows affected), causing optimistic UI to lie. Now uses `.select('id')` + checks `deleted.length === 0`. tsc clean.

## Completed This Session (Expenses Closeout Pass)

### Bug fixes
- **Desktop FAB backdrop z-index:** Was `z-[-1]` child inside `z-30` stacking context — outside-click dismissal never fired. Fixed: backdrop moved to sibling position at `z-[29]`, wrapped entire FAB in `<>` fragment.
- **FixedExpensesTab confirmError styling:** Was `bg-red-50 border-red-200 text-red-700` (old Tailwind, non-dismissible). Unified to inline-style error banner (`#FEF2F2/#E53E3E/#FECACA`) + dismissible ✕ calling `setConfirmError(null)` — matches all other error banners.

### TypeScript: `npx tsc --noEmit` ✅ clean

### Docs synced
- `docs/MODULE_STATUS.md`: AppLayout FAB label corrected; Fixed Expenses standalone section marked as merged
- `handoff/LAST_KNOWN_GOOD_STATE.md`: TransactionsPage → ExpensesPage + unified module files; tsc note updated
- `docs/CHANGELOG.md`: Expenses QA closeout entry added

### Expenses world verdict: CLOSED for this stage
All critical paths stable. Remaining items are low-priority and intentionally deferred (see MODULE_STATUS.md).

## Completed This Session (Expenses Implementation Pass)

### Delete reliability
- Added `if (!accountId) return;` guard to `handleDelete` in VariableExpensesTab — no more silent RLS failure if accountId is falsy
- `.eq('account_id', accountId!)` already applied last pass — kept

### Global FAB
- Label changed "הוסף עסקה" → "הוסף הוצאה" (desktop)
- FAB now shows 2-option popup on click: "הוצאה משתנה" + "הוצאה קבועה"
- Desktop: absolute popover above FAB button
- Mobile: centered popover above bottom nav FAB
- Popup closes on outside click and on navigation (location.pathname change)
- Both options route to correct tab with `?add=true`

### FixedExpensesTab
- Added `useSearchParams` import and `?add=true` useEffect — fixed tab now opens add panel when FAB selects "קבועה"
- Error banner unified with Variable tab style (#FEF2F2 / #E53E3E / #FECACA + dismissible ✕)
- Deactivate confirm button: `px-2 py-0.5` → `px-3 py-1.5 hover:bg-red-100` (proper tap target)

### Voice parser
- Added `subCategory: string` field to `ParsedExpense` interface
- `'subCategory'` added to `fieldsFound` array type
- 80+ `SUB_CAT_HINTS` entries mapping keywords to exact SUBCATEGORIES values
- `inferSubCategory(text, category)` function — same hit-count scoring as category inference
- CAT_HINTS expanded with ~15 new keywords per category (Israeli vendors, common services)
- `subCategory` wired into VariableExpensesTab: `handleVoiceTranscript` + voice preview bar chip

### ExpenseAnalysisPage
- Donut already present and working; account_id scoping fixed last pass — no changes needed

### TypeScript: `npx tsc --noEmit` ✅ clean

---

**Date:** 2026-04-03
**Session summary:** Voice-to-data feature completed. Hebrew speech → expense form population. VoiceExpenseButton component + voiceParser wired into VariableExpensesTab. tsc clean.
**Key changes:** VoiceExpenseButton created, VariableExpensesTab wired (handler, state, header, preview bar), resetForm updated, docs updated.

---

## Completed This Session (Voice Feature)

### Voice-to-data — full implementation
- `src/lib/voiceParser.ts` — already existed from prior session, complete
- `src/components/expenses/VoiceExpenseButton.tsx` — NEW. Handles all SpeechRecognition lifecycle. Three visual states: idle / recording / unsupported. `lang=he-IL`, `interimResults=true`. Instance created inside `startRecording`. `webkitSpeechRecognition` cast via `(window as any)`. Browser support check on mount.
- `src/components/expenses/VariableExpensesTab.tsx` — integrated. `handleVoiceTranscript` calls parser, applies safe merge to form state. "מה הבנתי:" preview bar. Voice button only in add mode (`!editingMovement`). Attribution only applied for couple/family accounts.
- TypeScript: `npx tsc --noEmit` ✅ clean

### What to test
1. Open add expense drawer → "הכתב בקול" button visible (blue)
2. Edit expense → button hidden
3. Tap mic → recording state (red dot + "מקשיב...")
4. Speak: "קניתי בסופר ב-350 שקל" → form populates: amount=350, category=food, description
5. "מה הבנתי:" bar shows ₪350 + קטגוריה chip
6. All fields remain editable; save works normally
7. Firefox: mic button greyed/disabled with tooltip
8. Dismiss "מה הבנתי:" with ✕ → bar disappears, form unchanged

---

**Date:** 2026-04-03
**Session summary:** Expenses module UX/product refinement pass. Stronger tooling applied (Context7, Sequential Thinking, UI/UX Pro Max skill, TypeScript LSP).
**Key changes:** Overview total semantics fixed, tab nav mobile layout fixed, account_id defensive filter added, RTL arrow direction fixed.

---

## Completed This Session (Expenses Refinement)

### Overview summary card — semantic fix
- `varTotal + fixedTotal` as hero KPI was semantically wrong: variable = actual charges, fixed = projected monthly equivalent of templates (not necessarily billed). Combined total was misleading.
- Fixed: `varTotal` is now the hero "הוצאות בפועל החודש". Fixed shown as clearly secondary "קבועות — צפי חודשי" row, only when `fixedTotal > 0`.

### Tab nav — mobile layout
- Was `w-fit` — on mobile the segmented control was narrow and buttons could overflow
- Fixed: `w-full sm:w-fit` + `flex-1 sm:flex-none` on buttons — equal-width tabs on mobile, natural width on desktop

### account_id filter — defensive data safety
- `VariableExpensesTab` fetch lacked `.eq('account_id', accountId)` — relied on RLS only
- Both `financial_movements` queries in `ExpensesPage.tsx` fetchOverview also lacked account_id
- All now include explicit account_id filter (belt-and-suspenders with RLS)
- VariableExpensesTab fetch guard: `if (!user)` → `if (!user || !accountId)`

### RTL forward-navigation arrow
- `←` on forward/detail navigation links violates RTL convention (`←` = back)
- Changed to `›` on "ניתוח מפורט" and "נהל" links in Overview tab

### TypeScript: `npx tsc --noEmit` ✅ clean

---

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
