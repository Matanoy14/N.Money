# N.Money project rules

## Product identity
- Product name is N.Money
- Do not use the old name N.Fortis anywhere in UI, text, metadata, or assets
- UI language is Hebrew
- Layout must be full RTL

## Work style
- Make minimal targeted changes
- Do not refactor unrelated files
- Prefer fixing the root cause over patching symptoms
- Keep outputs concise and practical

## UX and product rules
- Do not leave mock, placeholder, or fake financial data in screens presented as real product flows
- If a screen is not connected to real data yet, make that state explicit or wire it properly
- Auth flows must actually work: sign up, login, logout
- User-facing flows must be editable where relevant, not read-only unless intentionally designed
- Landing page should clearly explain the product and drive account creation
- Keep the experience simple, premium, and trustworthy

## UI rules
- Maintain consistent blue-white branding
- Preserve clean spacing, strong readability, and mobile-friendly behavior
- Avoid breaking existing RTL alignment
- Keep Hebrew copy natural, clear, and concise

## Implementation priorities
1. App stability and runtime errors
2. Real functionality over demo UI
3. Auth and user state
4. Editable data flows
5. Branding, logo, landing page video/hero
6. Onboarding, profiling questions, settings, guides

## When working on a task
- First inspect only the files directly related to the task
- Then apply the smallest complete fix
- At the end return a very short report with:
  1. what changed
  2. which files changed
  3. how to test
  4. any remaining gap

## Guardrails
- Do not invent completed features
- Do not claim data is persisted if it is not
- Do not keep dead code or duplicate branding if touched by the task
- Ask for clarification only if a missing decision blocks implementation

## Docs system
Read these at the start of any non-trivial task:
- `docs/MASTER_CONTEXT.md` — stack, principles, source-of-truth hierarchy
- `docs/MODULE_STATUS.md` — current state and gaps per module
- `docs/PRODUCT_DECISIONS.md` — locked decisions, do not reverse without approval
- `docs/DATA_MODEL.md` — exact DB schema (read before any Supabase work)

Skills to invoke (in `docs/skills/`):
- `SAFE_IMPLEMENTATION.md` — before every code change
- `MODULE_AUDIT.md` — before touching a module not recently inspected
- `REGRESSION_PASS.md` — after every significant change
- Module playbooks (`RECURRING_EXPENSES_PLAYBOOK.md`, `INCOME_MODEL_PLAYBOOK.md`, `DASHBOARD_ANALYTICS_PLAYBOOK.md`, `SETTINGS_PLAYBOOK.md`, etc.) — when working on that module

## End of session (mandatory)
Before closing any session that changed app code or made product decisions:
1. `handoff/SESSION_CHECKPOINT.md` — what changed, decisions made, what's next
2. `docs/MODULE_STATUS.md` — update if any module's status or gaps changed
3. `docs/CHANGELOG.md` — one entry per session
4. `handoff/CURRENT_BLOCKERS.md` — update if blockers were resolved or added
