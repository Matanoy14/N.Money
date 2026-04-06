# Skill: Dashboard and Analytics Playbook

Use when modifying DashboardPage or ExpenseAnalysisPage.

---

## DashboardPage Rules

- All data fetched in a **single `Promise.all`** — do not add separate `useEffect` fetches
- Empty states required for every widget (no blank areas)
- All internal nav: `<Link to>` never `<a href>`
- KPI cards: numbers use `text-3xl font-extrabold` + `tabular-nums`
- Health score: **see warning below**

---

## Dashboard Data Dependencies

```
financial_movements (current month)  → KPI cards, expense donut, top categories, recent movements
financial_movements (6 months)       → income vs expense bar chart trend
assets                               → net worth KPI (totalAssets = sum of asset values)
loans (active, monthly_payment)      → net worth KPI (totalLiabilities = sum of monthly_payment on active loans)
budgets (current month)              → budget widget (only shown if non-empty)
```

**Net worth calculation:**
- `netWorth = totalAssets - totalLiabilities`
- `totalAssets`: fetched from `assets` table
- `totalLiabilities`: fetched from `loans` table, `status = 'active'`, sum of `balance` (outstanding principal) — NOT `monthly_payment`
- Both fetched in the same `Promise.all` — do not split into separate fetches

---

## Health Score — Critical Warning

The health score is composed of **4 sub-scores × 25 pts each** (max 100).

| Sub-score | Formula status |
|-----------|---------------|
| Savings rate | ✅ Confirmed — reads `nmoney_savings_goal_pct` from localStorage |
| Spending control | ⚠️ Formula not confirmed — do not change without product owner approval |
| Budget adherence | ⚠️ Formula not confirmed — do not change without product owner approval |
| Financial diversity | ⚠️ Formula not confirmed — do not change without product owner approval |

**Rule:** Do not touch DashboardPage health score logic (any sub-score other than savings rate) without explicit product owner confirmation of the formula. Location: `src/pages/DashboardPage.tsx` → look for `healthScore` calculation.

---

## Adding a New Dashboard Widget

1. Check if the data needed is already in the `Promise.all` — if yes, derive from existing state
2. If new data is needed → add to the `Promise.all`, not a separate fetch
3. Add an empty state for the widget
4. Widget must be visually consistent with existing cards (same shadow, spacing, typography)
5. Add a section label if it's a new section

**Integration surface rule:** Dashboard is the integration surface for all other modules. Any module that adds new data (Goals, etc.) must document how it surfaces in Dashboard **before** implementation begins. Do not wire a new data source into DashboardPage without a product decision on how the widget looks and what it shows.

---

## ExpenseAnalysisPage Rules

- `paymentFiltered` = movements filtered by payment filter
- `filtered` = `paymentFiltered` filtered by attribution filter (personal accounts skip this step)
- All category analytics derive from `filtered`
- Attribution breakdown derives from `paymentFiltered` (shows full household split regardless of attribution filter)
- `categoryList` is sorted descending by amount
- `selectedCat` state controls both donut dimming and drill-down visibility

### Type filter modes (as of 2026-04-03)
- **"הכל"** — KPI = variable movements + fixed projection. Fixed summary card shown. Donut/ranking from variable.
- **"משתנות"** — `financial_movements` (type=expense) only. Full charts + breakdowns.
- **"קבועות"** — `recurring_expenses` table (active templates, projected monthly). KPI, donut, obligations list, attribution breakdown. Payment filter hidden in this mode.

---

## Adding a New Filter to ExpenseAnalysis

1. Add filter state
2. Add filter pills UI (include a label prefix like "לפי X:")
3. Derive new filtered set from the previous filtered set (chain them)
4. Ensure "all" default resets correctly when month changes
5. Ensure empty state shows filter hint when any filter is active

---

## Chart Colors

- Always use `cat.color` from `categoryList` (which is `meta.chartColor`)
- Never use `meta.color` for charts — that's the icon/UI accent color
- Dimming: `opacity: 0.35` for Recharts cells, `0.25–0.45` for CSS bars
