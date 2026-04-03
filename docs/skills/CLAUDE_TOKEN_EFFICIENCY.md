# Skill: Claude Token Efficiency

Use at the start of any large implementation task to manage context window usage.

## Core Principle

Read only what you need. Do not speculatively read files not related to the task.

## Before Starting a Task

1. Identify the 1-3 files directly affected by the task
2. Read only those files (not "related" or "nearby" files)
3. If a function is imported from another file, grep for the specific function — don't read the whole file

## When Reading Files

- Use `offset` + `limit` on large files (>300 lines) — read only the relevant section
- For type/interface lookups: grep for the type name, don't read the whole types file
- For import verification: grep for the function/component name

## Preferred Search Approach

```
grep first → read specific lines → edit
```

Not:
```
read whole file → find section → edit
```

## Supabase Column Verification

- `grep "attributed_to"` in the relevant page file to confirm columns already used
- Do not read entire DB migration files unless adding a new column

## Avoiding Redundant Reads

- If you already read a file in this session, don't re-read it unless it changed
- If a prior edit confirmed the file compiles, trust it
- Track what you've already read mentally

## Safe Stop Points

Stop and report to the user when:
- Task requires reading more than 5 files
- Task would touch more than 3 files
- Unclear whether a DB column exists
- Unclear which component owns a behavior

Ask one targeted question rather than reading speculatively.

## Context Recovery After Compaction

When context is compacted, the session summary contains key code snippets. Trust the summary. Only re-read the file if:
- You need exact line numbers for an edit
- The summary says the file was changed but not what it contains now
