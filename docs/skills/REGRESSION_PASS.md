# Skill: Regression Pass

Use after a major implementation session to check for unintended breakage.

## Scope
Check only files that were changed or that import changed modules. Do not audit the whole repo.

## Steps

1. **Run TypeScript check first**
   ```bash
   npx tsc --noEmit
   ```
   Zero errors required. Fix before continuing.

2. **Check changed files for:**
   - Missing state resets after form close
   - Broken Supabase select (missing new fields from interface)
   - Hardcoded values that should be dynamic
   - Unused imports (not blocking but messy)
   - `console.log` left in (remove)

3. **Check consuming pages for:**
   - If a context value changed shape → all consumers still work?
   - If a lib function signature changed → all call sites updated?

4. **Browser check sequence (do these in order):**
   - Load the page fresh (hard refresh)
   - Add a record
   - Edit the same record
   - Delete the record
   - Switch months
   - Log out and log back in
   - Verify the feature still works

5. **Report format:**
```
REGRESSION CHECK
- files checked: [list]
- tsc: clean / [error count]
- issues found: [list or none]
- issues fixed: [list or none]
- known acceptable gaps: [list]
```

## Common Regression Patterns
- Supabase `select()` string not updated after adding new column to interface
- `resetForm()` not clearing new state fields
- `handleEdit()` not loading new fields from existing record
- Attribution field visible in personal account (should be hidden)
- New filter state not reset when month changes
