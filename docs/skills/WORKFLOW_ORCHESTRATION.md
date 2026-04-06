# Skill: Workflow Orchestration

Use at the start of any task to identify which path to take. This is a routing layer — it points to skills, not restates them.

Read this first, then follow the path for your task type.

---

## How to identify your pass type

| Task description | Pass type |
|-----------------|-----------|
| "Audit [module] before working on it" | Audit pass |
| "Plan [feature] implementation" | Planning pass |
| "Add/fix/change something in code" | Implementation pass |
| "Something is broken / behaving unexpectedly" | Debugging pass |
| "Verify this change is complete and correct" | Verification pass |
| "Close out [module] formally" | Closeout pass |

---

## A. Audit Pass

**When:** Before touching any module not recently inspected, or before formal closeout.

**Path:**
1. Read (in order): `docs/MASTER_CONTEXT.md` → `docs/MODULE_STATUS.md` → `docs/PRODUCT_DECISIONS.md` → module playbook (LOANS_PLAYBOOK / ASSETS_PLAYBOOK / etc.)
2. Follow `docs/skills/MODULE_AUDIT.md` — check the specific items for that module
3. Use `Glob` / `Grep` for targeted lookups. Use `Agent(subagent_type="Explore")` only if the module has many cross-file dependencies not obvious from a single file read.
4. Report using `docs/templates/AUDIT_TEMPLATE.md` — do not implement; report findings first

**Escalate to planning pass** if audit reveals work that requires a structural decision before proceeding.

---

## B. Planning Pass

**When:** Feature complexity is high (new DB table, multi-stage implementation, unclear scope), or an audit reveals locked decisions are missing.

**Path:**
1. Check `docs/PRODUCT_DECISIONS.md` — what is already decided?
2. Check `docs/MODULE_STATUS.md` — what is the current module state?
3. If unresolved product decisions block design: use `AskUserQuestion` before planning
4. For light planning (single-module feature): write the plan inline in the response
5. For heavy planning (new table, multi-module, Goals-level complexity): invoke `superpowers:writing-plans` via Skill tool; optionally `Agent(subagent_type="Plan")` for architecture review
6. Lock all decisions into `docs/PRODUCT_DECISIONS.md` before implementation begins

**Do not start implementation until:** schema confirmed (if DB work), locked decisions written, scope bounded to ≤3 files or explicitly approved as larger.

---

## C. Implementation Pass

**When:** Root cause is understood, scope is confirmed, plan (or task) is clear.

**Path:**
1. Invoke `docs/skills/SAFE_IMPLEMENTATION.md` — follow it exactly
2. If the change touches a DB column or new table: invoke `docs/skills/DB_CHANGE_PLAYBOOK.md`
3. If editing a function with >2 callers: use LSP before editing (see CLAUDE_TOKEN_EFFICIENCY)
4. If the pass has >5 steps: use `TaskCreate` / `TaskUpdate`
5. After code changes: `npx tsc --noEmit` (must be clean)
6. After implementation: follow `docs/skills/REGRESSION_PASS.md`

**Escalate to debugging pass** if a fix attempt fails (see SAFE_IMPLEMENTATION stall detection).
**Escalate to verification pass** before marking complete.

---

## D. Debugging Pass

**When:** Something behaves unexpectedly, a fix didn't resolve the issue, or tsc is clean but the output is wrong.

**Path:**
1. Invoke `docs/skills/DEBUGGING_ESCALATION.md` — determine escalation state (Tweak / Diagnostic / Investigation)
2. For Tweak: apply one targeted fix, declare result
3. For Diagnostic: write the hypothesis protocol (SYMPTOM / EXPECTED / HYPOTHESIS / RESULT) before touching code
4. For Investigation: invoke `superpowers:systematic-debugging` via Skill tool; use LSP for semantic reference finding; use `Agent(subagent_type="gsd-debugger")` for multi-file root cause analysis
5. After 2 disproved hypotheses: write a Debugging Stop Report and surface to user

**Do not:** apply a second variant of the same fix without declaring the first hypothesis wrong first.

---

## E. Verification Pass

**When:** Implementation is complete and about to be declared done.

**Path:**
1. `npx tsc --noEmit` — types clean (gate 1)
2. Follow browser check sequence in `docs/skills/REGRESSION_PASS.md` — functional behavior correct (gate 2)
3. Check cross-module effects if the module supplies data to another page (gate 3): verify Dashboard net worth, Budget cards, or other consumers as applicable
4. Invoke `superpowers:verification-before-completion` via Skill tool before final declaration
5. For major implementations: invoke `Agent(subagent_type="superpowers:code-reviewer")` against the original plan

**Report using** `docs/templates/QA_REPORT_TEMPLATE.md` for significant passes.

---

## F. Closeout Pass

**When:** A module is functionally complete, has been verified, and is ready for formal status change in `MODULE_STATUS.md`.

**Path:**
1. Invoke `docs/skills/CLOSEOUT_PLAYBOOK.md` — follow the 7-step workflow
2. For modules with documented cross-module dependencies (Loans, Assets, Goals): run `Agent(subagent_type="gsd-integration-checker")` — verifies consuming pages, not just the module itself
3. Complete all 5 mandatory documentation outputs: MODULE_STATUS.md / PRODUCT_DECISIONS.md / LAST_KNOWN_GOOD_STATE.md / SESSION_CHECKPOINT.md / CHANGELOG.md
4. Status change to `✅ CLOSED` only after all CLOSEOUT_PLAYBOOK conditions are met

---

## Quick-reference: which skill leads each pass

| Pass | Lead skill | Support skills / agents |
|------|-----------|------------------------|
| Audit | MODULE_AUDIT | module playbooks, Explore agent, AUDIT_TEMPLATE |
| Planning | SAFE_IMPLEMENTATION (scope) | writing-plans, Plan agent, AskUserQuestion, DB_CHANGE_PLAYBOOK |
| Implementation | SAFE_IMPLEMENTATION | DB_CHANGE_PLAYBOOK, LSP, TaskCreate, REGRESSION_PASS |
| Debugging | DEBUGGING_ESCALATION | systematic-debugging, gsd-debugger, LSP, AskUserQuestion |
| Verification | REGRESSION_PASS | verification-before-completion, code-reviewer, QA_REPORT_TEMPLATE |
| Closeout | CLOSEOUT_PLAYBOOK | gsd-integration-checker, 5 mandatory docs |

---

## N.Money-specific pass sequence for a new module

For any module currently at `⚠️ Needs review` (Assets, Loans, Calculators, Guides):

```
Audit pass → fix identified blockers (Implementation pass) → Verification pass → Closeout pass
```

For Goals (`🚧 Mock`):
```
Planning pass (lock decisions first) → Implementation pass → Verification pass → Closeout pass
```

For Incomes (next in queue, `✅ Working`):
```
Audit pass (confirm INCOME_MODEL_PLAYBOOK stages) → Planning pass (which stage) → Implementation pass → Closeout pass
```
