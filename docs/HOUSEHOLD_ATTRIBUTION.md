# Household Expense Attribution

## Purpose
Allow couple/family accounts to distinguish who an expense economically belongs to — independent of who paid.

## v1 Scope
- Expenses only (not income)
- Explicit user choice — never inferred from payment source
- Displayed in: TransactionsPage rows, ExpenseAnalysisPage filters and breakdown
- Hidden entirely for `personal` accounts

## Data Fields
On `financial_movements`:
- `attributed_to_type` text nullable: `'member'` | `'shared'` | null
- `attributed_to_member_id` uuid nullable: `account_members.user_id`

Nulls are legacy rows — must not crash, show nothing or subtle fallback.

## Attribution Values
- **Member**: specific household member (from `members[]` in AccountContext)
- **Shared**: belongs to the household as a whole
- **null**: unattributed (legacy row or personal account)

## Form Behavior (TransactionsPage)
- Shown only when `(isCouple || isFamily) && txType === 'expense'`
- Default: `'shared'`
- Options: `[משותף, ...members.map(m => m.name)]` — all dynamic, no hardcoded names
- Saving:
  - shared → `attributed_to_type = 'shared'`, `attributed_to_member_id = null`
  - member → `attributed_to_type = 'member'`, `attributed_to_member_id = member.user_id`
  - non-expense or personal → both null

## Display (AttrChip component in TransactionsPage)
- `'shared'` → gray pill "משותף"
- `'member'` → member's name in their avatarColor pill
- null → nothing (no crash)

## ExpenseAnalysisPage
- Attribution filter pills: הכל / משותף / [each member name] / לא משויך (only if unattributed rows exist)
- Filter applied to `paymentFiltered` → produces `filtered` for all category analytics
- Attribution breakdown section ("חלוקה לפי שיוך"): computed from `paymentFiltered` (pre-attribution-filter), shows full household split
- Section only shown for couple/family accounts

## Not in v1 Scope
- Income attribution
- Payment source owner_member_id
- Recurring expenses attribution (confirmations inherit null)
- Split ratios (50/50 or custom)
- Budget by person
- Attribution inference / AI

## Future Direction
See `docs/INCOMES_MODEL.md` for income attribution plans.
Payment source owner_member_id: planned but not implemented.
