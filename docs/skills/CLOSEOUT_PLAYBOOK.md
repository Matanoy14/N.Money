# Skill: Closeout Playbook

Use when formally closing out a module, running a QA pass before a stage transition, or determining whether a module is ready to be declared stable.

---

## 1. Purpose

"Closed" has a specific meaning in this project. This playbook defines:
- What the status levels mean
- What must be true before a module is declared closed
- What the closeout workflow looks like in practice
- What documentation must be updated
- How to handle limitations without blocking closure

This playbook does NOT replace `REGRESSION_PASS.md` (which covers post-implementation regression checks) or `MODULE_AUDIT.md` (which covers audit-before-edit). It governs the **decision to formally close a module** and the **docs/handoff obligations** that follow.

---

## 2. Module Status Vocabulary

Use exactly these status designations in `docs/MODULE_STATUS.md`. Do not invent new ones.

| Status | Meaning | Example |
|--------|---------|---------|
| `✅ CLOSED` | Formally audited, all core functionality real and verified, documented limitations accepted, docs synced | Budget, Expenses, Settings |
| `✅ Stable` | Working and real, but not formally audited in a dedicated pass | Auth |
| `✅ Working` | Real data, functional, not formally closed | Incomes, Dashboard |
| `⚙️ Code-complete — infrastructure activation required` | All code is done; blocked only by external infra (migration, secrets, deployment) | Billing |
| `⚠️ Needs review — not inspected this session` | Functional but not recently audited; may have gaps | Assets, Loans, Calculators, Guides |
| `🚧 Mock / UI-only` | UI exists but data is hardcoded; violates "no mock data" principle; must not be presented as real | Goals |

### What "CLOSED" means precisely
A module is **CLOSED** when ALL of the following are true:
1. All core user-facing functionality works with real DB data (no mock, no placeholder, no unconnected save buttons)
2. At least one end-to-end logic validation was done (e.g., computed values verified manually)
3. Known limitations are explicitly listed and accepted (not silently ignored)
4. TypeScript is clean (`npx tsc --noEmit`)
5. All 5 docs outputs below are completed (see Section 5)

**CLOSED does not mean:**
- Perfect (limitations are acceptable — they must be documented)
- Complete forever (future features can reopen a module)
- Code-frozen (small bug fixes can happen without reopening)

---

## 3. Current Project Reality

### Already closed
- Auth, Onboarding, Expenses (unified module), Fixed Expenses, Expense Analysis, Budget, Settings

### Functional but not formally closed
- Dashboard (working, some polish gaps)
- Incomes (working, model limitations documented)
- Payment Sources (working, no open gaps)

### Needs audit before closeout
- Assets — functional, RLS unverified, DATA_MODEL.md entry pending
- Loans — functional, balance drift limitation needs documentation, RLS unverified
- Calculators — not inspected
- Guides — not inspected

### Mock / blocked
- Goals — 100% mock data, no DB table, must be implemented before it can be closed

### Infrastructure-blocked only
- Billing — code complete, no code gaps; waiting on Tranzila secrets + notify URL

---

## 4. The Closeout Workflow (What Worked in Practice)

This workflow was validated on Budget, Expenses, and Settings closeouts.

### Step 1 — Pre-read
Before anything else, read:
- `docs/MODULE_STATUS.md` → current state of target module
- `docs/PRODUCT_DECISIONS.md` → relevant locked decisions
- `handoff/LAST_KNOWN_GOOD_STATE.md` → last verified pass
- Any module-specific playbook (e.g., `LOANS_PLAYBOOK.md`)

### Step 2 — Code audit
Read the actual source file(s) for the module. Check:
- All data is real (no hardcoded arrays, no mock values)
- Every save button actually saves (trace the handler)
- Every delete actually deletes (check DB call, not just state removal)
- Loading state is present
- Empty state is present and accurate
- Error handling is present on all Supabase calls
- RTL alignment is correct
- All internal links use `<Link>` / `navigate()`, no `<a href>`
- No `as any` or `@ts-ignore` suppressions

### Step 3 — Logic validation
For modules with computed values (budget utilization, loan balance, net worth, health score):
- Pick a concrete test case with known inputs
- Trace the formula manually
- Confirm the UI output matches the expected result
- Document the validation in the closeout report

### Step 4 — Edge case review
Check specifically:
- Empty account (no data) — does the page look correct?
- Single record — does the layout hold?
- Maximum data — does anything overflow?
- Null/nullable fields — no crashes, graceful fallback display
- Account type variant (personal vs couple/family) — attribution controls hidden/shown correctly
- Cross-module: does any other page consume this module's data? Verify it still works.

### Step 5 — TypeScript verification
```bash
npx tsc --noEmit
```
Must be clean (zero errors, zero output). Do not close until clean.

