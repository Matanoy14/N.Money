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

### ExpensesPage — Variable tab (/expenses?tab=variable)
- [ ] Add expense — saves correctly, appears grouped by category
- [ ] Edit expense — preloads all fields
- [ ] Delete expense — removes from list
- [ ] Attribution field shown for couple/family expense
- [ ] Attribution field hidden for personal account
- [ ] ?add=true URL opens add panel automatically
- [ ] Overview tab is default landing tab

### ExpensesPage — Fixed tab (/expenses?tab=fixed)
- [ ] Add recurring expense — appears in obligations list
- [ ] Confirm for current month — creates financial_movement
- [ ] Edit scope modal: future / retroactive / current-only options present

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
