# Skill: Settings Playbook

Use when modifying SettingsPage.

## Current Status (as of 2026-04-03)
Settings is **CLOSED** — fully implemented for the current product stage.
Do not reopen settled work without an explicit product decision.

## Architecture — 9 Tabs (Final)
`src/pages/SettingsPage.tsx` — single file, tab shown via `activeSection` state.

| Tab | Key | Persistence | Status |
|-----|-----|-------------|--------|
| פרופיל | `profile` | Supabase `user_profiles` | ✅ Real |
| מקורות תשלום | `payments` | Supabase `payment_sources` | ✅ Real |
| חשבון וחברים | `account` | Supabase `accounts`, `account_members`, `account_invitations` | ✅ Real (invite needs DB migration) |
| אבטחה | `security` | Supabase auth (password reset, TOTP MFA, account deletion) | ✅ Real |
| מנוי וחיוב | `subscription` | `account_subscriptions` + Tranzila functions | ⚙️ Code-complete, infra pending |
| ניהול נתונים | `data` | SheetJS export + ImportWizard → `financial_movements` | ✅ Real |
| התראות | `notifications` | localStorage `nmoney_notification_prefs` | ✅ Local-only, truthful |
| תצוגה | `display` | Language field only (read-only, Hebrew only) | ✅ Minimal, honest |
| ברירות תקציב | `budget` | localStorage `nmoney_savings_goal_pct` | ✅ Local-only, real |

## Rules That Must Not Break
- **Logout lives in AppLayout sidebar only** — never add a logout button inside SettingsPage
- **Account type change** = `handleSavePlan` in the מנוי וחיוב tab only — writes both localStorage and `accounts.type` DB in one action
- **Account Structure tab is display-only** for account type — directs owner to מנוי וחיוב tab for changes
- **Downgrade guard**: blocked if `members.length > 1`; user must remove members first

## Profile Section (safe to modify)
- Loads: `display_name`, `employment_type` from `user_profiles` on mount
- Saves to: `user_profiles` on "שמור שינויים" click
- Do not touch logout logic here

## Payment Sources Section (safe to modify)
- CRUD via Supabase `payment_sources` table
- Insert requires `user_id: user.id`, `account_id: accountId`
- Deactivate: `.update({ is_active: false })` — never hard delete
- After any change: call `refetchPaymentSources()` from AccountContext
- Uses `SOURCE_TYPES`, `getSourceTypeLabel()` from `paymentMethods.ts`
- Current types: credit / bank / transfer / bit / paybox / cash

## Adding a New Setting
1. Identify which tab it belongs to
2. Add state variable + load on mount
3. Save in the tab's existing save handler
4. If new DB column needed → follow `docs/skills/DB_CHANGE_PLAYBOOK.md`

## Common Pitfalls
- `accountId` may be null briefly on load — always guard: `if (!accountId) return`
- `user` may be null — always guard: `if (!user) return`
- Payment source insert without `account_id` → DB null constraint error
- Do not add billing state writes on the client — only `tranzila-notify` (service role) writes to `account_subscriptions`
