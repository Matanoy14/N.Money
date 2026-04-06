# Skill: Debugging Escalation

Use when a fix attempt fails, a behavior is unexpected, or a pass is producing no forward progress.

Do NOT wait to be asked. Self-invoke this skill when any stall trigger fires.

---

## 1. Purpose

This skill exists because the most common failure mode in implementation passes is not a lack of tools — it is **trying a variant of the same wrong fix a second or third time** instead of stopping to diagnose.

It solves three problems specific to this project:
1. TypeScript compiles clean but the feature behaves incorrectly at runtime
2. A Supabase query returns wrong/empty data for reasons not visible from the TypeScript interface
3. A UI element doesn't render as expected despite the logic appearing correct

Use this skill to define WHICH kind of pass you are in before touching code, and to escalate when a pass is not producing resolution.

---

## 2. Escalation States

### State 1 — Tweak Pass
**When:** Root cause is already understood. Fix is a single, targeted change with a clear expected outcome.

Criteria for staying in tweak pass:
- You can state in one sentence: "The bug is X because Y, fix is Z"
- The fix touches ≤ 2 lines in ≤ 1 file
- You expect the fix to fully resolve the issue

**If the tweak fails:** Do NOT apply another tweak. Move to Diagnostic Pass immediately.

---

### State 2 — Diagnostic Pass
**When:** A behavior is wrong, unexpected, or a fix didn't work. Root cause is unclear.

Required before touching any code:
1. **State the symptom exactly** — not "it doesn't work" but "the balance shown is ₪50,000 but the expected value is ₪42,300"
2. **State the expected behavior exactly** — what should happen and why
3. **List 2–3 candidate root causes** — each as a testable hypothesis
4. **Choose one hypothesis** — the most likely, not the most convenient to fix
5. **Trace backwards from output to source** — identify the first code step where actual ≠ expected
6. **Fix the root, not the symptom** — do not change display formatting when the data source is wrong

After each failed hypothesis: **explicitly declare it wrong** ("Hypothesis: wrong Supabase query filter — DISPROVED: query is scoped correctly") before moving to the next.

**Escalate to Investigation Pass after 2 failed hypotheses.**

---

### State 3 — Investigation Pass
**When:** Two diagnostic hypotheses have failed, OR the bug spans multiple files/modules, OR the root cause is unclear after one full Diagnostic Pass.

Investigation Pass actions — in order:
1. **Invoke `superpowers:systematic-debugging`** via the Skill tool
2. Use **Grep** to trace the data path end-to-end (source → transform → render)
3. Use **LSP** to find ALL callers of a suspect function (not just string-matching with Grep)
4. If the issue may be data/RLS/env state: use **AskUserQuestion** to confirm what the actual DB state is — do not guess
5. If the investigation spans >4 files: use **TaskCreate** to track each hypothesis and its status
6. If still unresolved after a full Investigation Pass: write a diagnostic report (see Stop/Report rules below) and surface it

---

## 3. Stall Detection Rules

Apply these checks at the START of any pass, not just when something breaks.

| Trigger | Required action |
|---------|----------------|
| Same category of fix attempted twice, issue persists | Stop. Move to Diagnostic Pass. Do not apply a third variant. |
| Fix applied, tsc clean, but behavior still wrong | Stop. Root cause is not where you thought. Move to Diagnostic Pass. |
| Two diagnostic hypotheses disproved | Stop. Move to Investigation Pass or report findings. |
| Same error message seen twice | This is a pattern. It signals a structural issue, not a typo. Move to Diagnostic Pass. |
| Touching a 4th file to fix what looked like a 1-file problem | Stop. The scope assumption was wrong. Re-read MODULE_STATUS.md and PRODUCT_DECISIONS.md before continuing. |

**The core rule:**
> If you have applied a fix and the problem still exists, you were wrong about the root cause. Declare it wrong before trying anything else.

---

## 4. Minimum Debugging Protocol

Before editing code in any Diagnostic or Investigation pass, write down (in the response, not just mentally):

```
SYMPTOM: [exact wrong behavior + specific value/output if applicable]
EXPECTED: [what should happen and why]
HYPOTHESIS: [one specific root cause]
HOW TO VERIFY: [what to check in code/data to confirm or disprove]
RESULT: [CONFIRMED / DISPROVED + evidence]
```

