# Skill: Payment Source Change Playbook

Use when adding source types, changing source behavior, or modifying the payment display logic.

## Adding a Source Type

1. Add to `SOURCE_TYPES` in `src/lib/paymentMethods.ts`
2. Add to `SOURCE_TYPE_TO_PM` mapping
3. Add legacy alias if needed in `SOURCE_TYPE_ALIASES`
4. Check `getSourceTypeLabel()` — it uses SOURCE_TYPES list, will auto-pick up new type

## Removing a Source Type

Do NOT remove from the list if rows exist in DB with that type value.
Instead: add to `SOURCE_TYPE_ALIASES` to map it to a supported type.

## Changing Display Logic

`resolvePaymentDisplay(payment_source_id, payment_method, sources)` is the canonical resolution function.
- Called in: TransactionsPage, IncomesPage, ExpenseAnalysisPage, FixedExpensesPage
- If changing this function, verify all call sites

## Adding payment_sources Columns

Follow `docs/skills/DB_CHANGE_PLAYBOOK.md`.
Also update:
- `PaymentSource` interface in `paymentMethods.ts`
- The `select()` string in AccountContext's payment sources effect

## Pages That Use Payment Sources
- TransactionsPage: form chips + row display
- IncomesPage: form chips + row display
- ExpenseAnalysisPage: filter pills + drill-down display
- FixedExpensesPage: form chips
- DashboardPage: recent movements display
- SettingsPage: CRUD UI

## Testing After Changes
- Create a new source in Settings → verify it appears in all form pickers
- Deactivate a source → verify it disappears from pickers
- Old transactions with deactivated source_id → verify graceful fallback display
