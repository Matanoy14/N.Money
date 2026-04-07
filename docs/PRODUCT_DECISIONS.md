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

## Voice Input (updated 2026-04-03)
- Full feature: Hebrew SpeechRecognition → voiceParser → form population
- `lang='he-IL'`, `interimResults=true`, instance created inside `startRecording`
- No auto-save — user reviews and edits all fields before saving
- Preview bar ("מה הבנתי:") shows parsed amount, category, date chips — dismissible
- Unsupported browsers (Firefox): greyed disabled button with tooltip
- Voice button shown in add mode only — hidden during edit

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
> ⚠️ *Superseded by "Unified Expenses Module" above. Core rules (type filtering, voice guard, nav label) still apply. File references below are stale: `TransactionsPage.tsx` is now a redirect stub — active logic lives in `src/pages/ExpensesPage.tsx` and `src/components/expenses/VariableExpensesTab.tsx`.*
- `/transactions` route is the **Expenses module** — expense CRUD only
- DB query filters `type = 'expense'` — income and transfer rows are never fetched or displayed here
- Transfers: managed nowhere in the current UI (no dedicated transfers page); transfer movements exist in DB but are not surfaced
- Income: managed in IncomesPage (`/incomes`) only
- Voice input stub: removed — do not re-add without a real implementation
- Nav label: "הוצאות" — do not revert to "עסקאות" or "תנועות"
- `buildCategoryGroups()` in TransactionsPage.tsx is the single grouping source of truth

## Transactions / Income Responsibility Split (locked 2026-04-03)
> ⚠️ *Superseded by "Unified Expenses Module" above. Income-creation-in-Expenses rule still locked. `buildGroupedSections()` reference below is stale — ExpensesPage no longer has a combined grouped display.*
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

## Expense Analysis — Type Filter (updated 2026-04-03)
- Type filter options: **"הכל"**, **"משתנות"**, and **"קבועות"** — all three active
- "הכל" mode: KPI = variable movements + recurring projection (labeled clearly). Shows fixed summary card + variable donut. Full picture of the month.
- "משתנות" mode: financial_movements (type=expense) for the month only. Charts, breakdowns, drill-down all from movements.
- "קבועות" mode: recurring_expenses (active templates, projected monthly). Shows KPI, category donut, obligations list, attribution breakdown. Does NOT show an info state — shows real recurring data.
- Old decision (info state for קבועות) is superseded: recurring data is now surfaced directly from the `recurring_expenses` table. No movement-level type flag is needed for this approach.
- Payment filter is hidden in "קבועות" mode (not applicable at template level).

## Budget Module — Goals vs Loans Semantic Distinction (locked 2026-04-03)
- **Goals / targets** = a planning layer ABOVE the budget. The concept: before allocating flexible budget, decide how much goes toward savings goals. This is a planning/intent concept, not a budget category.
- **Loans / obligations** = confirmed monthly expenses. A loan payment belongs INSIDE the category budget grid just like food or transportation. Loans are NOT a planning-layer concept and must NOT appear in any goals/planning section.
- The budget UI may show a goals awareness preview (upcoming feature). It must NEVER mix goals and loans in the same UI section.
- Goals awareness lives as a whisper line inside the hero card (Row 2, below KPIs + donut). Label: "🎯 יעדי חיסכון — בקרוב תוכל להקצות כאן חלק מהתקציב לטובת יעדים".
- There is no separate "תכנון חודשי" card. It was removed because it mixed semantics and looked like dead UI.
- When goals feature ships: goals allocation will appear as a dedicated section above the category grid, not as a placeholder inside the hero card.

## Budget Trends — Period Selector Options (locked 2026-04-04)
- Four options: **3 חודשים** | **6 חודשים** | **12 חודשים** | **מתחילת השנה**
- "מתחילת השנה" = calendar year-to-date: January 1 of the year containing the selected month through the selected month. Dynamic length (1–12 months depending on selected month).
- "12 חודשים" = rolling 12-month window — do NOT conflate with YTD.
- Both options must remain independent. Do not merge or alias them.

