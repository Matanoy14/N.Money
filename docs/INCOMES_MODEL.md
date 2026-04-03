# Incomes Model

## Current State (v1)
- Income entries stored in `financial_movements` with `type = 'income'`, `category = 'income'`
- No sub-categorization (salary vs. freelance vs. rental all look the same)
- `payment_method` used for "received into" — semantically wrong (designed for outgoing payments)
- Label was corrected to "אמצעי קבלה" but the data model is unchanged
- No attribution (no `attributed_to_type`)
- Notes field exists but not shown in list view

## Current Problems
1. **No income type**: all income looks the same — salary, freelance, rental, investment not distinguished
2. **Payment method semantics**: credit card as income method is unrealistic. Income "arrives into" an account, not "paid via" a card.
3. **No household attribution**: couple/family can't distinguish whose income it is
4. **No expected income tracking**: no "salary expected but not received yet" concept
5. **Notes not displayed in list**: exists in DB + form but invisible in the table/card view

## Recommended Future Model

### Stage 1 — Income type (zero DB change)
- Use existing `sub_category` field to store income type
- Values: `'משכורת' | 'פרילנס' | 'שכ״ד' | 'השקעות' | 'העברה' | 'אחר'`
- Add income type picker to IncomesPage form (chips below description)
- Display in list as a badge

### Stage 2 — Income attribution
- Add `attributed_to_type` and `attributed_to_member_id` to income rows (same pattern as expenses)
- Same couple/family guard as expenses
- "הכנסה שלי / של בן/בת הזוג / משותפת"

### Stage 3 — Received-into semantics
- Label "אמצעי קבלה" → "הופקד לחשבון"
- Filter payment source selector to `bank + cash` only (credit card income is unrealistic)
- The field becomes "which account received this income"

### Stage 4 — Expected income (longer term)
- Optional `expected_amount` + `expected_date` per income type
- Dashboard can show "salary expected in X days" or "not received yet"
- Requires either a new table or extending recurring_expenses to support income recurrence

## Implementation Order
1 → 2 → 3 (in future sessions, one at a time)
Stage 4 is long-term, do not plan yet.

## Files to Touch
- `src/pages/IncomesPage.tsx` — form + list display
- `src/lib/categories.ts` — possibly add INCOME_TYPES constant
- `src/pages/ExpenseAnalysisPage.tsx` — future: income analytics section
