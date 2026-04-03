# Implementation Report Template

Use at the end of every implementation task (per CLAUDE.md rules).

---

## Implementation Report: [Feature Name]

**Date:** YYYY-MM-DD

---

### 1. What Changed

Brief description of the change — one sentence per logical change.

- Added X to Y
- Fixed Z in W
- Updated form to include field Q

---

### 2. Files Changed

| File | Change type | Summary |
|------|-------------|---------|
| `src/pages/XxxPage.tsx` | Modified | Added attribution form field + AttrChip display |
| `src/components/Yyy.tsx` | Modified | Added prop |
| `src/lib/zzz.ts` | Modified | Added helper function |

---

### 3. How to Test

Step-by-step verification:

1. Log in as a couple/family account
2. Go to [page]
3. Add a new [item] with [field] set to [value]
4. Verify [expected outcome]
5. Refresh page — verify data persisted
6. Test edge case: [edge case description]

---

### 4. Remaining Gaps

- [ ] Gap 1 — not in scope, tracked in SPRINT_BACKLOG.md
- [ ] Gap 2 — needs design decision before implementing

---

### 5. DB Changes

None / See `docs/skills/DB_CHANGE_PLAYBOOK.md` for migration applied.