## Budget Module — Category Sort Order (locked 2026-04-03)
- Sort strategy: `sortCategoriesV2()` — overrun categories first (sorted by overrun amount desc), then non-overrun sorted by semantic group order, then by utilization desc within the same group.
- Semantic group order (matches EXPENSE_CATEGORIES IDs in `categories.ts`): housing(0) → food(1) → entertainment(2) → transport(3) → communication(4) → health(5) → education/children/fitness(6) → clothing/grooming(7) → travel(8) → insurance/pets/gifts(9) → other(10).
- Group map is defined in `CATEGORY_GROUP_ORDER` constant at top of BudgetPage.tsx.
- Do not revert to pure utilization sort.

## Expense Analysis — Trends Projection Label (locked 2026-04-03)
- The fixed-expense bar in the Trends stacked bar chart is labeled **"קבועות (צפי)"** — not "קבועות"
- Rationale: the fixed value is a projection (current active recurring templates × monthly equivalent), not actual confirmed spend. It does not account for template changes mid-period.
- The "(צפי)" suffix makes the estimation nature explicit in both the legend and tooltip.
- Do not remove "(צפי)" — it is a honesty decision, not a cosmetic label.

## Budget Module — Hero Layout (superseded — see Hero Composition below)

## Budget Module — Loans Monthly Payment Integration (locked 2026-04-03, updated 2026-04-03)
- Active loans monthly payment total is fetched directly from the `loans` table (`status = 'active'`, `monthly_payment` column summed).
- `Loan` type has no `category` field → loans cannot map to budget categories → Option B (synthetic card).
- Rendered as a **dedicated card inside the category grid**, appearing first (before all sortedCategories). Only visible when `totalLoanPayments > 0`.
- Card has: header ("תשלומי הלוואות" + "מחויב" badge), amount row ("תשלום חודשי מחויב" + formatted total), footer (link to /loans + "ללא גבול תקציב").
- No progress bar (committed obligation, not a budget limit). No inline edit. Read-only. Links to /loans for management.
- The old flat info row above the grid is removed — the card replaces it entirely.
- Data source: same `loans` table used by LoansPage.tsx. No separate query path.

## Budget Module — Hero Composition (locked 2026-04-04, final values updated 2026-04-04)
- **Equal-thirds is intentionally abandoned.** The equal-thirds approach constrained the donut to 100px in a 101px column — no margin, visual clipping, ring too thin to feel premium.
- Hero card: `py-5`, `rounded-2xl`, `bg-white`, `CARD_SHADOW`. (No horizontal padding on card — padding lives inside each column.)
- **Main row:** `grid` with `style={{ gridTemplateColumns: '1fr 1.7fr 1fr' }}`. Center section 1.7× wider than sides; sides equal.
  - **RTL layout:** JSX col-1 = visual RIGHT (KPI) | JSX col-2 = CENTER (donut) | JSX col-3 = visual LEFT (legend). Do not swap.
  - **KPI section (1fr, visual RIGHT, JSX-first):** `border-l border-gray-200 flex flex-col justify-center px-2 py-4`. Inner: `bg-gray-50 rounded-xl px-2 py-3 space-y-3 text-center border border-[#E5E7EB]`. Three stacked items (תקציב / שימוש בפועל / יתרה|חריגה). Label: `text-[16px] text-gray-400 font-medium`. Value: `text-[18px] font-bold tabular-nums leading-tight`. יתרה green / חריגה red.
  - **Donut section (1.7fr, CENTER, JSX-second):** `border-l border-gray-200 flex flex-col items-center justify-center py-2`. `PieChart width={148} height={148}`, `cx={74} cy={74}`, `innerRadius={44}`, `outerRadius={69}` (5px SVG margin, ring width 25px). Center overlay: "שנוצל" `text-[10px] text-gray-400` + utilization `text-base font-bold text-gray-700`. Hover tooltip: colored pill `name: pct%`. Click: `setSelectedDonutCat` toggle.
  - **Legend section (1fr, visual LEFT, JSX-third):** `py-4 px-2 flex flex-col justify-center`. Inner: `grid grid-cols-2 gap-x-1 gap-y-1.5 text-center`. Each entry: `w-1.5 h-1.5` dot + `text-[14px] text-gray-600 truncate leading-none`. Sorted via `legendData` (semantic group order). No amounts. No +N overflow — all categories visible.
