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

## When to Stop and Ask
- If a required DB column doesn't exist → stop, report, ask for confirmation
- If the user's requirement contradicts a locked product decision → stop, surface conflict
- If implementation would require touching >3 unrelated files → stop, propose scoped approach
