# Skill: Income Model Playbook

Use when implementing income improvements. See `docs/INCOMES_MODEL.md` for full spec.

## Current Constraints (post Tier 1)
- `financial_movements.category = 'income'` for all income rows (no change)
- `sub_category` now stores income type (משכורת / עצמאי / מתנה / שכירות / מילואים / בונוס / אחר)
- `attributed_to_type` + `attributed_to_member_id` now wired for couple/family accounts
- `payment_source_id` / `payment_method` now used as "הופקד לחשבון" — bank sources only

---

## V2 Phase 1: Schema additions (2026-04-06) — DB change only, no UI

**Migration:** `supabase/migrations/20260406_incomes_v2_phase1.sql` — **must be run in Supabase SQL editor**

### What Phase 1 adds
1. `financial_movements.recurring_income_id uuid NULL FK → recurring_incomes(id) ON DELETE SET NULL`
   — links a confirmed arrival movement to its template; NULL = one-time income
2. `recurring_income_confirmations` table — one row per (template, month):
   - status: `confirmed` (movement_id set) | `skipped` (no movement)
   - UNIQUE(recurring_id, month); CHECK(status IN ('confirmed','skipped'))
   - RLS: account_members policy; indexes on (account_id, month) and (recurring_id)

### Phase unlock map
| Phase | Requires Phase 1? | What it adds |
|-------|-------------------|-------------|
| Phase 2 | ✅ Yes | Monthly status badges on template rows (read-only) |
| Phase 3 | ✅ Yes | "רשום קבלה" inline action (write path) |
| Phase 7 | ✅ Yes | One-time section filters out `recurring_income_id IS NOT NULL` rows |

### V2 locked decisions (see PRODUCT_DECISIONS.md "V2 Locked Decisions" section)
- Two separate table sections (recurring / one-time) with different column structures
- expected_amount on financial_movements = one-time rows only
- Inactive templates hidden by default; "הצג לא פעילות" toggle
- Single "הוסף הכנסה" add button with choice
- Hard delete for templates (with guard)
- Analytics: single primary chart (expected vs actual) + collapsed secondary

---

## Unified Screen: Complete (2026-04-05) — zero DB change

**Status:** Fully implemented. `npx tsc --noEmit` clean. Browser QA pending.

### Architecture
- **Pinned-section table:** One `<table>`, two `<tbody>`. Templates `<tbody>` first (pinned top); movements `<tbody>` below. Shared `<thead>` with 8 columns (7 without attribution).
- **Columns:** תאריך | תיאור | [שיוך] | הופקד לחשבון | סכום צפוי | סכום בפועל | סטטוס | פעולות
- **Two amount columns (locked — overrides old single-column plan):**
  - Actual rows: `expectedCol = expected_amount ?? amount`; `actualCol = amount`
  - Template rows: `צפוי = amount (/ חודש)`; `בפועל = —` (gray)
- **6 multi-select filters** (`Set<string>`, empty=show all, AND composition, client-side only): search text, סוג שורה (חד-פעמי/קבוע), סוג הכנסה (7 types + none), שיוך, הופקד לחשבון, סטטוס (פעיל/לא פעיל — templates only)
- **Section visibility:** `showTemplateSection = filterRowTypes.size === 0 || filterRowTypes.has('קבוע')`; `showMovementsSection = filterRowTypes.size === 0 || filterRowTypes.has('חד-פעמי')`
- **MonthSelector dimming:** Wrapper `<div className="... opacity-40 pointer-events-none">` when `monthSelectorDimmed` — no MonthSelector.tsx changes
- **Summary strip:** Always computed from unfiltered `incomes` / `recurringIncomes` — filter state never referenced
- **`filteredTemplates` + `filteredIncomes`:** Both `useMemo` — deps are raw arrays + all filter state vars

### Filter composition rule
```ts
function toggleFilter(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}
// Usage: setFilterRowTypes(prev => toggleFilter(prev, 'קבוע'))
```

### `depositSources` useMemo (fix)
AccountContext pre-filters `is_active = true` at DB level — no `.is_active` check needed on `PaymentSource` interface:
```ts
const depositSources = useMemo(() => paymentSources.filter(s => s.type === 'bank'), [paymentSources]);
```

### Pending infra (not code gaps)
- `supabase/migrations/20260405_income_expected_amount.sql` — must be run for Tier 2 (`expected_amount` column)
- `supabase/migrations/20260405_recurring_incomes.sql` — must be run for Stage 3 (`recurring_incomes` table)

---

## Tier 1: Complete (2026-04-05) — zero DB change

