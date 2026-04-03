# Dashboard and Analytics

## Dashboard Role
The dashboard is the daily command center. Shows the current month snapshot and health indicators. Links to detailed views — it does NOT contain drill-down analytics itself.

## Analytics Role
ExpenseAnalysisPage (`/expenses-analysis`) is where detailed category and attribution analysis lives. Dashboard links there.

## Dashboard Data
All fetched in a single `Promise.all`:
- Current month movements (income + expense)
- 6-month historical movements (for trend chart)
- Assets
- Loans
- Budgets for current month

## KPI Cards (4)
| Card | Value | Color |
|---|---|---|
| הכנסות | sum of income movements | #00A86B green |
| הוצאות | sum of expense movements | #E53E3E red |
| תזרים נטו | income − expenses | green if ≥0, red if <0 |
| הון נטו | sum(assets) − sum(loans) | blue |

Style: `text-3xl font-extrabold`, colored icon badge `w-11 h-11 rounded-2xl gradient`.

## Health Score Formula
Score 0–100, composed of 4 sub-scores (25pts each):

1. **Savings rate** (sr = (income−expenses)/income):
   - `Math.round(Math.min(sr / 0.20, 1) * 25)`
   - Full 25pts at ≥20% savings rate

2. **Budget adherence** — needs confirmation (not fully documented)

3. **Emergency fund** — needs confirmation

4. **Net worth trend** — needs confirmation

Score displayed as a donut gauge on dashboard. Sub-bar breakdown shown below gauge.

## Income vs Expenses Chart
6-month bar chart (BarChart, grouped). Uses `shortMonthNames` for X-axis labels. Computes monthly totals from 6-month historical data.

## Expense Donut (Dashboard)
- Top categories from current month expenses
- Capped at 5 slices + "אחר" for the rest
- Uses `chartColor` from EXPENSE_CATEGORIES
- Links to `/expenses-analysis` via `<Link>` (SPA-safe)

## Budget Widget
- Shown only if `budgets.length > 0` for current month
- Displays per-category budget vs actual
- Uses `getCategoryMeta(b.category).name` for Hebrew display
- Color: red if over budget, green if under

## Recent Movements
- Last 5 movements ordered by date desc
- Shows category icon, description, date, amount
- Links to `/transactions` via `<Link>` (SPA-safe)
- Empty state: "הוסף תנועה ראשונה" link

## What Belongs on Dashboard vs Analysis Page
| Insight | Where |
|---|---|
| Monthly total KPIs | Dashboard |
| Health score | Dashboard |
| Trend over 6 months | Dashboard |
| Category drill-down | ExpenseAnalysis |
| Attribution breakdown | ExpenseAnalysis |
| Subcategory detail | ExpenseAnalysis |
| Individual transactions | Transactions page |