If disproved, document it:
```
HYPOTHESIS 1: [X] — DISPROVED — reason: [Y]
HYPOTHESIS 2: [X] — testing...
```

This documentation is not bureaucracy — it prevents the same wrong hypothesis from being attempted twice.

---

## 5. Tool and Agent Guidance

| Situation | Tool/Agent to use |
|-----------|------------------|
| Root cause unknown, starting Diagnostic Pass | `superpowers:systematic-debugging` via Skill tool |
| Complex multi-file investigation | `Agent(subagent_type="gsd-debugger")` |
| Finding all callers of a function (semantically, not string-matching) | `LSP` (via ToolSearch) |
| Tracing data flow across the codebase | `Grep` with multiline mode when cross-line patterns needed |
| Unknown product decision is blocking diagnosis | `AskUserQuestion` — do not guess at product intent |
| Investigation pass spans >4 discrete steps | `TaskCreate` per hypothesis/step (via ToolSearch) |
| Suspected RLS policy issue | `AskUserQuestion` — RLS cannot be verified from code alone; confirm actual policy in Supabase |
| Suspected stale DB data (e.g., loans balance drift) | Do not re-query speculatively. Ask user to confirm the actual value or run a diagnostic query |

**Do not use:**
- `WebSearch` for N.Money-specific bugs — external docs don't know this project's data state
- Repeated `Bash` / `npx tsc --noEmit` cycles as a substitute for diagnosing root cause — tsc clean does not mean correct behavior

---

## 6. N.Money-Specific Bug Patterns

These are the most common root causes in this codebase. Check these FIRST in a Diagnostic Pass before looking elsewhere.

| Symptom | Most likely root cause | Where to check |
|---------|----------------------|----------------|
| Wrong amount shown | `getLoanDisplayValues()` vs stored DB value mismatch | `src/pages/LoansPage.tsx` — which path does the display go through? |
| Date range off by 1 day | UTC timezone shift from `new Date(y,m,d).toISOString()` | Any date string constructed with local `new Date()` — should use `Date.UTC()` |
| Supabase query returns empty unexpectedly | `accountId` is null at query time (guard missing) | Confirm `.eq('account_id', accountId)` is guarded by `if (!accountId) return` |
| Attribution controls showing in personal account | Account type not checked before render | Confirm `(isCouple || isFamily)` guard wraps the attribution UI block |
| Stale data after save | Optimistic update overwrote state without refetch | Check whether `load()` / `refetch` is called after save, or state is set directly |
| Filter state survives month change | Filter not reset in the month-change effect | Check `useEffect([currentMonth])` for filter state resets |
| RLS block returning 0 rows silently | Wrong policy scope — creator-only instead of account-scoped | Cannot be confirmed from code — must check Supabase policy directly |
| `computeLoanDerived` gives wrong balance | `elapsed` months computed from local `new Date()` — correct but sensitive to current date | Trace with known inputs (see LOANS_PLAYBOOK) |

---

## 7. Stop/Report Rules

Stop the debugging pass and surface findings to the user when:

- **After 2 disproved hypotheses in Investigation Pass** — write a diagnostic report: symptom, what was tried, what was ruled out, what remains unknown, what you need from the user
- **Root cause likely depends on runtime/browser state** — code inspection cannot confirm it; browser verification by the user is required
- **Root cause likely depends on actual DB data or RLS policies** — code inspection cannot confirm it; DB inspection by the user is required
- **A locked product decision is implicated** — do not change behavior that contradicts `docs/PRODUCT_DECISIONS.md`; surface the conflict instead
- **The fix would require touching >3 unrelated files** — scope assumption was wrong; re-plan before proceeding

**Diagnostic report format (use this when stopping):**
```
DEBUGGING STOP REPORT
- Symptom: [exact wrong behavior]
- Files inspected: [list]
- Hypotheses tried: [H1 — DISPROVED (reason) / H2 — DISPROVED (reason)]
- Current best theory: [most likely remaining cause]
- What is needed to confirm: [specific check, DB query, or user action]
- What to do next: [specific next step for user or next session]
```