### What was implemented
- Income type picker in drawer using `sub_category` field
- 7-item type list (locked — do not change without product approval):
  ```ts
  const INCOME_TYPES = ['משכורת', 'עצמאי', 'מתנה', 'שכירות', 'מילואים', 'בונוס', 'אחר'] as const;
  ```
- Attribution picker (real member names from AccountContext) — couple/family only
- "הופקד לחשבון" field: bank payment sources only (type === 'bank'). Fallback: 'transfer' + 'cash' PAYMENT_METHODS when no bank sources.
- Richer desktop table: תאריך / תיאור+type badge+notes / שיוך (conditional) / הופקד לחשבון / סכום / פעולות
- Mobile cards: type badge + notes secondary text + attribution when relevant
- Drawer: type picker at top, logical field order, attribution picker, slideInRight animation
- Notes: visible in drawer and as secondary text under description in table/cards
- UTC timezone fix: `Date.UTC(y, m, 1)` — no more off-by-one at Israel UTC+2/+3
- `account_id` defensive filter added to fetchIncomes

### File
`src/pages/IncomesPage.tsx` — single file, no migrations, no other files touched.

---

## Tier 2: Expected Income — Complete (2026-04-05)

**DB change:** `ALTER TABLE public.financial_movements ADD COLUMN expected_amount numeric NULL;`
Migration file: `supabase/migrations/20260405_income_expected_amount.sql`

### expected_amount semantics (locked decisions)
- `expected_amount = null` → no expectation set; show only actual amount (no extra indicator)
- `expected_amount = amount` → expected equals actual; show only actual (no extra indicator)
- `expected_amount ≠ amount AND ≠ null` → show secondary muted "צפוי: ₪X" below actual amount
- Blank or 0 input in drawer → saved as null (no expectation)
- Helper: `parseExpectedAmount(v) → n > 0 ? n : null`

### UI changes
- Drawer: label "סכום" renamed to "סכום בפועל"; new optional field "סכום צפוי (אופציונלי)" below it (text-base, not text-2xl)
- Table/mobile amount cell: conditional secondary muted line `צפוי: ₪X` when `expected_amount ≠ null && expected_amount ≠ amount`
- Summary strip: third card "צפוי vs התקבל" shown only when `hasAnyExpected = true`

### Dashboard safety
- Dashboard reads `amount` only — zero changes to Dashboard required
- No `status = 'planned'` rows introduced

---

## Tier 3 / Stage 3: Recurring Income Templates — COMPLETE (2026-04-05)

**Status:** Fully implemented and verified (2026-04-05). Migration confirmed in Supabase (table exists, RLS enabled, policy active). All 10 verification points passed.

### What Stage 3 delivers
- New `recurring_incomes` table (DB_CHANGE_PLAYBOOK Path B)
- Template CRUD in IncomesPage: add, edit, deactivate, reactivate
- "הכנסות קבועות" section in IncomesPage (below monthly movements table)
- Summary strip: "בסיס הכנסה קבועה" card (shown only when ≥1 active template exists)
- Monthly-only frequency — no interval_unit/interval_value columns

### What Stage 3 does NOT deliver (Stage 4)
- Monthly confirmation flow ("האם הגיעה ההכנסה?")
- `recurring_income_confirmations` table
- Auto-generation of `financial_movements` rows from templates
- `recurring_income_id` FK on `financial_movements`
- Weekly / yearly / custom frequencies

### Exact `recurring_incomes` schema

```sql
CREATE TABLE public.recurring_incomes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description             text        NOT NULL,
  income_type             text        NULL,
  amount                  numeric     NOT NULL,
  expected_day_of_month   int         NULL,
  payment_method          text        NOT NULL DEFAULT 'transfer',
  payment_source_id       uuid        NULL REFERENCES payment_sources(id),
  attributed_to_type      text        NULL,
  attributed_to_member_id uuid        NULL,
  notes                   text        NULL,
  is_active               bool        NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_incomes_account_member_access"
  ON public.recurring_incomes FOR ALL
  USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
```

### TypeScript interface

```ts
interface RecurringIncome {
  id: string;
  description: string;
  income_type: string | null;
  amount: number;
  expected_day_of_month: number | null;
  payment_method: string;
  payment_source_id: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
  notes: string | null;
  is_active: boolean;
}
```

### Select string
```ts
'id, description, income_type, amount, expected_day_of_month, payment_method, payment_source_id, attributed_to_type, attributed_to_member_id, notes, is_active'
```

