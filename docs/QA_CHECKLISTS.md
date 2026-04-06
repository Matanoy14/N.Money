# QA Checklists

## Auth
- [ ] Login with valid credentials → dashboard
- [ ] Login with wrong password → error message, no crash
- [ ] Signup → onboarding → dashboard
- [ ] Stay on Settings 5+ min → NOT redirected to login (token refresh safe)
- [ ] Logout → landing page
- [ ] Reload on protected route → stays on page (not redirected)

## Expenses — Variable tab (/expenses?tab=variable)
- [ ] Add expense → appears in list grouped by category, updates dashboard
- [ ] Edit expense → changes reflected immediately
- [ ] Delete expense → removed from list
- [ ] Attribution field visible for expense (couple/family account only)
- [ ] Attribution field hidden for personal account
- [ ] `/expenses?tab=variable&add=true` opens add panel automatically
- [ ] After auto-open, refreshing page does NOT re-open panel
- [ ] Voice input button visible in add mode only (hidden in edit mode)
- [ ] Voice input button greyed/disabled on Firefox (SpeechRecognition unsupported)
- [ ] Overview tab is the default landing tab
- [ ] Tab state persists in URL param `?tab=`

## Expenses — Fixed tab (/expenses?tab=fixed)
- [ ] Add recurring expense → appears in obligations list
- [ ] Confirm for current month → creates financial_movement
- [ ] Skip for current month → status shows "דולג"
- [ ] Edit scope "עדכן להמשך" → only template changes
- [ ] Edit scope "עדכן גם את העבר" → template + past movements update
- [ ] Edit scope "החודש הנוכחי בלבד" → only current month movement changes
- [ ] Exhausted expense shows "הושלם (N/M)" badge, no action buttons
- [ ] Custom interval saves correctly
- [ ] Attribution picker visible for couple/family accounts on template form

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
- [ ] Desktop FAB "הוסף הוצאה" visible on all pages except /settings
- [ ] Desktop FAB hidden on /settings
- [ ] Desktop FAB 2-option popup: variable expense → /expenses?tab=variable&add=true | fixed expense → /expenses?tab=fixed
- [ ] Mobile bottom nav FAB navigates to /expenses?tab=variable&add=true
- [ ] Sidebar nav: single "הוצאות" entry → /expenses (not 3 separate entries)
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
- Add panel slides from left on some older panels (minor RTL gap — new panels use right-slide)
- Income attribution not yet implemented (Stage 2 in INCOME_MODEL_PLAYBOOK)
- Income type sub-category not yet implemented (Stage 1 in INCOME_MODEL_PLAYBOOK)
- Goals page is 100% mock data — acknowledged, tracked in GOALS_PLAYBOOK
- Assets, Loans, Calculators, Guides: functional but not formally audited/closed
- `account_invitations` DB table not yet run — invite flow degrades gracefully
- Billing (Tranzila): code complete, infra activation pending (see CURRENT_BLOCKERS)
