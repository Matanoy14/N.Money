# Skill: Income Model Playbook

Use when implementing income improvements. See `docs/INCOMES_MODEL.md` for full spec.

## Current Constraints
- `financial_movements.category = 'income'` for all income rows (no sub-types)
- `payment_method` used as "received into" — semantically awkward but functional
- No attribution fields on income rows (yet)

## Stage 1: Income Type (safest, zero DB change)
Target file: `src/pages/IncomesPage.tsx`

1. Add income type picker to form using existing `sub_category` field:
```ts
const INCOME_TYPES = ['משכורת', 'פרילנס', 'שכ״ד', 'השקעות', 'העברה', 'אחר'];
```
2. Add `txIncomeType` state (default: 'משכורת' or '')
3. On save: set `sub_category: txIncomeType || null`
4. Display in list as a small badge (use `#E8F0FB` bg, `#1E56A0` text for neutral)
5. On edit: load from `income.sub_category`

## Stage 2: Income Attribution
Same pattern as expense attribution in TransactionsPage.
Guard: `(isCouple || isFamily) && type === 'income'`
Default: `'shared'`
Fields: `attributed_to_type`, `attributed_to_member_id`

Requires confirming DB columns exist on `financial_movements` (they should, were added globally).

## Stage 3: Received-Into Semantics
1. Change label "אמצעי קבלה" → "הופקד לחשבון"
2. Filter payment source picker to show only `type === 'bank' || type === 'cash'` sources
3. PAYMENT_METHODS fallback: show only `transfer` and `cash` options (not credit/bit)

## Testing After Each Stage
- Add income → verify sub_category saved correctly
- Edit income → verify sub_category preloaded
- List view → verify type badge appears
- Personal account → attribution hidden (Stage 2)
- Couple account → attribution visible (Stage 2)
