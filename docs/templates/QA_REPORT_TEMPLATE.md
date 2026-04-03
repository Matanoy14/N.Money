# QA Report Template

Use after completing a feature or before merging significant changes.

---

## QA Report: [Feature or Sprint Name]

**Date:** YYYY-MM-DD
**Tester:** Claude / Human
**Account types tested:** Personal / Couple / Family

---

## Test Results

### Auth Flows
- [ ] Sign up creates account + profile
- [ ] Login works
- [ ] Logout clears session, redirects to landing

### TransactionsPage
- [ ] Add expense — saves correctly
- [ ] Add income — saves correctly
- [ ] Edit transaction — preloads all fields
- [ ] Delete transaction — removes from list
- [ ] Attribution field shown for couple/family expense
- [ ] Attribution field hidden for personal account
- [ ] Attribution field hidden for income
- [ ] ?add=true URL opens form automatically

### IncomesPage
- [ ] Add income — saves correctly
- [ ] Edit income — preloads fields
- [ ] Income type badge displayed (if implemented)

### ExpenseAnalysisPage
- [ ] Month selector changes data
- [ ] Payment filter works
- [ ] Attribution filter works (couple/family only)
- [ ] Attribution filter hidden for personal account
- [ ] Category click selects + shows drill-down
- [ ] Drill-down shows correct transactions
- [ ] Empty state appears when no data

### DashboardPage
- [ ] KPI cards show real data for current month
- [ ] "לניתוח מלא" navigates (no full reload)
- [ ] "לכל התנועות" navigates (no full reload)
- [ ] Budget widget hidden if no budgets

### SettingsPage
- [ ] Display name saves
- [ ] Employment type saves
- [ ] Payment source add works
- [ ] Payment source deactivate works
- [ ] No logout button in settings (logout is in AppLayout)

### Mobile
- [ ] All pages usable at 390px width
- [ ] No horizontal overflow
- [ ] FAB visible and functional

---

## Failures

List any failing tests with file:line reference.

---

## Notes
