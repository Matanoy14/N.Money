# Product Decisions

Locked decisions — do not change without explicit user approval.

---

## Identity
- Product name: **N.Money** (never N.Fortis — old name, fully removed)
- Language: Hebrew throughout
- Layout: RTL (`dir="rtl"`)
- Primary color: `#1E56A0` (blue)
- Sidebar background: `#0B1F4A`
- Page background: `#F0F4FA`

## Data Principles
- Single `financial_movements` table for all income/expense/transfer
- `type` field distinguishes: `'income' | 'expense' | 'transfer'`
- No separate income or expense tables
- All movements scoped by `account_id` (not just `user_id`)

## Auth
- `setLoading(false)` ONLY inside `getSession().then()` — never in `onAuthStateChange`
- Single logout button — in AppLayout sidebar only, never duplicated in SettingsPage
- `ProtectedRoute` waits for BOTH `loading` AND `accountLoading` before redirecting

## Navigation
- All internal links use React Router `<Link>` or `navigate()` — never `<a href="...">`
- LandingPage/SignupPage `href="#"` placeholders are acceptable (pre-auth, no destination)

## Payment Sources
- Source types: `credit | bank | transfer | bit | paybox | cash`
  - `transfer` (העברה בנקאית, 🔄) added 2026-04-03 — maps to `payment_method: 'transfer'` via SOURCE_TYPE_TO_PM
  - `bank` (חשבון בנק, 🏦) label updated from 'חשבון עו״ש' — existing rows unaffected, label resolves via `getSourceTypeLabel`
- Legacy types: `debit → credit`, `digital → bit` (backward compat aliases)
- `payment_sources` is soft-deleted via `is_active = false`
- Sources always have: id, name, type, color, user_id, account_id, is_active

## Categories
- 16 approved categories — see `docs/TAXONOMY.md`
- Category IDs are stable — never rename an id in production
- 'business' category was removed — do not re-add
- Subcategories stored as plain text in `sub_category` field
- `getCategoryMeta()` handles legacy string aliases from FixedExpensesPage

## Expense Attribution (v1)
- `attributed_to_type`: `'member' | 'shared' | null`
- `attributed_to_member_id`: UUID or null
- Attribution is explicit — never inferred from payment source
- Only shown/saved for expense type, couple/family accounts
- `null` attribution on legacy rows is acceptable — do not crash

## Recurring Expenses
- Template stored in `recurring_expenses`
- Monthly status in `recurring_confirmations` (UNIQUE on recurring_id + month)
- Edit scopes: `'future'` (template only), `'retroactive'` (template + past movements), `'current-only'` (current month movement only, safe fields)
- Safe retroactive fields: description, category, payment_method, payment_source_id
- Unsafe (future-only): amount, billing_day, interval_unit, interval_value, max_occurrences

## Voice Input
- Stub only — shows "פיצ׳ר בפיתוח" message, injects NO data
- Do not implement real voice input without explicit instruction

## Mock Data
- Zero mock/fake/placeholder financial data anywhere in production screens
- If a screen is not data-connected, make that state explicit

## Unified Expenses Module (locked 2026-04-03)
- `/expenses` is the canonical route for all expense-related functionality
- Three tabs: סקירה (overview, default) | משתנות (variable CRUD) | קבועות (fixed/recurring)
- Tab state persisted in URL param `?tab=`
- `/transactions` and `/fixed-expenses` are redirect stubs — do not add content back to them
- Expense Analysis (`/expenses-analysis`) remains a separate page, accessible from Overview tab
- MonthSelector renders once in the ExpensesPage shell — not in each tab independently
- FAB navigates to `/expenses?tab=variable&add=true`
- Overview tab default landing — do not change default tab without explicit decision

## Expenses Module — Pure Expense View (locked 2026-04-03)
- `/transactions` route is the **Expenses module** — expense CRUD only
- DB query filters `type = 'expense'` — income and transfer rows are never fetched or displayed here
- Transfers: managed nowhere in the current UI (no dedicated transfers page); transfer movements exist in DB but are not surfaced
- Income: managed in IncomesPage (`/incomes`) only
- Voice input stub: removed — do not re-add without a real implementation
- Nav label: "הוצאות" — do not revert to "עסקאות" or "תנועות"
- `buildCategoryGroups()` in TransactionsPage.tsx is the single grouping source of truth

