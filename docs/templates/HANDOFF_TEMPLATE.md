# Handoff Template

Use when ending a session with significant in-progress or incomplete work.

---

## Session Handoff: [Date YYYY-MM-DD]

---

### What Was Completed This Session

- Feature/fix 1 — files changed
- Feature/fix 2 — files changed

---

### Last Known Good State

- All TypeScript: passing (`npx tsc --noEmit`)
- App starts: yes/no
- Pages tested manually: [list]
- Known broken: [list if any]

---

### In Progress (Incomplete)

**Task:** [name]
- What is done: [steps completed]
- What remains: [exact next step]
- Key file: `src/pages/XxxPage.tsx` line ~N
- Context: [anything not obvious from the code]

---

### Next Session Should Start With

1. [Exact first action]
2. [Second action]

---

### Decisions Made This Session

Document any non-obvious decisions here so they don't need to be re-derived:
- Decision: [description] — Reason: [why]

---

### Blockers

- [Blocker description] — waiting on: [what/who]

---

### Do Not Touch

Files or behaviors that are intentionally as-is:
- `src/components/AppLayout.tsx` logout — do not add logout to SettingsPage
- [other things to leave alone]