- **Goals whisper:** `border-t border-gray-100 mt-4 pt-3 px-5`, wrapped in `{hasContent && ...}`.

## Budget Module — Goals Integration Status (as of 2026-04-03)
- Goals module (`GoalsPage.tsx`) is 100% mock data. No real Supabase table exists for goals.
- No goals data is integrated into BudgetPage. The goals whisper CTA is an awareness placeholder only.
- When goals DB table ships: goals allocation will appear as a dedicated section above the category grid.
- Do not surface goals numbers anywhere in Budget until the real DB table is connected.

## Incomes Module — Tier 1 Locked Decisions (locked 2026-04-05)

### Income type list (locked — do not change without explicit approval)
- Stored in `sub_category` column on `financial_movements`
- 7 types: **משכורת** | **עצמאי** | **מתנה** | **שכירות** | **מילואים** | **בונוס** | **אחר**
- Old type list (`['משכורת', 'פרילנס', 'שכ״ד', 'השקעות', 'העברה', 'אחר']`) is superseded and removed
- Default type for new income: **משכורת**

### Income attribution
- Same pattern as expense attribution (`attributed_to_type` / `attributed_to_member_id`)
- Guard: shown only when `isCouple || isFamily`
- Real member names from `AccountContext.members[].name` — never hardcoded
- `null` attribution on legacy rows is acceptable — render safely (no crash)
- Default for new income in couple/family: `null` (user must select explicitly)

### Income deposit field ("הופקד לחשבון")
- Field is repurposed from "אמצעי קבלה" / "אמצעי תשלום" — renamed to "הופקד לחשבון"
- Only bank payment sources shown (`payment_sources.type === 'bank'`)
- Fallback when no bank sources: show only `transfer` and `cash` from PAYMENT_METHODS (not credit/bit/paybox)
- `payment_source_id` + `payment_method` DB fields unchanged — only UI semantics change

### Incomes notes display
- Notes visible in drawer (textarea, optional)
- Notes shown as smaller secondary text under description in table and mobile cards
- No separate notes column in the table

### Incomes summary strip
- Lean in Tier 1 — two cards: total amount + count
- No expected/actual split until Tier 2 ships

## Incomes Module — Tier 2 Locked Decisions (locked 2026-04-05)

### Expected vs actual model
- `expected_amount numeric NULL` added to `financial_movements` — single nullable column, Path A migration
- `amount` = actual received (semantics unchanged from all prior tiers)
- `expected_amount` = optional planning metadata; null = no expectation recorded
- No `status = 'planned'` rows for income in Tier 2
- No two-row pairing model, no new table
- `expected_amount` must never be summed as real income in any financial total
- Dashboard reads `amount` only — `expected_amount` is never fetched or counted by Dashboard

### Expected amount validation rule
- Blank input → saved as `null`
- Input = 0 → saved as `null` (guard: `parseFloat(v) > 0 ? parseFloat(v) : null`)
- Input > 0 → saved as that numeric value

### Drawer labels (Tier 2 update) — ⚠️ SUPERSEDED by Unified Screen (2026-04-05)
> The field order below was the original Tier 2 decision. It is formally superseded by the Incomes Unified Screen locked decision (see below). Primary = "סכום צפוי"; secondary = "סכום בפועל (אופציונלי)".
- ~~Existing "סכום" label renamed to "סכום בפועל" (primary)~~
- ~~New optional field added directly below it: "סכום צפוי (אופציונלי)" (secondary)~~
- ~~Expected field is visually secondary to actual field (smaller, not bold)~~

