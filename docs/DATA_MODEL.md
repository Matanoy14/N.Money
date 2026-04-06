# Data Model

## Core Tables

### `users` (Supabase Auth managed)
Managed by Supabase. `id` = UUID = auth UID.

### `user_profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.uid() |
| display_name | text | |
| employment_type | text | |
| onboarding_completed | bool | default false |
| profiling_answers | jsonb | 8 onboarding Q&A |
| preferred_input_method | text | manual/voice/chat/mixed |

### `accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| type | text | personal/couple/family |

### `account_members`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | |
| user_id | uuid FK → users | |
| role | text | owner/partner/child |

### `financial_movements` (canonical transaction table)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| account_id | uuid | |
| date | date | YYYY-MM-DD |
| description | text | |
| type | text | income/expense/transfer |
| category | text | category id or 'income'/'transfer' |
| sub_category | text nullable | |
| payment_method | text | credit/transfer/cash/bit/standing |
| payment_source_id | uuid nullable | FK → payment_sources |
| amount | numeric | always positive |
| status | text | actual/planned |
| source | text | manual/recurring/import |
| notes | text nullable | |
| attributed_to_type | text nullable | member/shared — expenses only |
| attributed_to_member_id | uuid nullable | account_members.user_id |
| expected_amount | numeric nullable | expected income amount; null = no expectation; one-time income rows only |
| recurring_income_id | uuid nullable | FK → recurring_incomes(id) ON DELETE SET NULL; set when movement is a confirmed arrival for a recurring template; added 2026-04-06 |

### `recurring_expenses`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid | |
| user_id | uuid | |
| description | text | |
| amount | numeric | |
| category | text | |
| payment_method | text | |
| payment_source_id | uuid nullable | |
| billing_day | int | 1–31 |
| interval_unit | text | day/week/month/year |
| interval_value | int | e.g. 1 = monthly, 2 = bimonthly |
| max_occurrences | int nullable | null = unlimited |
| start_date | date | |
| is_active | bool | |
| sub_category | text nullable | added 2026-04-03 |
| attributed_to_type | text nullable | member/shared — added 2026-04-03 |
| attributed_to_member_id | uuid nullable | account_members.user_id — added 2026-04-03 |

### `recurring_confirmations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid | |
| recurring_id | uuid FK → recurring_expenses | |
| month | date | always YYYY-MM-01 |
| status | text | confirmed/skipped |
| movement_id | uuid nullable | FK → financial_movements |
| UNIQUE | (recurring_id, month) | |

### `recurring_incomes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | CASCADE |
| user_id | uuid FK → auth.users | CASCADE |
| description | text NOT NULL | |
| income_type | text nullable | one of the 7 INCOME_TYPES (stored in this column, not sub_category) |
| amount | numeric NOT NULL | monthly expected amount |
| expected_day_of_month | int nullable | 1–31; shown as hint on card |
| payment_method | text NOT NULL | default 'transfer' |
| payment_source_id | uuid nullable | FK → payment_sources |
| attributed_to_type | text nullable | member/shared — couple/family only |
| attributed_to_member_id | uuid nullable | account_members.user_id |
| notes | text nullable | |
| is_active | bool NOT NULL | default true; deactivate = soft pause |
| created_at | timestamptz NOT NULL | default now() |

RLS: account_members policy — all account members can read/write their account's templates.
Migration: `supabase/migrations/20260405_recurring_incomes.sql` (confirmed in Supabase 2026-04-05).

### `recurring_income_confirmations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | CASCADE |
| recurring_id | uuid FK → recurring_incomes | CASCADE |
| month | date | always YYYY-MM-01 |
| status | text | confirmed/skipped — CHECK constraint enforced |
| movement_id | uuid nullable | FK → financial_movements ON DELETE SET NULL |
| created_at | timestamptz NOT NULL | default now() |
| UNIQUE | (recurring_id, month) | one row per template per month |

RLS: account_members policy — same pattern as recurring_incomes.
Indexes: (account_id, month) for Phase 2 monthly fetch; (recurring_id) for cascade lookups.
Migration: `supabase/migrations/20260406_incomes_v2_phase1.sql` — **must be run in Supabase SQL editor**.

### `payment_sources`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| account_id | uuid | |
| name | text | user-defined label |
| type | text | credit/bank/transfer/bit/paybox/cash |
| color | text | hex string |
| is_active | bool | soft delete |

### `budgets`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid | |
| month | date | YYYY-MM-01 |
| category | text | category id |
| amount | numeric | monthly budget |

### `assets`
needs confirmation — schema not inspected this session

### `loans`
needs confirmation — schema not inspected this session

### `goals`
needs confirmation — schema not inspected this session

---

## Relationships
- One user → one account_member row → one account
- One account → many financial_movements
- One account → many recurring_expenses → many recurring_confirmations
- One account → many recurring_incomes (templates; no confirmation table yet — Stage 4)
- recurring_confirmation.movement_id → financial_movements (when confirmed)
- financial_movements.payment_source_id → payment_sources (nullable)

## Canonical vs Derived
- `financial_movements` = canonical source of truth for all money data
- Dashboard KPIs = derived (sum/filter of movements)
- Category totals = derived
- Health score = derived formula (see DASHBOARD_AND_ANALYTICS.md)
- Confirmed counts for recurring = derived (count confirmations per recurring_id)

## Legacy Compatibility
- `payment_method` may contain old Hebrew strings or old type names → `PM_ALIASES` in `paymentMethods.ts` handles these
- `category` in recurring_expenses may contain Hebrew strings (e.g. 'בית ודיור') → `CATEGORY_ALIASES` in `categories.ts`
- `recurring_expenses.frequency` (old field) → `derivePreset()` fallback in FixedExpensesPage
