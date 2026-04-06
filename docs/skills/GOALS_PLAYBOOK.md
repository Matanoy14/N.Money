# Skill: Goals Playbook

Use when planning, implementing, or auditing the Goals module (`src/pages/GoalsPage.tsx`).

---

## 1. Purpose

The Goals module lets users define, track, and work toward savings goals (e.g., emergency fund, vacation, car).

This playbook is for:
- Planning the Goals real implementation (replacing mock data)
- Safe implementation of the `goals` DB table, CRUD, and progress logic
- Preventing a sloppy "wire mock to DB" approach that violates project data principles
- Ensuring Budget and Dashboard integration points are handled correctly when goals ships

---

## 2. Current Project Reality

### What is currently real
- UI shell exists: `src/pages/GoalsPage.tsx` renders goal cards, a summary strip, and an add modal
- Goal card layout, progress bars, priority badges, and stats row are all UI-complete
- `formatCurrency` is used correctly
- Page is navigable and does not crash

### What is currently FAKE (mock only)
- `goalsData` is a **hardcoded array** of 4 goals with real-looking Hebrew names and ₪ amounts
- `savedAmount` for each goal is a hardcoded number — not derived from any real transaction or input
- `monthlyContribution` per goal is a hardcoded number — not stored anywhere
- `totalSaved`, `totalTarget`, `totalMonthly` — all computed from the fake array
- The "add" modal collects name/target/monthly/date but **the save button only closes the modal** — no save, no insert, no state update
- The motivational tip card contains hardcoded Hebrew copy about a specific goal ("קרן החירום שלך") — this is fake and personalization-pretending
- The `Goal` interface uses `id: number` — incompatible with Supabase UUID primary keys
- No `useAccount`, no `useAuth`, no Supabase calls anywhere in the file

### What is NOT yet decided (product decisions that must be locked before implementation)
These are open questions. Do not implement without explicit answers:

1. **How is `savedAmount` determined?**
   - Option A: User manually enters the current saved balance → simple, but imprecise and requires trust
   - Option B: User logs contributions manually (dedicated `goal_contributions` table) → auditable but more UI work
   - Option C: Goals are linked to tagged `financial_movements` (income/transfer rows tagged with a `goal_id`) → most accurate, most complex
   - **This decision is unresolved. Do not implement until locked.**

2. **What is `monthlyContribution`?**
   - User-entered intent (a plan), or derived from actual contributions?
   - If derived, from which table and which field?

3. **Are `icon` and `color` user-selectable or auto-assigned from a fixed set?**

4. **Is `priority` user-set, or system-derived from target date / gap?**

5. **What is the motivational tip mechanism?** Hardcoded? Rule-based? AI-generated?

### Known violation of project principles
GoalsPage currently violates the product rule: **"No mock, placeholder, or fake financial data in any production screen."**
This is **explicitly acknowledged** in `docs/PRODUCT_DECISIONS.md`: "Goals module (`GoalsPage.tsx`) is 100% mock data. No real Supabase table exists for goals."

This violation is accepted as a temporary state — it must be resolved in the Goals implementation pass.

---

## 3. Architecture / Data Flow

### Locked product decisions (from `docs/PRODUCT_DECISIONS.md`)
- Goals = **planning layer ABOVE the budget** — not a budget category
- Goals must NOT be mixed with Loans in any UI section
- Budget whisper CTA already exists: `"🎯 יעדי חיסכון — בקרוב תוכל להקצות כאן חלק מהתקציב לטובת יעדים"` — this is a placeholder, not live goals data
- When goals ships: goals allocation appears as a **dedicated section above the category grid** in BudgetPage, NOT inside the hero card
- Do NOT surface goals numbers in Budget until the real DB table is connected and live
- Budget hero card goals whisper is wrapped in `{hasContent && ...}` — guard must stay

### Expected DB table shape (proposed, not confirmed)
```
goals
  id          uuid PK
  account_id  uuid NOT NULL → accounts
  user_id     uuid NOT NULL → auth.users
  name        text NOT NULL
  icon        text nullable (emoji or identifier)
  color       text nullable (hex)
  target_amount  numeric NOT NULL
  saved_amount   numeric NOT NULL DEFAULT 0  ← manual balance OR derived
  monthly_contribution numeric nullable      ← planned amount
  target_date    date nullable
  priority       text nullable (high/medium/low)
  status         text NOT NULL DEFAULT 'active' (active/completed/abandoned)
  created_at  timestamptz NOT NULL DEFAULT now()
```

**⚠️ This is a proposed shape only. It must be confirmed before writing any migration.**
If `savedAmount` is contribution-based (Option B), a separate `goal_contributions` table will also be needed.

### Integration points that must be respected
| Module | Current state | Required action when goals ships |
|--------|--------------|----------------------------------|
| BudgetPage | Whisper CTA only, wrapped in `{hasContent && ...}` | Replace whisper with real goals allocation section above the category grid. Do NOT surface mock numbers before DB is live. |
| DashboardPage | No goals widget currently | Any Dashboard goals widget requires a product decision first — see DASHBOARD_ANALYTICS_PLAYBOOK |
| GoalsPage | 100% mock | Full rewrite required — see implementation rules below |