## Transactions / Income Responsibility Split (locked 2026-04-03)
- Transactions = movement browsing/management — expense and transfer only for creation/editing
- Income creation = IncomesPage only (`/incomes`) — never available in Transactions drawer
- Income rows ARE displayed in Transactions (read-only; delete allowed; edit redirects to IncomesPage)
- Transactions grouped display order (fixed): הכנסות → העברות → הוצאות
- Within expense section: grouped by category, each group shows total; groups sorted by total desc
- `buildGroupedSections()` in TransactionsPage.tsx is the single grouping source of truth
- This split is locked — do not re-add income creation to the Transactions drawer

## Account Type Change — Single Source (locked 2026-04-03)
- Account type (`accounts.type`) can only be changed from the **תוכנית שימוש** (Usage/Plan) tab in Settings
- Account Structure tab is display-only for account type — shows current type + directs owner to Usage/Plan tab
- `handleSavePlan` in SettingsPage is the single write path: updates localStorage + `accounts.type` DB in one action
- Downgrade guard (personal ← couple/family): blocked if `members.length > 1`; error message directs user to remove members in Account Structure first
- The old `handleChangeAccountType` handler has been removed; Account Structure tab no longer mutates `accounts.type`

## Billing & Subscription (locked 2026-04-03, provider updated 2026-04-03)

### Web billing provider: Tranzila
- Tranzila is the active web billing provider (Israeli payment processor, ILS)
- Provider pivot from Stripe was made: Israeli market focus, ILS-native, no foreign payment processor dependency
- Stripe functions remain deployed but are not the active web billing path — `billing.ts` no longer calls them
- Future mobile billing (App Store / Google Play) is separate and handled by native billing handlers — same `account_subscriptions` table, different `provider` value

### Source of truth hierarchy
1. `accounts.type` — authoritative for **household structure** and **feature access** (personal / couple / family). Never altered by billing state.
2. `account_subscriptions.plan` — billing tier only. Must mirror `accounts.type`. Divergence is a UI warning, not a data corruption.
3. `account_subscriptions.status` — payment state only (active / trialing / past_due / canceled …). In Phase 1, ignored for feature gating.

### Rules
- `accounts.type` is always the source of truth for `useAccountFeatures` — no billing state ever consulted there
- `account_subscriptions.plan` must equal `accounts.type` for active/trialing subscriptions — `isSubscriptionSynced()` detects drift and surfaces a warning in Settings
- `getEffectiveAccountType()` is the single enforcement point for feature gating — Phase 1 returns `accountType` as-is; Phase 2 will downgrade on `canceled + period_end_passed`
- `checkoutPlan` in SettingsPage always initialises to `planForAccountType(accountType)` — never a hardcoded default
- Billing is account-level (not user-level) — one `account_subscriptions` row per `account_id`
- Only `tranzila-notify` (service role) writes to `account_subscriptions` — no client INSERT/UPDATE
- Billing is strictly separated from `payment_sources` (different table, different UI section, different copy)
- Raw card data is never stored — Tranzila's hosted page handles all card entry (PCI-compliant)

### Phase 2 enforcement (not yet active)
When billing enforcement is enabled, `getEffectiveAccountType()` will downgrade effective type to `'personal'` for:
- `status === 'canceled'` AND `current_period_end` has passed
- `status === 'past_due'` AND grace period has elapsed
All feature-gating code must call `getEffectiveAccountType()` — never read `subscription.status` directly in components.

## Rejected Alternatives
- Separate income/expense tables — rejected (single movements table)
- Owner inference from payment source for attribution — rejected (explicit user choice only)
- Attribution FK to account_members — rejected (plain text type safer for legacy)
- Hardcoded member names "מתן/נוי" — rejected (dynamic from members array)
- `accounts.type` driven by billing plan — rejected (`accounts.type` is structural, billing is a separate tier)
- Client-side subscription writes — rejected (service role / notify callback only for billing state)
- Stripe as web billing provider — rejected (pivoted to Tranzila for Israeli market / ILS-native)