### Table amount display rules (locked)
- `expected_amount = null` → show only `+₪X` (unchanged)
- `expected_amount = amount` → show only `+₪X` (no extra indicator)
- `expected_amount ≠ amount` AND `expected_amount ≠ null` → show `+₪X` primary + `"צפוי: ₪Y"` secondary muted text below
- No separate expected column in the table
- Same two-line logic for mobile cards

### Summary strip (Tier 2 update)
- Existing two cards retained: total actual + count
- Third card added conditionally: only when `incomes.some(i => i.expected_amount !== null)`
- Third card content: `"צפוי ₪X | התקבל ₪Y"` where X = sum of all non-null expected_amount, Y = totalActual
- Grid becomes 3-column when third card shown, 2-column otherwise

## Incomes Module — Stage 3 Locked Decisions (locked 2026-04-05)

### Architecture
- New dedicated table: `recurring_incomes` — income templates only
- Do NOT reuse `recurring_expenses` — fully separate infrastructure, no shared schema
- Do NOT add `is_recurring` flag to `financial_movements` in Stage 3
- No `recurring_income_confirmations` table in Stage 3
- No `recurring_income_id` FK on `financial_movements` in Stage 3

### Scope boundary (Stage 3 = templates only)
- Stage 3 implements: CRUD for `recurring_incomes` templates + template section UI in IncomesPage + summary strip baseline card
- Stage 3 does NOT implement: confirmation flow, auto-generation of `financial_movements` rows, movement linking
- Stage 4 handles: monthly confirmation ("האם הגיעה ההכנסה?"), `recurring_income_confirmations` table, movement creation from templates

### Frequency
- Monthly only in Stage 3 — no `interval_unit` / `interval_value` columns needed
- Weekly / bimonthly / yearly deferred to Stage 4+

### UI placement
- Dedicated section inside `IncomesPage.tsx` — below the monthly movements table
- Not a separate tab, not a separate page
- Section header: **"הכנסות קבועות"**
- Section renders always (empty state + "הוסף הכנסה קבועה" CTA when no templates exist)

### Template fields (Stage 3 schema)
| Field | Type | Notes |
|-------|------|-------|
| `description` | `text NOT NULL` | User-defined label |
| `income_type` | `text NULL` | One of INCOME_TYPES (same locked 7-value list as Tier 1) |
| `amount` | `numeric NOT NULL` | Monthly expected amount |
| `expected_day_of_month` | `int NULL` | 1–31; optional — not all incomes have a fixed day |
| `payment_source_id` | `uuid NULL` | FK → payment_sources; bank sources only (Tier 1 rule) |
| `payment_method` | `text NOT NULL DEFAULT 'transfer'` | Standard default |
| `attributed_to_type` | `text NULL` | member/shared/null — couple/family only |
| `attributed_to_member_id` | `uuid NULL` | |
| `notes` | `text NULL` | Optional |
| `is_active` | `bool NOT NULL DEFAULT true` | Soft delete only — no hard delete |

### Summary strip baseline card
- Card label: **"בסיס הכנסה קבועה"** — do NOT use "צפוי" (conflicts with Tier 2 expected_amount wording)
- Shown only when `recurringIncomes.some(t => t.is_active)` — hidden if no active templates
- Value = `SUM(amount)` of all active templates for the account — this is a standing monthly baseline, not month-scoped
- Appended after existing Tier 1/2 summary cards (becomes card 3 or card 4 depending on Tier 2 card visibility)

### Template actions
- **Add:** "הוסף הכנסה קבועה" button in section header — opens slide panel
- **Edit:** pencil icon per card (hover on desktop, always visible on mobile) — plain edit, no scope modal
- **Deactivate:** toggle per card — sets `is_active = false`; template remains visible in section with muted/inactive styling
- **Reactivate:** same toggle on inactive card — sets `is_active = true`
- **No hard delete** in normal flow

### Edit scope
- Plain full-field edit — no scope modal required
- Stage 3 templates have no confirmed movement history, so retroactive scope is irrelevant
- All template fields are editable at any time

