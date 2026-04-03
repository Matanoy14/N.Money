# Routing and Pages

## Route Map

| Route | Component | Auth | Notes |
|---|---|---|---|
| `/` | LandingPage | public | Marketing/signup CTA |
| `/login` | LoginPage | public | |
| `/signup` | SignupPage | public | |
| `/forgot-password` | ForgotPasswordPage | public | |
| `/onboarding` | OnboardingPage | protected | Redirected here if !onboarding_completed |
| `/dashboard` | DashboardPage | protected | Main hub |
| `/transactions` | TransactionsPage | protected | ?add=true auto-opens add panel |
| `/incomes` | IncomesPage | protected | |
| `/budget` | BudgetPage | protected | |
| `/fixed-expenses` | FixedExpensesPage | protected | |
| `/expenses-analysis` | ExpenseAnalysisPage | protected | |
| `/loans` | LoansPage | protected | |
| `/assets` | AssetsPage | protected | |
| `/goals` | GoalsPage | protected | |
| `/settings` | SettingsPage | protected | No FAB |
| `/calculators` | CalculatorsPage | protected | |
| `/guides` | GuidesPage | protected | |

## ProtectedRoute Logic
1. If `loading || accountLoading` → show spinner (never redirect while loading)
2. If `!user` → navigate to `/login`
3. If `user && !onboardingCompleted` → navigate to `/onboarding`
4. Otherwise → render children

## Major Actions Per Page

### /dashboard
- View KPI cards (income, expenses, net flow, net worth)
- View health score, charts
- Navigate to analysis, budget, transactions via Link (SPA-safe)
- Add transaction (FAB, desktop)

### /transactions
- List all movements for month (filterable, searchable)
- Add/edit/delete any movement type
- Auto-opens add panel from `?add=true` URL param

### /incomes
- List income movements for month
- Add/edit/delete income entries

### /budget
- View/set monthly budget per category
- needs confirmation — exact actions not inspected

### /fixed-expenses
- List recurring expense templates
- Add/edit/delete templates
- Confirm or skip current month's occurrences
- Edit scope selection (future / retroactive / current-only)

### /expenses-analysis
- Filter by payment source/method, attribution (couple/family)
- View KPI + mini category bars
- View donut breakdown
- View attribution breakdown (couple/family only)
- View full category ranking, drill down to transactions

### /settings
- Edit profile (display_name, employment_type)
- Manage payment sources (create, deactivate)
- View other sections (not all persisted)

## Global Entry Points
- Desktop FAB: `fixed bottom-8 left-8` "הוסף עסקה" → `/transactions?add=true` (hidden on /settings)
- Mobile FAB: center of bottom nav → `/transactions?add=true`
- Sidebar nav: all main routes accessible
