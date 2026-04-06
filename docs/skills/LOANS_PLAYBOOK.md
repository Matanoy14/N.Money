# Skill: Loans Playbook

Use when auditing, editing, or extending `src/pages/LoansPage.tsx` or any module that consumes loans data (BudgetPage loans card, DashboardPage net worth).

---

## 1. Purpose

The Loans module lets users register and track debts: mortgages, bank loans, credit lines, private loans, etc.

This playbook covers:
- Safe audit of the current implementation
- Safe edits to LoansPage, the amortization logic, or loan types
- Regression prevention when changing loan data that feeds Budget and Dashboard
- Closeout criteria for this module

---

## 2. Current Implementation Reality

**File:** `src/pages/LoansPage.tsx` — single-file component, no sub-components.

**Status:** Module is functional and real. **Not formally audited or closed.** RLS policies on the `loans` table have not been verified this session.

**What is live:**
- Full CRUD: add, edit, delete
- Status transitions: active → completed, active → frozen, completed/frozen → active (reactivate)
- 3-card summary: total active balance, total monthly payment, count of active loans
- Loan list: expandable rows with metadata + computed summary
- Slide-in add/edit panel (RTL, `slideInRight 0.25s`)
- Live derived-values preview in the add/edit form
- Shpitzer (equal monthly payment) amortization computed client-side

**What has NOT been audited:**
- RLS policies on `loans` table
- `DATA_MODEL.md` entry for `loans` — currently marked "needs confirmation"
- No tsc verification recorded specifically for this module
- Attribution (couple/family loan ownership) — not implemented

---

## 3. Architecture / Data Flow

### Loan Types
`mortgage | bank | non_bank | credit_line | private | leasing | other`

- `leasing` is **excluded from the form picker** (only 6 types shown in the type grid: `LOAN_TYPES` constant)
- `leasing` **still exists in `TYPE_LABELS` and `TYPE_COLORS`** — backward compat for stored records
- Do not remove `leasing` from display maps

### Loan Status
`active | completed | frozen`

Status transitions available in UI:
- `active` → `completed` (mark closed)
- `active` → `frozen` (pause)
- `completed` or `frozen` → `active` (reactivate)

### Amortization — `computeLoanDerived(P, annualRate, n, startDate)`
Pure Shpitzer calculation (equal monthly installment). Inputs:
- `P` = original amount
- `annualRate` = annual interest rate %
- `n` = total months
- `startDate` = loan start date (string)

Outputs: `monthly_payment`, `balance`, `months_remaining`, `end_date`, `total_remaining`, `remaining_interest`, `total_interest`

Zero-rate guard: if `rate < 0.000001`, uses simple division (`P/n`).
`elapsed` = months since start date, computed client-side from `new Date()`.

### Display Values — `getLoanDisplayValues(loan)`
Two modes, chosen automatically:

| Mode | Trigger | Source |
|------|---------|--------|
| **Live recompute** | `original_amount != null && total_months != null && start_date` all present | `computeLoanDerived()` |
| **Legacy fallback** | Any of the three fields missing | Stored `balance`, `monthly_payment`, `months_remaining`, `end_date` |

**All display values (balance in card, monthly payment in summary, expand panel numbers) go through `getLoanDisplayValues()`.**

### Save Behavior
On save, if `original_amount + total_months + start_date` are all provided:
- `computeLoanDerived()` is called
- Derived values (`balance`, `monthly_payment`, `months_remaining`, `end_date`) are **stored** in DB alongside the source inputs

On edit where model fields are not touched (e.g., updating only `name` or `notes`):
- `extra` is empty — derived fields are NOT recomputed and NOT updated in DB
- Stored derived values remain as-of the last full save

### Cross-Module Dependencies

| Consumer | Field read | Mechanism | Freshness |
|----------|-----------|-----------|-----------|
| **BudgetPage — loans card** | `monthly_payment` | Direct DB read (`status = 'active'`, sum) | Stored at save time — **Shpitzer monthly payment is constant**, so this is always accurate |
| **DashboardPage — net worth** | `balance` | Direct DB read (`status = 'active'`, sum) | Stored at save time — **can drift** as months pass without re-saving |

---

## 4. Safe-Change Rules

### Do not break
- `getLoanDisplayValues()` — any change here affects every number shown on LoansPage, the summary cards, and the expand panel
- `computeLoanDerived()` — any change changes stored derived values on next save; old records keep old stored values
- `TYPE_LABELS` — do not remove `leasing` (backward compat for stored rows)
- `LOAN_TYPES` (form picker) — `leasing` is intentionally absent; do not add it back without a product decision
- Status transition logic — completed/frozen loans are excluded from totalBalance, totalMonthly, and Dashboard/Budget reads

### Data correctness traps

**Balance drift (high risk for Dashboard net worth):**
The stored `balance` in DB is computed at save time. For Shpitzer loans, balance decreases each month but is only updated when the user re-saves the loan. DashboardPage net worth reads stored `balance` directly from DB — it does NOT recompute. Net worth shown on Dashboard can be stale by the difference between stored balance and actual remaining balance. This is a known v1 limitation. Do not attempt to "fix" it by adding live recomputation to Dashboard without a product decision — it would require storing original inputs on every loan row and recomputing at query time.