### Dashboard safety (Stage 3)
- Stage 3 does NOT touch `DashboardPage.tsx`
- `recurring_incomes.amount` is NEVER fetched or summed by Dashboard
- Dashboard derives income KPIs from `financial_movements` only — unaffected
- No double-counting risk in Stage 3

### Rejected for Stage 3
- Confirmation flow and `recurring_income_confirmations` table — Stage 4
- Auto-generation of `financial_movements` rows — Stage 4
- `recurring_income_id` FK on `financial_movements` — Stage 4
- Weekly / yearly / custom frequencies — Stage 4+
- Retroactive edit scope modal — not needed until Stage 4 confirmation history exists

## Incomes Module — Unified Screen Locked Decisions (locked 2026-04-05)

### Architecture
- Single unified page: `IncomesPage.tsx` — no split into tabs or sub-pages
- Two data sources rendered in one table container: `recurring_incomes` templates (pinned top section) + `financial_movements` income rows (monthly section below)
- Backend tables remain separate — `financial_movements` and `recurring_incomes` are NOT merged
- Stage 4 compatibility: no confirmation flow, no FK additions, no movement auto-generation in this pass

### Drawer amount field order (supersedes Tier 2 drawer labels decision)
- **Primary field (large input, required):** "סכום צפוי" — the expected income amount the user anticipates receiving
- **Secondary field (small input, optional):** "סכום בפועל (אופציונלי)" — the actual received amount, only entered when it differs from expectation

### Save logic (`amount` + `expected_amount`)
| User input | DB: `amount` | DB: `expected_amount` |
|------------|-------------|----------------------|
| Expected only (actual blank) | `expected_value` | `null` |
| Expected = Actual (same value in both) | `actual_value` | `null` |
| Expected ≠ Actual (both filled, different) | `actual_value` | `expected_value` |

- `amount` is the fallback for Dashboard (never null). When no actual is recorded, amount = expected value.
- `expected_amount = null` means "no discrepancy" — covers both "no expectation set" and "expectation exactly met."

### Edit load logic (drawer re-open)
| Row state | "סכום צפוי" field | "סכום בפועל" field |
|-----------|-------------------|---------------------|
| `expected_amount = null` | `income.amount` | empty |
| `expected_amount ≠ null` | `income.expected_amount` | `income.amount` |

### Table amount display
- Single "סכום" column — no separate expected column
- Actual income rows: `+{formatCurrency(amount)}` (green, bold) + conditional muted secondary line `"צפוי: ₪{expected_amount}"` when `expected_amount ≠ null AND expected_amount ≠ amount`
- Recurring template rows: `{formatCurrency(amount)} / חודש` (blue) — no secondary line

### Filter model
- All filters are multi-select with AND composition
- Filtering is client-side — no re-fetch per filter change
- "neither selected = show all" rule for all multi-select filters (prevents empty-table state)

| Filter | Default | Applies to |
|--------|---------|-----------|
| חיפוש חופשי (text) | Empty | Both row types |
| סוג שורה (חד-פעמי / קבוע) | Both selected | Controls which groups are visible |
| סוג הכנסה (7 types) | All selected | Both row types |
| שיוך | All selected | Both — hidden on personal accounts |
| הופקד לחשבון | All selected | Both row types |
| סטטוס (פעיל / לא פעיל) | Both selected | Template rows only |

### "סוג שורה" multi-select behavior
- "חד-פעמי" only → monthly movements group visible; template group hidden
- "קבוע" only → template group visible; movements group hidden; month selector dimmed
- Both / neither → full unified table visible

### "סטטוס" multi-select behavior
- Applies to template rows only — actual income rows are unaffected
- "פעיל" only → active templates only
- "לא פעיל" only → inactive templates only
- Both / neither → all templates visible
- Dimmed (not applicable) when "סוג שורה" = "חד-פעמי" only

