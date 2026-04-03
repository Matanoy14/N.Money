# Taxonomy — Categories and Subcategories

Source of truth: `src/lib/categories.ts`

## Approved Expense Categories (16)

| id | Hebrew name | Icon | chartColor |
|---|---|---|---|
| housing | בית ודיור | 🏠 | #F59E0B |
| food | מזון וקניות | 🛒 | #F97316 |
| entertainment | מסעדות ובילוי | 🍽️ | #8B5CF6 |
| transport | רכב ותחבורה | 🚗 | #FBBF24 |
| communication | תקשורת ודיגיטל | 📱 | #A855F7 |
| health | בריאות | 🏥 | #FB923C |
| fitness | כושר ופנאי | 💪 | #D97706 |
| clothing | ביגוד והנעלה | 👗 | #EC4899 |
| children | ילדים | 👶 | #C026D3 |
| education | חינוך | 📚 | #7C3AED |
| travel | חופשות ונסיעות | ✈️ | #6366F1 |
| pets | חיות מחמד | 🐾 | #E879F9 |
| gifts | מתנות ואירועים | 🎁 | #DB2777 |
| insurance | ביטוחים | 🔒 | #71717A |
| grooming | טיפוח והיגיינה | 🧴 | #14B8A6 |
| other | אחר | 📦 | #A8A29E |

## Category ID Stability Rules
- IDs are stored in DB — renaming breaks existing data
- Never remove a category ID that has historical data
- New categories: choose an ID that won't collide with future needs
- `business` category was removed — do not re-add
- `getCategoryMeta()` returns a fallback `{id, name: id, icon: '📦'}` for unknown IDs

## Legacy Aliases (in categories.ts)
For old Hebrew strings stored by FixedExpensesPage:
- `'בית ודיור'` → `housing`
- `'רכב ותחבורה'` → `transport`
- `'תקשורת ודיגיטל'` → `communication`
- `'בריאות'` → `health`
- `'ילדים וחינוך'` → `children`
- `'ילדים'` → `children`
- `'אחר'` → `other`

## Subcategories (from SUBCATEGORIES in categories.ts)
Each category has an approved list. Full list in `src/lib/categories.ts`.
Subcategory is stored as a plain Hebrew string in `financial_movements.sub_category`.
The subcategory picker shows chips from this list; free-text is not supported in UI.

## Virtual Categories (not in EXPENSE_CATEGORIES)
Used internally for `financial_movements.category` on non-expense rows:
- `'income'` — for type=income rows
- `'transfer'` — for type=transfer rows

These have display meta defined inline in TransactionsPage's `categoryMeta` object.

## Chart Color vs Icon Color
- `color` = icon/UI accent color (used for borders, backgrounds tints)
- `chartColor` = stable color for charts/analytics (always use this in Recharts)
Never swap these two without checking both uses.