### Drawer fields (Stage 3)
1. **סוג הכנסה** — type picker (same INCOME_TYPES chips from Tier 1, default: משכורת)
2. **תיאור** — text input, required
3. **סכום חודשי** — large numeric input (same style as Tier 1/2 actual amount)
4. **יום צפוי בחודש** — small optional numeric input (1–31), hint: "אופציונלי"
5. **הופקד לחשבון** — bank deposit picker (same Tier 1 rule: bank sources only, transfer/cash fallback)
6. **שיוך** — attribution picker (couple/family only, same Tier 1 pattern)
7. **הערות** — textarea, optional
8. Save button: "שמור הכנסה קבועה" (add) / "עדכן הכנסה קבועה" (edit)

### Section UI (IncomesPage)
- Section header: "הכנסות קבועות" + "הוסף" button (right side, RTL)
- Active templates: card list (one card per template)
  - Card: income_type badge + description + amount (large, green) + day hint if set + deposit chip + attribution chip
  - Actions: edit (✏️), deactivate toggle — hover on desktop, always on mobile
- Inactive templates: shown below active list, muted styling
  - Actions: reactivate toggle + edit
- Empty state (no templates at all): icon + "אין הכנסות קבועות עדיין" + "הוסף הכנסה קבועה ראשונה" CTA

### Summary strip computation
```ts
const hasActiveTemplates = recurringIncomes.some(t => t.is_active);
const totalRecurringBaseline = recurringIncomes
  .filter(t => t.is_active)
  .reduce((s, t) => s + t.amount, 0);
```
- Card shown only when `hasActiveTemplates`
- Label: "בסיס הכנסה קבועה"
- Value: `formatCurrency(totalRecurringBaseline)`
- NOT month-scoped — this is a standing account-level baseline

### State required in IncomesPage component
```ts
// Data state
const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
const [recurringLoading, setRecurringLoading] = useState(true);
const [recurringError, setRecurringError] = useState<string | null>(null);
const [recurringIsSaving, setRecurringIsSaving] = useState(false);
const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

// Panel state
const [showRecurringPanel, setShowRecurringPanel] = useState(false);
const [editingTemplate, setEditingTemplate] = useState<RecurringIncome | null>(null);

// Form state
const [rtDescription, setRtDescription] = useState('');
const [rtIncomeType, setRtIncomeType] = useState<string>('משכורת');
const [rtAmount, setRtAmount] = useState('');
const [rtExpectedDay, setRtExpectedDay] = useState('');
const [rtPayment, setRtPayment] = useState('transfer');
const [rtSourceId, setRtSourceId] = useState<string | null>(null);
const [rtAttrType, setRtAttrType] = useState<string | null>(null);
const [rtAttrMemberId, setRtAttrMemberId] = useState<string | null>(null);
const [rtNotes, setRtNotes] = useState('');
```

### Fetch pattern
- Separate `fetchRecurringIncomes` function — NOT month-scoped, fetches all active + inactive for account
- Query: `.from('recurring_incomes').select(...).eq('account_id', accountId).order('is_active', { ascending: false }).order('created_at', { ascending: true })`
- Fires once on mount + on accountId change (not on month change)

### Operations
- **Insert:** full payload, `returning = 'representation'` via `.select(...).single()`
- **Update:** full field set, `.eq('id', editingTemplate.id)`
- **Deactivate/Reactivate:** `.update({ is_active: false/true }).eq('id', id)` — no full form needed
- **No delete operation in Stage 3**

### Verification points for implementation pass
1. `npx tsc --noEmit` clean
2. Fetch is NOT month-scoped (templates are standing, not monthly)
3. Summary strip card does not appear until first active template exists
4. Dashboard still reads `financial_movements` only — no change
5. Deactivate/reactivate does not touch financial_movements
6. Attribution fields hidden for personal accounts (same `showAttribution = isCouple || isFamily` guard)
7. Deposit picker bank-only rule preserved (same Tier 1 logic as income add drawer)
8. Null safety: `income_type`, `expected_day_of_month`, `payment_source_id`, `attributed_to_type` all nullable — render safely
9. Legacy `expected_amount` behavior (Tier 2) not affected — no interaction with recurring templates
10. Slide panel uses same `slideInRight` animation and layout as existing income panel

---

## Testing After Each Tier

### Tier 1 verification
- Add income → verify sub_category saved correctly (check DB or re-open edit)
- Edit income → verify sub_category + attribution preloaded
- List view → verify type badge appears; notes visible under description
- Personal account → attribution hidden
- Couple/family account → attribution visible with real member names
- Bank sources only in deposit picker; credit/bit/paybox absent
- Month navigation → correct rows (timezone fix)

### Tier 2 verification (when implemented)
- Expected amount shown separately from actual
- Editing expected does not alter actual amount

### Tier 3 verification (when implemented)
- Recurring income template → monthly confirmation flow
- Confirmed income creates `financial_movements` row with source = 'recurring'