### Summary strip (Option B — always unfiltered)
- Strip always reflects unfiltered month + account totals — not affected by active filters
- "הכנסות החודש" card: sum of ALL actual rows for selected month regardless of filter
- "תנועות" card: count of ALL actual rows for selected month regardless of filter
- "צפוי vs התקבל" card: computed from ALL actual rows with `expected_amount` set regardless of filter
- "בסיס הכנסה קבועה" card: computed from ALL active templates regardless of filter (including status filter)
- Rationale: the strip is a financial status panel, not a browsing panel — filters affect the table view only

### Month navigation
- Month selector is a scope control (controls `fetchIncomes` query), not a filter chip in the filter bar
- Open-ended: backward and forward navigation — no artificial boundary
- Dimmed with tooltip when "סוג שורה" = "קבוע" only (templates are not month-scoped)
- Multi-month analytics deferred to a future analytics pass — not part of this unified screen

---

## Incomes Module — V2 Locked Decisions (locked 2026-04-06)
> ⚠️ *The architecture section below (two distinct sections) is **superseded** by "Incomes Module — Unified Control Center (locked 2026-04-07)". The schema additions (Phase 1 migration, confirmation model) and delete guard remain valid.*

### Architecture (supersedes "Unified Screen" decisions above where contradicted)
> ⚠️ *Superseded by Unified Control Center (2026-04-07). A single unified table replaces the two-section model.*
- ~~Two distinct visual sections, not one mixed tbody: "הכנסות קבועות" (templates) + "הכנסות חד-פעמיות" (one-time actuals)~~
- One-time section fetches only `recurring_income_id IS NULL` rows (enforced after Phase 1 schema is live)
- Recurring arrival movements (`recurring_income_id IS NOT NULL`) belong to the template section only — never shown in one-time section

### Monthly status model for recurring templates
- Each active template has a per-month status: **מצופה** (no confirmation row) / **הגיע** (confirmed, movement_id set) / **לא הגיע** (skipped, no movement_id)
- Status computed from `recurring_income_confirmations` table — UNIQUE(recurring_id, month)
- `month` column always stored as YYYY-MM-01 (first of month)

### Table column model (V2 — supersedes Unified Screen column decision)
- Recurring section: סוג הכנסה | תיאור | [שיוך] | יום צפוי | **סכום צפוי** | **סכום בפועל** | סטטוס | פעולות
- One-time section: תאריך | תיאור | [שיוך] | הופקד לחשבון | **סכום** (single column) | פעולות
- expected_amount on financial_movements applies to one-time rows only; for recurring arrivals, the expected amount is the template.amount

### Filter bar (V2 — supersedes Unified Screen filter model)
- Collapsed by default: search input + "סינון" button with active-count badge
- Expanded: סוג הכנסה (multi-select, 7 types) + שיוך (multi-select, couple/family only)
- Removed: סוג שורה, הופקד לחשבון, סטטוס filters
- Inactive templates: hidden by default; "הצג לא פעילות" toggle inside recurring section

### Add entry point (V2)
- Single "הוסף הכנסה" primary button — opens choice drawer: "הכנסה חד-פעמית" / "הכנסה קבועה (תבנית)"
- No two separate top-bar buttons

### Delete for recurring templates (V2)
- Hard delete allowed with confirmation guard: "האם למחוק את התבנית לצמיתות?"
- Deactivate (soft pause) remains available separately

### Analytics (V2 — supersedes current analytics section)
- Primary chart: expected vs actual by month (recurring baseline + actual received, grouped bars)
- Secondary charts (type breakdown, attribution): behind "ניתוח מורחב" toggle, collapsed by default
- Removed: standalone "actual income by month" bar chart; חודש שיא/שפל KPI cards

### Schema additions (Phase 1 — migration 20260406_incomes_v2_phase1.sql)
- `financial_movements.recurring_income_id uuid NULL FK → recurring_incomes(id) ON DELETE SET NULL`
- `recurring_income_confirmations` table with CHECK (status IN ('confirmed','skipped')), UNIQUE(recurring_id, month), RLS enabled

### What must NOT be automated yet
- Auto-generation of financial_movements rows from templates without user confirmation
- Retrospective backfill of confirmation rows for months before Phase 1 shipped

---

