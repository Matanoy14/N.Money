# Skill: Settings Playbook

Use when modifying SettingsPage.

## Architecture
- 7 sections in inner sidebar nav: profile / notifications / appearance / budget / security / data / payments
- Only profile and payments sections are fully wired to DB
- Section shown via `activeSection` state
- "שמור שינויים" only shown for relevant sections

## Profile Section
- Loads: `display_name`, `employment_type` from `user_profiles` on mount
- Saves to: `user_profiles` on button click
- Do not touch logout logic here — logout lives in AppLayout only

## Payment Sources Section
- CRUD via Supabase `payment_sources` table
- Insert requires `user_id: user.id`, `account_id: accountId` (accountId guard needed)
- Deactivate: `.update({ is_active: false })` (not delete)
- After change: call `refetchPaymentSources()` from AccountContext
- Uses `SOURCE_TYPES`, `SOURCE_COLORS`, `getSourceTypeLabel()` from paymentMethods.ts

## Adding a New Setting
1. Add to the relevant section's UI
2. Add state variable
3. Load from DB on mount (same useEffect as profile or new one)
4. Save in the section's save handler
5. If new DB column needed → follow `docs/skills/DB_CHANGE_PLAYBOOK.md`

## What NOT to Do
- Do not add a logout button to SettingsPage
- Do not use `useNavigate` for logout — AppLayout handles this
- Do not hardcode user data — always load from DB

## Common Pitfalls
- `accountId` may be null briefly on load — always guard: `if (!accountId) return`
- `user` may be null — always guard: `if (!user) return`
- Payment source add without `account_id` → DB null constraint error