---

## 4. Safe-Change Rules

### Do not do before the unresolved decisions above are locked
- Do not design the DB schema until `savedAmount` mechanism is confirmed
- Do not write any migration until schema is confirmed
- Do not implement contribution tracking until the model (Option A/B/C) is chosen
- Do not add goals numbers to BudgetPage or Dashboard until the real table is live

### Do not do at all
- Do not leave any hardcoded goal name, amount, or target date in the production screen
- Do not keep `goalsData` constant — replace entirely
- Do not keep `id: number` in the interface — must be `id: string` (UUID)
- Do not use a centered modal for the add/edit panel — use the consistent slide-in panel (`fixed top-0 right-0 lg:right-[240px]`, `slideInRight 0.25s`) per project pattern
- Do not re-add the motivational tip card with hardcoded copy — if it returns, it must use real computed data
- Do not mix goals and loans in any UI section — locked product decision

### Regression traps
- BudgetPage `{hasContent && <GoalsWhisper />}` guard: ensure this condition remains correctly gated so mock goals data never leaks into Budget
- If a `goal_id` foreign key is added to `financial_movements`, confirm backward compat (nullable) per DB_CHANGE_PLAYBOOK Path A rules
- Any `savings_goal_pct` from localStorage (currently used by Dashboard health score) is a **separate concept** from Goals — it is a user-configured savings rate target, not a goal item. Do not conflate or merge these two things.

---

## 5. Implementation Checklist

Use this when implementing the Goals real feature:

### Pre-implementation (required before writing any code)
- [ ] Lock the `savedAmount` mechanism (Option A / B / C) — explicit product owner decision
- [ ] Lock `monthlyContribution` model (planned intent vs derived from transactions)
- [ ] Lock `icon` and `color` model (user-selectable set vs free emoji input vs auto-assign)
- [ ] Lock `priority` model (user-set vs system-derived)
- [ ] Confirm final DB schema
- [ ] Read DB_CHANGE_PLAYBOOK Path B before writing migration
- [ ] Confirm whether a `goal_contributions` table is needed

### DB migration
- [ ] Write migration per DB_CHANGE_PLAYBOOK Path B (new table, with RLS)
- [ ] RLS: account-scoped (`account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())`)
- [ ] Add to DATA_MODEL.md
- [ ] Add to MODULE_STATUS.md

### GoalsPage rewrite
- [ ] Remove `goalsData` constant entirely
- [ ] Remove hardcoded motivational tip card (or replace with real computed logic)
- [ ] Add `useAccount` and `useAuth` — all queries scoped to `accountId`
- [ ] Add `loading` state → spinner
- [ ] Add `error` state → red banner
- [ ] Add true empty state → icon + message + "הוסף מטרה" CTA
- [ ] Replace add modal with slide-in panel matching project pattern (`fixed top-0 right-0 lg:right-[240px]`, `slideInRight 0.25s ease`)
- [ ] Save button in panel actually inserts to Supabase
- [ ] Edit flow: opens panel pre-filled, updates DB
- [ ] Delete: with confirmation or optimistic update
- [ ] `Goal` interface: `id: string` (UUID), all DB columns nullable where appropriate
- [ ] `savedAmount` reflects the locked model (manual entry, contributions total, or tagged movements)
- [ ] `totalSaved`, `totalTarget`, `totalMonthly` computed from real DB data
- [ ] Progress bar: `Math.min(100, Math.round(savedAmount / targetAmount * 100))` — cap at 100%
- [ ] `monthsLeft` uses real `target_date` from DB — `null`-safe (hide if no target date)
- [ ] Priority badge: only show if `priority` is non-null
- [ ] `npx tsc --noEmit` clean

### Cross-module
- [ ] BudgetPage: do NOT wire goals data until explicitly requested — whisper CTA remains as-is
- [ ] Dashboard: do NOT add goals widget until product decision made
- [ ] Confirm `nmoney_savings_goal_pct` localStorage key is untouched (separate concept)

### Documentation
- [ ] Update MODULE_STATUS.md: Goals section
- [ ] Update DATA_MODEL.md: `goals` table definition
- [ ] Update PRODUCT_DECISIONS.md: lock the `savedAmount` mechanism decision
- [ ] Update CHANGELOG.md

---

## 6. Reporting Expectations

A good Goals implementation report must explicitly mention:
- Which `savedAmount` model was chosen and why
- Whether a `goal_contributions` table was created (and why / why not)
- That `goalsData` hardcoded array was fully removed
- That the motivational tip card was handled (removed or replaced with real logic — state which)
- That the add/edit panel uses the slide-in pattern (not a centered modal)
- That BudgetPage whisper CTA was left unchanged
- RLS policy on the `goals` table
- tsc status
- What the empty state looks like
