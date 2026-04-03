# Skill: Recurring Expenses Playbook

Use when modifying FixedExpensesPage or the recurring expense model.

## Key Invariants — Never Break These
- `recurring_confirmations` has UNIQUE(recurring_id, month)
- month is always YYYY-MM-01 format
- `movement_id` in confirmation is the only link from template to actual transaction
- Edit scope 'current-only' does NOT modify the template
- Retroactive edits only touch safe fields: description, category, payment_method, payment_source_id
- Unsafe retroactive fields (never patch past): amount, billing_day, interval_unit, interval_value, max_occurrences

## Before Modifying FixedExpensesPage
1. Read the full file — it's complex (~800+ lines)
2. Identify which of these state groups is affected:
   - Template CRUD (add/edit/delete form)
   - Recurrence presets (preset, interval_unit, interval_value)
   - Charge limit (limit_type, max_occurrences)
   - Monthly confirmation (confirm/skip buttons)
   - Scope modal (showScopeModal, scopePayload, scopeMovIds, scopeRisky, scopeSaving, scopeCurrentMovId, scopeError)

## Adding a New Field to Templates
1. Add to the `recurring_expenses` DB table (nullable)
2. Add to the `SavePayload` interface
3. Add to `EMPTY_FORM`
4. Add to the form UI
5. Add to `handleApplyScope()` — determine if it's safe for retroactive or future-only
6. Add to the insert and update payloads
7. Run `npx tsc --noEmit`

## Monthly Confirmation Flow
- `loadConfirmations()` runs after loading templates
- Loads all confirmations for current month + confirmed counts per template
- `isExhausted` check: `max_occurrences != null && confirmedCounts[id] >= max_occurrences`
- Action buttons hidden when: `!isCurrentMonth || isExhausted`

## Edit Scope Decision
Show scope modal when:
- User saves an existing template (not a new one)
- Present all 3 options: future / retroactive / current-only
- If any edited field is "unsafe" for retroactive → set `scopeRisky = true` → show warning
