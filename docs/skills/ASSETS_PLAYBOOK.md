# Skill: Assets Playbook

Use when auditing, editing, or extending `src/pages/AssetsPage.tsx` or any module that consumes assets data (DashboardPage net worth).

---

## 1. Purpose

The Assets module lets users register and track financial assets: real estate, vehicles, pension funds, savings accounts, investments, etc.

This playbook covers:
- Safe audit of the current implementation
- Safe edits to AssetsPage or asset types
- Regression prevention when changing asset data that feeds Dashboard net worth
- Closeout criteria for this module

---

## 2. Current Implementation Reality

**File:** `src/pages/AssetsPage.tsx` — single-file component, no sub-components.

**Status:** Module is functional and real. **Not formally audited or closed.** RLS policies on the `assets` table have not been verified this session. `DATA_MODEL.md` entry for `assets` is currently marked "needs confirmation."

**What is live:**
- Full CRUD: add, edit, hard delete
- Hero card: total asset value (all assets, no filter)
- Asset list: cards with type badge, valuation date, notes
- Type filter pills: dynamically show only types that have at least one asset
- Breakdown sidebar: asset value by type, sorted by value desc, with % bars
- Slide-in add/edit panel (RTL, `slideInRight 0.25s`)

**What has NOT been audited:**
- RLS policies on `assets` table
- `DATA_MODEL.md` entry — currently marked "needs confirmation"
- No tsc verification recorded specifically for this module
- Attribution (couple/family asset ownership) — not implemented; all assets are account-level
- Historical valuation tracking — not implemented; single point-in-time `value` per asset

---

## 3. Architecture / Data Flow

### Asset Types
`real_estate | vehicle | pension | study_fund | investment | savings | other`

All 7 types are always available in the add/edit form picker (`ASSET_TYPES`).
In the filter pills, only types that have at least one stored asset are shown (`ASSET_TYPES.filter(t => byType[t])`).

### Asset Interface
```
id, name, type, value (number), notes (nullable), as_of_date (YYYY-MM-DD string)
```

- `value`: the user-entered current market value in ILS — no computation, no formula
- `as_of_date`: user-specified date of the valuation — NOT an auto-generated `created_at`. The user sets when the value estimate was made. Can be any date.
- `notes`: optional free text
- No `status` field — every stored asset is treated as active/current
- No soft-delete — `handleDelete` calls `.delete()` directly

### Total Value Calculation
`totalValue = assets.reduce((s, a) => s + a.value, 0)`

- Computed from **all** stored assets regardless of current `filterType`
- Shown in the hero card
- Used by Dashboard for net worth

### Type Distribution Sidebar
`byType = assets.reduce(...)` — builds a map of `type → total value`

- Sidebar only shown when `Object.keys(byType).length > 0`
- Sorted by value descending
- Shows amount + % of total

### Filter Behavior
`filtered = filterType === 'all' ? assets : assets.filter(a => a.type === filterType)`

- Filter affects only the list display, NOT the hero card total or the type breakdown sidebar
- Filter pills only render for types that have data (not all 7 always shown)

### Load Order
`assets` fetched ordered by `value DESC` (DB-sorted). Filter is purely client-side.

### Cross-Module Dependencies

| Consumer | Field read | Mechanism | Freshness |
|----------|-----------|-----------|-----------|
| **DashboardPage — net worth** | `value` | Direct DB read, sum of all active assets | Point-in-time — stale if user hasn't updated values recently |

Dashboard query:
```ts
supabase.from('assets').select('value').eq('account_id', accountId)
// Sums ALL assets for the account — no type or status filter
```

Net worth formula on Dashboard: `netWorth = totalAssets - totalLoans.balance`

---

## 4. Safe-Change Rules

### Do not break
- `totalValue` calculation: must remain ALL assets (no filter applied) — Dashboard reads the same totality
- `byType` computation: must remain independent of `filterType` — sidebar always shows full distribution
- `as_of_date` semantics: this is a user-entered valuation date, not `created_at`. Do not replace it with an auto-generated timestamp.
- Asset type IDs: stored as plain strings in DB — renaming a type ID breaks display for existing records. Use `TYPE_LABELS` for label changes.

### Data correctness traps

**Stale valuations (accepted limitation):**
Assets have a single `value` field — there is no automatic recomputation. A property purchased for ₪2M in 2020 still shows ₪2M until the user updates it. The `as_of_date` field communicates how fresh the estimate is, but does not trigger any recalculation. Dashboard net worth will reflect whatever the user last entered. This is by design — manual point-in-time valuations.

