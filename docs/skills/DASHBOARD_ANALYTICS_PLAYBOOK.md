# Skill: Dashboard and Analytics Playbook

Use when modifying DashboardPage or ExpenseAnalysisPage.

## DashboardPage Rules
- All data fetched in a single `Promise.all` — do not add separate useEffect fetches
- Empty states required for every widget (no blank areas)
- All internal nav: `<Link to>` never `<a href>`
- Health score: 4 sub-scores × 25pts. Only savings rate formula is confirmed. Others need confirmation before changing.
- KPI cards: numbers use `text-3xl font-extrabold` + `tabular-nums`

## Dashboard Data Dependencies
```
movements (current month) → KPIs, donut, top categories, recent movements
movements (6 months)      → bar chart trend
assets                    → net worth KPI
loans                     → net worth KPI
budgets                   → budget widget (only shown if non-empty)
```

## Adding a New Dashboard Widget
1. Check if data is already in the Promise.all — if yes, derive from existing state
2. If new data needed → add to the Promise.all, not a separate fetch
3. Add empty state
4. Widget must be visually consistent with existing cards
5. Section label if it's a new section

## ExpenseAnalysisPage Rules
- `paymentFiltered` = movements filtered by payment filter
- `filtered` = paymentFiltered filtered by attribution filter (personal accounts skip this)
- All category analytics derive from `filtered`
- Attribution breakdown derives from `paymentFiltered` (shows full household split regardless of attribution filter)
- `categoryList` is sorted descending by amount
- `selectedCat` state controls both donut dimming and drill-down visibility

## Adding a New Filter to ExpenseAnalysis
1. Add filter state
2. Add filter pills UI (include a label prefix like "לפי X:")
3. Derive new filtered set from the previous filtered set (chain them)
4. Ensure "all" default resets correctly when month changes
5. Ensure empty state shows filter hint when any filter is active

## Chart Colors
- Always use `cat.color` from `categoryList` (which is `meta.chartColor`)
- Never use `meta.color` for charts — that's the icon/UI accent color
- Dimming: `opacity: 0.35` for Recharts cells, `0.25–0.45` for CSS bars
