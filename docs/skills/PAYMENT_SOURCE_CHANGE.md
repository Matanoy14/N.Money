# Skill: Payment Source Change Playbook

Use when adding source types, changing source behavior, or modifying the payment display logic.

## Current Source Types (as of 2026-04-03)
`credit | bank | transfer | bit | paybox | cash`

- `transfer` (העברה בנקאית, 🔄) — added 2026-04-03; maps to `payment_method: 'transfer'` via `SOURCE_TYPE_TO_PM`
- `bank` label updated from 'חשבון עו״ש' to 'חשבון בנק' — existing rows unaffected (label resolves via `getSourceTypeLabel`)
- Legacy aliases: `debit → credit`, `digital → bit` — kept in `SOURCE_TYPE_ALIASES` for backward compat

---

## Adding a Source Type

1. Add to `SOURCE_TYPES` in `src/lib/paymentMethods.ts`
2. Add to `SOURCE_TYPE_TO_PM` mapping (maps source type to a `payment_method` value)
3. Add legacy alias if needed in `SOURCE_TYPE_ALIASES`
4. `getSourceTypeLabel()` uses the SOURCE_TYPES list — will auto-pick up the new type; verify the label is correct

---

## Removing a Source Type

Do NOT remove from the list if any `payment_sources` rows exist with that `type` value in DB.
Instead: add to `SOURCE_TYPE_ALIASES` to map it to a supported type.

---

## Changing Display Logic

`resolvePaymentDisplay(payment_source_id, payment_method, sources)` is the canonical resolution function.
Defined in: `src/lib/paymentMethods.ts`

**Current verified call sites:**
- `src/components/expenses/VariableExpensesTab.tsx` — form chips + row display
- `src/pages/IncomesPage.tsx` — form chips + row display
- `src/pages/ExpenseAnalysisPage.tsx` — filter pills + drill-down display

If changing this function, verify all three call sites produce correct output for:
- Active source with ID → name + color
- Deactivated source with ID → graceful fallback (name still resolved, no crash)
- No source, payment_method only → method label fallback
- Both null → "—" or empty

---

## Adding Columns to payment_sources

Follow `docs/skills/DB_CHANGE_PLAYBOOK.md`.
Also update:
- `PaymentSource` interface in `src/lib/paymentMethods.ts`
- The `select()` string in AccountContext's payment sources fetch effect

---

## Pages That Use Payment Sources

| Location | Usage |
|----------|-------|
| `src/components/expenses/VariableExpensesTab.tsx` | Form chips + expense row display |
| `src/components/expenses/FixedExpensesTab.tsx` | Form chips in recurring template form |
| `src/pages/IncomesPage.tsx` | Form chips + income row display |
| `src/pages/ExpenseAnalysisPage.tsx` | Filter pills + drill-down payment breakdown |
| `src/pages/DashboardPage.tsx` | Recent movements display |
| `src/pages/SettingsPage.tsx` | CRUD UI (add/edit/deactivate sources) |

---

## Testing After Changes

1. Create a new source in Settings → verify it appears in all form pickers
2. Deactivate a source → verify it disappears from pickers but existing rows still display correctly
3. Old rows with deactivated `source_id` → verify graceful fallback display (no crash)
4. `npx tsc --noEmit` — must be clean
