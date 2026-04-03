# QA Checklists

## Auth
- [ ] Login with valid credentials → dashboard
- [ ] Login with wrong password → error message, no crash
- [ ] Signup → onboarding → dashboard
- [ ] Stay on Settings 5+ min → NOT redirected to login (token refresh safe)
- [ ] Logout → landing page
- [ ] Reload on protected route → stays on page (not redirected)

## Transactions
- [ ] Add expense → appears in list, updates dashboard
- [ ] Add income → appears in list
- [ ] Add transfer → appears in list
- [ ] Edit transaction → changes reflected immediately
- [ ] Delete transaction → removed from list
- [ ] Attribution field visible for expense (couple/family account only)
- [ ] Attribution field hidden for income/transfer
- [ ] Attribution field hidden for personal account
- [ ] `?add=true` URL param opens add panel automatically
- [ ] After auto-open, refreshing page does NOT re-open panel

## Fixed Expenses
- [ ] Add recurring expense → appears in list
- [ ] Confirm for current month → creates financial_movement
- [ ] Skip for current month → status shows "דולג"
- [ ] Edit scope "עדכן להמשך" → only template changes
- [ ] Edit scope "עדכן גם את העבר" → template + past movements update
- [ ] Edit scope "החודש הנוכחי בלבד" → only current month movement changes
- [ ] Exhausted expense shows "הושלם (N/M)" badge, no action buttons
- [ ] Custom interval saves correctly

## Budget
- [ ] Budget widget on dashboard only shows when budgets exist
- [ ] Category names display in Hebrew (not raw IDs) — needs confirmation

## Expense Analysis
- [ ] Payment filter works, updates all analytics
- [ ] Attribution filter visible for couple/family only
- [ ] Attribution filter updates all category analytics
- [ ] Attribution breakdown section visible for couple/family only
- [ ] Click category in ranking → drill-down opens
- [ ] Drill-down ✕ button closes it
- [ ] Dates in drill-down transactions are formatted (not YYYY-MM-DD)
- [ ] Mini-bars in KPI card show top 5 + "אחר" if >5 categories
- [ ] Clicking mini-bar selects category
- [ ] Empty state shows filter hint when filter is active

## Settings
- [ ] Profile section saves and reloads correctly
- [ ] Add payment source → appears in list and in all form pickers
- [ ] Deactivate payment source → disappears from pickers
- [ ] No logout button in Settings page (only in sidebar)

## Incomes
- [ ] Add income → appears in list with correct amount and date
- [ ] Edit income → preloads all fields correctly
- [ ] Delete income → removed from list
- [ ] Payment method/source picker shows correct options
- [ ] List is scoped to current month

## AppLayout
- [ ] Desktop FAB "הוסף עסקה" visible on all pages except /settings
- [ ] Desktop FAB hidden on /settings
- [ ] Mobile bottom FAB navigates to transactions with add panel open
- [ ] Sidebar nav highlights active route
- [ ] Mobile drawer opens/closes correctly

## Dashboard
- [ ] All 4 KPI cards show real data
- [ ] Charts render with data; graceful empty states when no data
- [ ] Internal links (ניתוח מלא, לניהול תקציב, לכל התנועות) navigate without full page reload

## Blockers vs Acceptable Weaknesses

### Blockers (must fix before release)
- Auth redirect loop
- Fake data in any production screen
- Payment source insert failing (null account_id)
- Crash on missing data (null dereference)

### Acceptable Weaknesses (known, tracked)
- Voice input is stub
- Add panel slides from left (minor RTL mismatch)
- Some Settings sections not persisted to DB
- Income attribution not implemented
- Goals/Assets/Loans not fully reviewed
- Budget page category display needs confirmation