**Monthly payment accuracy (Budget card):**
For Shpitzer loans, `monthly_payment` is constant throughout the loan term — the stored value is always correct. Only changes if the loan is refinanced/edited.

**Edit without model fields:**
If a user edits a loan and clears `original_amount` or `total_months` or `start_date`, the save will not run `computeLoanDerived()` (because `hasNewModel` will be false). Stored derived values remain stale. The display will fall back to stored values. Do not add "smart" recomputation logic without validating the full edit flow.

**Legacy records:**
Old records may have only `balance`, `monthly_payment`, `months_remaining` stored — no `original_amount/interest_rate/total_months/start_date`. These display correctly via the fallback path in `getLoanDisplayValues()`. `total_interest` will be `null` for these rows (shown in expand panel only).

### Regression traps
- `totalBalance` and `totalMonthly` on summary cards call `getLoanDisplayValues()` per loan — changes to that function cascade immediately to summary cards
- Loan list order: `balance DESC` (DB-ordered, not client-sorted) — after a re-save that changes balance, order may shift on reload
- Live preview in form: calls `computeLoanDerived()` on every keypress for the 3 model fields — any performance issue here blocks the form

---

## 5. Audit Checklist

Before declaring this module stable/closed, verify:

### Data
- [ ] `loans` table schema matches the `Loan` interface in the file (all columns present)
- [ ] RLS policy on `loans` — account-scoped for SELECT, INSERT, UPDATE, DELETE
- [ ] Delete is hard-delete (`supabase.from('loans').delete()`) — confirm this is intentional (no soft-delete)
- [ ] `DATA_MODEL.md` `loans` entry is complete (currently marked "needs confirmation")

### UI — list view
- [ ] Loans load correctly and are ordered by balance desc
- [ ] Loading state shows correctly
- [ ] Empty state: icon + message + implicit CTA (add button in top bar)
- [ ] Error banner shows on fetch failure
- [ ] Summary cards show correct totals (active loans only)
- [ ] Expand/collapse row toggles correctly; only one row expanded at a time

### UI — expand panel
- [ ] Metadata row shows correct values (original amount, total months, months remaining, start date, payment method)
- [ ] Computed summary row: "נותר לשלם", "ריבית עתידית משוערת", "סה״כ ריבית" — only shown when non-null
- [ ] Legacy records (no original_amount): computed summary row hidden; fallback values shown in metadata
- [ ] Notes shown when non-empty
- [ ] Status action buttons shown correctly:
  - active: "סמן כנסגרה" + "הקפא" + "ערוך" + "מחק"
  - completed/frozen: "הפעל מחדש" + "ערוך" + "מחק"

### UI — form / panel
- [ ] Add panel: requires name + original_amount + total_months + start_date before saving
- [ ] Edit panel: requires name only (model fields optional) — `canSave` guard correct
- [ ] Live preview appears when all 3 model fields filled (original_amount + total_months + start_date)
- [ ] Live preview shows: monthly payment, current balance, months remaining, total interest
- [ ] `leasing` type NOT shown in type picker (but existing `leasing` records display correctly)
- [ ] Slide-in panel: RTL correct (slides from right, `right-0 lg:right-[240px]`)
- [ ] Backdrop click closes panel

### Logic
- [ ] `computeLoanDerived()`: verify with a known example (e.g., ₪500,000 at 3.5% for 240 months → ~₪2,898/month)
- [ ] Zero-rate path: 0% interest loan computes correctly
- [ ] `elapsed` months: computed correctly from today vs start_date
- [ ] Status change: `active` loans appear in summary totals; `completed`/`frozen` do not

### Cross-module
- [ ] BudgetPage loans card shows sum of `monthly_payment` for active loans — matches LoansPage totalMonthly
- [ ] DashboardPage net worth uses `balance` (stored, may be stale) — document as accepted limitation

---

## 6. Closeout Criteria

This module can be declared formally closed when:
1. All items in the audit checklist above are verified
2. `loans` table schema confirmed and `DATA_MODEL.md` updated
3. RLS policies on `loans` confirmed (account-scoped)
4. `npx tsc --noEmit` clean
5. Balance drift limitation documented in `MODULE_STATUS.md` as an accepted v1 limitation
6. `handoff/LAST_KNOWN_GOOD_STATE.md` updated with LoansPage verified status

---

## 7. Reporting Expectations

A good audit/implementation report for this module must mention:
- Which loan types have data in the test account (including any `leasing` legacy rows)
- Whether the live preview renders correctly for a new loan entry
- Whether edit-only (name change, no model re-entry) preserves the stored derived values correctly
- The balance drift limitation — explicitly acknowledged
- RLS verification result
- Whether BudgetPage loans card total matches LoansPage totalMonthly summary
- tsc status