### Step 6 — Identify and classify limitations
For every gap found, classify it as one of:
- **Blocker** — must be fixed before closure (e.g., a save button that doesn't save, a crash on null)
- **Accepted limitation** — known, documented, not a blocker (e.g., balance drift, goals not in budget, no duplicate detection in import)
- **Deferred feature** — out of scope for this stage, tracked in MODULE_STATUS.md "Next step"

Fix all blockers. Document accepted limitations explicitly. Do not silently skip.

### Step 7 — Documentation sync (all 5 required)

| Doc | What to update |
|-----|---------------|
| `docs/MODULE_STATUS.md` | Change status to `✅ CLOSED`. Write "Key gaps: None known" or list accepted limitations. Set "Next step: None — CLOSED" |
| `docs/PRODUCT_DECISIONS.md` | Lock any decisions made during this pass. Decisions that were resolved in code must be written here. |
| `handoff/LAST_KNOWN_GOOD_STATE.md` | Add or update the module's section: list what was verified, what bugs were fixed, what limitations are accepted |
| `handoff/SESSION_CHECKPOINT.md` | Record what was done in this session, including decisions made |
| `docs/CHANGELOG.md` | One entry per closeout session. Include what was verified, any bugs fixed, and key accepted limitations |

Skipping any of these five creates documentation drift that makes future work harder.

---

## 5. Safe-Change Rules During Closeout

### Do not
- Do not invent completions — if a feature is actually missing, document it honestly
- Do not mark a module CLOSED while it still has mock data visible to users
- Do not claim data is persisted if a save handler is not wired to Supabase
- Do not suppress TypeScript errors to reach a clean tsc — fix them
- Do not skip the cross-module check — a closed module may be consumed by Dashboard, Budget, or other pages

### Do not conflate status levels
- "It loads and looks good" ≠ CLOSED
- "It was working last week" ≠ CLOSED
- "The logic is probably right" ≠ CLOSED — validate it
- "No one reported a bug" ≠ Stable — it may never have been tested with edge cases

### Regression traps during closeout
- Adding a new column to a Supabase query select string can break the TypeScript interface — check
- Fixing a bug in a utility function (e.g., `formatDate`, `getCategoryMeta`) used by multiple pages — run the full regression on all consumers
- Updating MODULE_STATUS.md for one module while another module references it — verify cross-references are consistent

---

## 6. Accepted Limitations — Documented Examples

These are the accepted patterns in this project. Use as a reference for future limitation decisions:

| Module | Limitation | Accepted? | Rationale |
|--------|-----------|-----------|-----------|
| Loans | Stored `balance` drifts from reality between saves | ✅ Yes | Recomputation from client-side `new Date()` is live in display — DB value used only for Dashboard net worth summary |
| Expense Analysis | Trends fixed/variable split is estimated (recurring projection, not actuals) | ✅ Yes | No `type` flag on `financial_movements`; labeled "(צפי)" for honesty |
| Import | No `payment_source_id` linkage; no duplicate detection | ✅ Yes | v1 scope limitation, tracked |
| Budget | "ראה בהוצאות" does not filter by category | ✅ Yes | ExpensesPage doesn't consume that param |
| Goals | 100% mock data | ✅ Yes, temporarily | Explicitly acknowledged; must be resolved in Goals implementation pass |
| Billing | Checkout non-functional without Tranzila secrets | ✅ Yes | Infrastructure-only gap, code is complete |

---

## 7. Per-Module Closeout Checklist

### Standard checklist (all modules)
- [ ] All displayed data fetched from Supabase (no hardcoded arrays, no mock values)
- [ ] All save handlers call `supabase.from(...).insert/update`
- [ ] All delete handlers call `supabase.from(...).delete` (or soft-delete where appropriate)
- [ ] Loading state: spinner or skeleton
- [ ] Empty state: icon + message + CTA (where relevant)
- [ ] Error state: red banner
- [ ] `npx tsc --noEmit` clean
- [ ] RTL correct: panel slides from right; text alignment natural
- [ ] No `<a href>` for internal routes
- [ ] Account-scoped queries: all fetches include `.eq('account_id', accountId)`
- [ ] Attribution controls: visible only for couple/family accounts (if applicable)
- [ ] State resets correctly on panel close
- [ ] Stale state after save/delete: handled (optimistic update or refetch)

### Additional checks for modules with cross-module dependencies
- [ ] Dashboard net worth: if this module contributes to net worth (assets/loans), verify the Dashboard reads the correct column
- [ ] Budget integration: if this module affects budget (loans card, goals section), verify it
- [ ] Navigation: if this module links from/to another page, verify the link destinations are correct

**Integration verification — when to use `gsd-integration-checker`:**
For modules with documented cross-module dependencies (Loans→Dashboard, Assets→Dashboard, Goals→Budget+Dashboard), run `Agent(subagent_type="gsd-integration-checker")` before declaring CLOSED. This is distinct from the standard REGRESSION_PASS — it verifies that the *consuming* pages still work correctly after the *source* module changes, which manual inspection can miss. Only needed when the module supplies data to another page. Skip for self-contained modules (e.g., Calculators, Guides).

### Documentation checklist
- [ ] `MODULE_STATUS.md` updated to CLOSED with version note
- [ ] `PRODUCT_DECISIONS.md` updated with any new locked decisions
- [ ] `LAST_KNOWN_GOOD_STATE.md` updated
- [ ] `SESSION_CHECKPOINT.md` updated
- [ ] `CHANGELOG.md` entry written

---

## 8. Reporting Expectations

A good closeout report must explicitly include:
1. **Status before closeout:** what the module's status was at the start
2. **What was verified:** concrete list (e.g., "CRUD flow verified end-to-end", "edge case: empty account")
3. **Bugs found and fixed:** list each bug with root cause and fix
4. **Logic validation:** at least one computed value traced manually (e.g., "loan balance for ₪500k at 3.5%/240mo = X")
5. **Accepted limitations:** full list with rationale
6. **Cross-module check result:** what other pages were verified
7. **tsc status:** clean / errors found and fixed
8. **Documentation sync:** which of the 5 docs were updated
9. **New status:** `✅ CLOSED — [description] (YYYY-MM-DD)`

A report that only says "module is working and looks good" is **not a closeout report**. It is an observation. Closeout requires evidence.
