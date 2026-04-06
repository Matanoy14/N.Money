# Skill: Safe Implementation

Use this protocol for every implementation pass.

## Before Starting
1. Read ONLY the files directly relevant to the task
2. Check `docs/PRODUCT_DECISIONS.md` for locked decisions
3. Check `docs/MODULE_STATUS.md` for current state of target module
4. Confirm scope: what exactly changes, what stays untouched

## Implementation Rules
- Make targeted edits (Edit tool), not full rewrites (Write tool on existing files)
- One logical change at a time — don't bundle unrelated fixes
- Preserve all existing working logic unless explicitly replacing it
- Never touch unrelated modules even if you spot issues
- Never add mock data, placeholder text, or fake financial values
- Never hardcode names, amounts, or user-specific data

## TypeScript Safety
- After every code change session: `npx tsc --noEmit`
- Zero errors required before reporting completion
- Fix TS errors before moving on — do not suppress with `// @ts-ignore` or `as any`
- Before editing a function that appears in >2 files: use **LSP** (via ToolSearch) to find all callers first — Grep misses aliased imports

## Supabase Safety
- All inserts must include `user_id` and `account_id`
- Soft delete preferred over hard delete for user-created records
- Never expose another user's data — trust RLS but also filter in queries
- `.maybeSingle()` when 0 or 1 result expected, `.single()` only when guaranteed

## Reporting
After each pass:
```
STEP REPORT
1. completed step: [what was done]
2. files changed: [list]
3. exact changes: [what specifically changed]
4. manual action required: yes/no [if yes, what exactly]
5. verify in browser: [specific steps]
```

## After Implementation

Run `docs/skills/REGRESSION_PASS.md` after any significant code change. Do not skip.

**Verification before completion — 3 distinct gates:**
1. `npx tsc --noEmit` clean — types are correct (necessary, not sufficient)
2. Functional verification — the feature behaves correctly end-to-end (REGRESSION_PASS browser sequence)
3. Cross-module integration — if this module feeds Dashboard, Budget, or another page, verify the consumer still works

Invoke `superpowers:verification-before-completion` before marking any pass complete.

## Stall Detection — Mandatory

Apply before every fix attempt:
- If the same category of fix has been applied once and the issue persists → declare the hypothesis wrong, move to Diagnostic Pass (`docs/skills/DEBUGGING_ESCALATION.md`)
- If tsc is clean but the behavior is still wrong → root cause is not in the types; move to Diagnostic Pass
- If you are about to edit a 4th file for what looked like a 1-file problem → stop, re-read scope

**Rule:** A failed fix means a wrong hypothesis. Declare it wrong before trying the next approach.
Invoke `docs/skills/DEBUGGING_ESCALATION.md` any time a fix attempt fails or behavior is unexpected.

## When to Stop and Ask
- If a required DB column doesn't exist → stop, report, ask for confirmation
- If the user's requirement contradicts a locked product decision → stop, surface conflict
- If implementation would require touching >3 unrelated files → stop, propose scoped approach
- If two diagnostic hypotheses have been disproved → stop, write a Debugging Stop Report (see DEBUGGING_ESCALATION.md)
- If a product/business decision is genuinely unresolved and blocks implementation → use `AskUserQuestion` (one-sentence answer unblocks faster than passive documentation)
