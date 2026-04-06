# Skill: Taxonomy Change Playbook

Use when adding, removing, or modifying expense categories or subcategories.

## Rules
- Category IDs are stored in DB — never rename an ID that has historical data
- Removing a category: add its ID to `CATEGORY_ALIASES` pointing to a safe fallback
- Adding a category: choose a new unique English ID, add to `EXPENSE_CATEGORIES` array
- Subcategory changes: safe (plain text, no DB constraint)

## Adding a Category

1. Add to `EXPENSE_CATEGORIES` array in `src/lib/categories.ts`:
```ts
{ id: 'newid', name: 'שם עברי', icon: '🎯', color: '#XXXXXX', chartColor: '#XXXXXX' }
```

2. Add subcategories to `SUBCATEGORIES`:
```ts
newid: ['תת-קטגוריה 1', 'תת-קטגוריה 2', 'אחר'],
```

3. Check if the new category needs to appear in any existing hardcoded lists:
   - ExpensesPage variable tab category picker (`src/components/expenses/VariableExpensesTab.tsx`)
   - BudgetPage — verify if category grid has any hardcoded category filtering

4. Run `npx tsc --noEmit`

## Removing a Category

1. Do NOT delete it from `EXPENSE_CATEGORIES` if it has DB data
2. Instead, add to `CATEGORY_ALIASES`:
```ts
'oldid': 'other',  // or appropriate replacement
```
3. If it has no DB data: safe to remove from array

## Modifying Chart Colors

`chartColor` is used in all analytics. Changing it changes chart appearance for all users with historical data. Only change if intentional and coordinated.

## Subcategory Changes

Safe to add/remove subcategories anytime — they're display-only suggestions.
Existing DB rows with old subcategory values still display correctly (plain text).

## After Any Taxonomy Change
- `npx tsc --noEmit`
- Check ExpenseAnalysisPage (`src/pages/ExpenseAnalysisPage.tsx`) — uses `getCategoryMeta` + `SUBCATEGORIES`
- Check FixedExpensesTab (`src/components/expenses/FixedExpensesTab.tsx`) — uses category list for template form
- Check VariableExpensesTab (`src/components/expenses/VariableExpensesTab.tsx`) — uses category picker in expense drawer
- Check DashboardPage (`src/pages/DashboardPage.tsx`) — uses `getCategoryMeta` for chart + budget widget
