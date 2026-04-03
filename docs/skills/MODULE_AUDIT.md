# Skill: Module Audit

Use this before implementing any change to a module you haven't recently inspected.

## Steps

1. **Read target files only**
   - The page file
   - Any directly imported helper used by that page (not the whole lib)
   - Do NOT read unrelated modules

2. **Check for:**
   - Fake/mock data anywhere in rendered output
   - Raw strings where formatDate/formatCurrency should be used
   - `<a href>` links to internal routes (replace with `<Link>` or `navigate()`)
   - Hardcoded names/IDs instead of dynamic data
   - Missing empty states
   - Missing error handling on Supabase queries
   - TypeScript errors or type casts with `as any`
   - RTL alignment issues (`text-left` in RTL containers, wrong panel slide direction)
   - Stale state after save/delete (optimistic update vs refetch)

3. **Report format:**
```
MODULE AUDIT: [ModuleName]
- file: [path]
- status: working / broken / partial
- fake data: yes / no
- RTL issues: [list or none]
- anchor links: [list or none]
- data gaps: [list or none]
- empty states: ok / missing
- recommended fixes: [ordered list]
```

4. **Do not implement yet** — report first, implement in a separate pass using `docs/skills/SAFE_IMPLEMENTATION.md`

## Red Flags
- `supabase.from(...).select(...)` without `.eq('user_id', user.id)` or `.eq('account_id', accountId)` — RLS should handle this but verify
- State not reset after panel close
- `useEffect` with missing dependencies
- `.single()` without checking for null result
