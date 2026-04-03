# Recurring Expenses Model

Source: `src/pages/FixedExpensesPage.tsx`

## Template Model (recurring_expenses)
Each recurring expense is a template with:
- description, amount, category, payment_method, payment_source_id
- billing_day (1–31)
- interval_unit (day/week/month/year), interval_value (e.g. 1 = monthly, 2 = bimonthly)
- max_occurrences (null = unlimited)
- start_date, is_active

Legacy field: `frequency` (old string) — handled via `derivePreset()` + `intervalToMonthly()` fallback

## Recurrence Presets
| Preset | interval_unit | interval_value |
|---|---|---|
| שבועי | week | 1 |
| חודשי | month | 1 |
| דו-חודשי | month | 2 |
| שנתי | year | 1 |
| התאמה אישית | (user sets) | (user sets) |

## Confirmation Model (recurring_confirmations)
One row per (recurring_id, month). UNIQUE constraint.
- month: always YYYY-MM-01
- status: `'confirmed'` | `'skipped'`
- movement_id: FK to financial_movements when confirmed (null when skipped)

## Monthly Flow
1. Load all active recurring_expenses for account
2. Load all confirmations for current month
3. For each expense, determine status: confirmed / skipped / pending
4. `isExhausted`: `max_occurrences != null && confirmedCounts[id] >= max_occurrences`
5. Action buttons only shown for `isCurrentMonth && !isExhausted`

## Confirmed Counts
Loaded via parallel Promise.all during `loadConfirmations()`.
Used to show "הושלם (N/M)" badge when max_occurrences reached.

## Edit Scopes
When editing a recurring expense template, user chooses scope:

### 'future'
- Updates `recurring_expenses` template only
- Safe for all fields including amount, billing_day, interval settings

### 'retroactive'
- Updates `recurring_expenses` template
- Also patches all confirmed `financial_movements` linked to this template
- **Safe fields only**: description, category, payment_method, payment_source_id
- **Never retroactively changes**: amount, billing_day, interval_unit, interval_value, max_occurrences

### 'current-only'
- Does NOT update template
- Patches only the current month's linked `financial_movements` row (via `movement_id` from confirmations)
- If no confirmed movement exists for current month → shows error, cannot apply
- Safe fields only (same as retroactive)

## Scope Modal State
```
showScopeModal, scopePayload, scopeMovIds, scopeRisky,
scopeSaving, scopeCurrentMovId, scopeError
```

## Safety Rules
- Never modify amount retroactively
- Never modify billing_day retroactively
- Never modify interval settings retroactively
- If editing a field that is "risky" (unsafe for retroactive), `scopeRisky = true` → modal shows warning
- currentMovId captured from already-loaded confirmations state (no extra DB call)