**No type validation on existing rows:**
If a new type is added to `ASSET_TYPES`, old records keep their stored type string. If a type is removed from `ASSET_TYPES`, the stored string is still shown via `TYPE_LABELS` and `TYPE_COLORS`. Always keep display maps complete even when removing from the picker.

**`totalValue` includes all assets regardless of filter:**
If a developer adds a filter that should also affect the summary total, `totalValue` must be recomputed from the filtered set explicitly. Currently the hero card and type sidebar are intentionally filter-independent.

**Hard delete is permanent:**
`handleDelete` calls `supabase.from('assets').delete()` — there is no soft-delete, no `is_active` flag, no recycle. Confirm with user before adding a delete action anywhere in the UI. If attribution is added later and assets become per-member, hard delete semantics need reconsideration.

### Regression traps
- Hero card total uses `totalValue` (ALL assets) — any filter-scoped refactor must not accidentally scope `totalValue`
- Breakdown sidebar only renders if `Object.keys(byType).length > 0` — do not change this guard without checking empty-state behavior
- Filter pills render dynamically from `ASSET_TYPES.filter(t => byType[t])` — adding a new type with no data will NOT show a filter pill (correct behavior)
- Edit panel opens with `as_of_date` from the stored record, not today's date. New add always defaults to today.

---

## 5. Audit Checklist

Before declaring this module stable/closed, verify:

### Data
- [ ] `assets` table schema matches the `Asset` interface (`id, name, type, value, notes, as_of_date, account_id, user_id`)
- [ ] RLS policy on `assets` — account-scoped for SELECT, INSERT, UPDATE, DELETE
- [ ] `DATA_MODEL.md` `assets` entry is complete (currently marked "needs confirmation")
- [ ] Hard delete confirmed as intentional product decision (no soft-delete)

### UI — list view
- [ ] Assets load and display ordered by value desc
- [ ] Loading state shows correctly
- [ ] Empty state (no assets): icon + message + implicit CTA (add button in top bar)
- [ ] Error banner shows on fetch failure
- [ ] Hero card shows correct total (all assets, not filtered)
- [ ] Filter pills: only types with existing assets are shown
- [ ] "הכל" filter always shown; type-specific pills only when that type has data
- [ ] Active filter pill uses type color; inactive uses gray

### UI — type breakdown sidebar
- [ ] Hidden when no assets exist (empty list)
- [ ] Sorted by value desc
- [ ] Bar widths proportional to total
- [ ] Percentages sum to 100% (rounding artifacts acceptable)

### UI — form / panel
- [ ] Add panel opens with empty form; `as_of_date` defaults to today
- [ ] Edit panel pre-fills all fields from existing record; `as_of_date` from stored value
- [ ] `value` field: rejects negative numbers and non-numeric input
- [ ] Save disabled when `name` or `value` is empty
- [ ] Slide-in panel: RTL correct (slides from right, `right-0 lg:right-[240px]`)
- [ ] Backdrop click closes panel

### Logic
- [ ] `totalValue` is sum of ALL assets regardless of active filter
- [ ] `byType` sidebar reflects all assets regardless of active filter
- [ ] `filtered` list updates correctly when filter pill is clicked
- [ ] Edit saves to correct `id` (not accidentally inserting)
- [ ] Delete removes from state optimistically without reload

### Cross-module
- [ ] DashboardPage net worth KPI reflects sum of all asset `value` fields
- [ ] Adding/editing/deleting an asset in AssetsPage changes Dashboard net worth on next Dashboard load
- [ ] Net worth = totalAssets − totalLoanBalances (confirm Dashboard formula is unchanged)

---

## 6. Closeout Criteria

This module can be declared formally closed when:
1. All items in the audit checklist above are verified
2. `assets` table schema confirmed and `DATA_MODEL.md` updated
3. RLS policies on `assets` confirmed (account-scoped)
4. `npx tsc --noEmit` clean
5. Stale-valuation limitation documented in `MODULE_STATUS.md` as accepted v1 behavior
6. Hard delete as intentional design is documented in `MODULE_STATUS.md`
7. `handoff/LAST_KNOWN_GOOD_STATE.md` updated with AssetsPage verified status

---

## 7. Reporting Expectations

A good audit/implementation report for this module must mention:
- Whether the filter pills show only types with data (not all 7 always)
- Whether `totalValue` in the hero card is independent of the active filter
- Whether the breakdown sidebar hides correctly when no assets exist
- RLS verification result
- `DATA_MODEL.md` confirmation
- Whether DashboardPage net worth changes correctly after an asset add/edit/delete
- The stale-valuation limitation — explicitly acknowledged
- tsc status