## Incomes Module — Unified Control Center (locked 2026-04-07)
> ⚠️ This section **supersedes** "Incomes Module — V2 Locked Decisions (locked 2026-04-06)" on architecture, table columns, filter model, summary strip, and analytics. The V2 Phase 1 schema additions (recurring_income_id FK, recurring_income_confirmations table), delete guard, and confirmation model remain valid and are not superseded.

### Architecture
- Single unified income management page: `IncomesPage.tsx`
- **One unified table** — not two separate sections; recurring templates and income movements share the same table
- Three income natures (אופי ההכנסה):
  - **קבועה** — automatically continues into future months; backed by a `recurring_incomes` template
  - **משתנה** — recurring in nature (same income source month to month) but amount may vary (e.g. salary, freelance retainer); NOT backed by a template
  - **חד-פעמית** — non-recurring, one-off income; does not continue into future months
- Backend tables remain separate — `financial_movements` and `recurring_incomes` are NOT merged

### Single "הוסף הכנסה" CTA
- One primary add button: "הוסף הכנסה"
- Opens choice drawer with three options: **קבועה** | **חד-פעמית** | **משתנה**
- קבועה → template drawer (recurring_incomes); חד-פעמית / משתנה → movement drawer (financial_movements)

### Unified table columns (supersedes V2 two-column-set model)
| # | Column | Notes |
|---|--------|-------|
| 1 | שם ההכנסה | All rows |
| 2 | סוג הכנסה | All rows (7 types from Tier 1) |
| 3 | שיוך | All rows — hidden on personal accounts |
| 4 | אופי ההכנסה | All rows (קבועה / משתנה / חד-פעמית) |
| 5 | סטטוס | All rows (התקבל / לא התקבל / ממתין) |
| 6 | תאריך | All rows |
| 7 | יעד הפקדה | All rows (bank deposit target) |
| 8 | סכום צפוי | All rows |
| 9 | סכום בפועל | All rows |
| 10 | הערות | All rows |
| 11 | פעולות | All rows |

### Filter model (supersedes V2 filter bar decision)
- **Compact bar:** search input always visible + "סינון" button with active-filter count badge
- **Collapsible panel** (expanded on "סינון" click): 4 filter groups:
  1. **סוג הכנסה** — multi-select, 7 types (Tier 1 list)
  2. **שיוך** — multi-select; hidden on personal accounts
  3. **אופי ההכנסה** — multi-select: קבועה / משתנה / חד-פעמית
  4. **סטטוס** — multi-select: התקבל / לא התקבל / ממתין
- "neither selected = show all" rule applies to all multi-select filters
- Filters are client-side only — no re-fetch per filter change

### Summary strip (supersedes all prior summary strip decisions for the Incomes module)
Four elements always shown:
1. **סכום צפוי** — sum of all expected income for the month
2. **סכום בפועל** — sum of all actual received income for the month
3. **פער** — צפוי minus בפועל
4. **Pie chart** — actual income broken down by type (compact)

### Analytics (supersedes V2 analytics decisions)
- **Keep:** expected vs actual chart (primary — grouped bars, monthly)
- **Remove:** standalone monthly actual bar chart; חודש שיא/שפל KPI cards; type-composition list; attribution-composition list
- Analytics section remains collapsed/secondary — not the primary page focus

### Page hierarchy
1. Summary strip (top)
2. Compact filter bar (search + "סינון" button + collapsible panel)
3. Unified table
4. Analytics section (collapsed by default)

---

## Rejected Alternatives
- Separate income/expense tables — rejected (single movements table)
- Owner inference from payment source for attribution — rejected (explicit user choice only)
- Attribution FK to account_members — rejected (plain text type safer for legacy)
- Hardcoded member names "מתן/נוי" — rejected (dynamic from members array)
- `accounts.type` driven by billing plan — rejected (`accounts.type` is structural, billing is a separate tier)
- Client-side subscription writes — rejected (service role / notify callback only for billing state)
- Stripe as web billing provider — rejected (pivoted to Tranzila for Israeli market / ILS-native)
