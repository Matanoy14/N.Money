# N.Money — Master Context

## Product Overview
Hebrew-language personal finance management app. RTL throughout. Clean, premium, trustworthy.
Target users: Israeli households — individuals, couples, and families.

## Stack
| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router DOM v7 |
| Charts | Recharts v3 |
| Backend | Supabase JS v2 (auth + postgres + RLS) |

## Account Types
- `personal` — single user, no attribution features
- `couple` — 2 members, expense attribution enabled
- `family` — 2+ members, expense attribution enabled

Stored in `accounts.type`. Affects: ExpenseAnalysis attribution filters, TransactionsPage attribution field, future income attribution.

## Core Product Principles
1. Real data only — no mock, placeholder, or fake financial data in any production screen
2. Auth must work — sign up, login, logout, token refresh, all stable
3. Editable data flows — every user-visible record is editable unless explicitly read-only
4. Hebrew copy is natural and concise — not translated from English
5. Premium, clean, trustworthy — minimal clutter, intentional hierarchy
6. RTL is non-negotiable — every layout, panel, alignment must respect RTL

## Core UX Principles
- Sidebar on RIGHT (desktop), slides from right (mobile drawer)
- Add panels slide from right in RTL (some current panels are left — known gap)
- Blue `#1E56A0` is the primary action color
- Background: `#F0F4FA` (page), `#0B1F4A` (sidebar)
- Card shadow: `0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)`
- Empty states always have an icon + message + CTA where applicable

## Source-of-Truth Hierarchy
1. Current filesystem (`src/`) — always primary
2. This docs folder — secondary, reflects known current state
3. `CHATGPT_TRANSFER_NMONEY.md` — historical background only, may be outdated
4. Never invent product decisions not explicitly made

## Legacy Files in /docs (Historical Only)

The following files predate the current docs system. They have `⚠️ HISTORICAL` headers. Do NOT use them as ground truth — they describe old state (old table names, mock data, incomplete sprints):
- `data-model-spec-v1.md` → use DATA_MODEL.md
- `implementation-roadmap-v1.md` → use MODULE_STATUS.md + SPRINT_BACKLOG.md
- `dashboard-spec-v1.md` → use DASHBOARD_AND_ANALYTICS.md
- `product-spec-v1.md` → use this file + PRODUCT_DECISIONS.md
- `taxonomy-v1.md` → use TAXONOMY.md + src/lib/categories.ts
- `onboarding-spec-v1.md` → OnboardingPage is complete; no current action needed

## How Work With Claude Should Be Done
- Always read target files before modifying
- Make targeted edits, not rewrites
- Run `npx tsc --noEmit` after every code change session
- Report: what changed / files changed / how to test / gaps remaining
- Mark uncertain items "needs confirmation" rather than guessing
- One module at a time — no scope creep
- See `docs/skills/SAFE_IMPLEMENTATION.md` before any implementation pass
