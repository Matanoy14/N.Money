# Payment Sources

Source of truth: `src/lib/paymentMethods.ts`, `src/pages/SettingsPage.tsx`

## Payment Methods (generic fallback)
Used when no named sources exist for an account.

| id | Hebrew | Color |
|---|---|---|
| credit | כרטיס אשראי | #6366F1 |
| transfer | העברה בנקאית | #8B5CF6 |
| cash | מזומן | #22C55E |
| bit | ביט / Paybox | #0EA5E9 |
| standing | הוראת קבע | #F59E0B |

Legacy aliases (stored in old rows, resolved via PM_ALIASES):
`debit → credit`, `digital → bit`, `bank → transfer`
Hebrew strings also resolved via PM_ALIASES.

## Payment Sources (named, user-created)
Stored in `payment_sources` table per account.

### Source Types
| id | Hebrew label | Icon |
|---|---|---|
| credit | כרטיס אשראי | 💳 |
| bank | חשבון בנק | 🏦 |
| transfer | העברה בנקאית | 🔄 |
| bit | ביט | 📲 |
| paybox | Paybox | 📲 |
| cash | מזומן | 💵 |

Note: `bank` label was updated from 'חשבון עו״ש' → 'חשבון בנק' (2026-04-03). Existing rows unaffected — label resolves via `getSourceTypeLabel`.

Legacy: `debit → credit`, `digital → bit` (SOURCE_TYPE_ALIASES)

### Source Type → Payment Method mapping (SOURCE_TYPE_TO_PM)
- credit → 'credit'
- bank → 'transfer'
- transfer → 'transfer'
- bit → 'bit'
- paybox → 'bit'
- cash → 'cash'

### Colors
10-color palette in SOURCE_COLORS. User picks on creation.

### Lifecycle
- Created in SettingsPage (requires accountId)
- Soft-deleted: `is_active = false`
- Loaded via AccountContext, cached in `paymentSources[]`
- Refreshed via `refetchPaymentSources()`

## Resolution Logic (resolvePaymentDisplay)
1. If `payment_source_id` is set → find named source → return `{name, color}`
2. If source not found (deleted) → fall through
3. Use `payment_method` string → resolve via `getPaymentMethod()` + PM_ALIASES

## Usage Across Pages
- TransactionsPage: source chips in add/edit panel; display in row
- IncomesPage: source chips in add/edit panel; display in row
- ExpenseAnalysisPage: payment filter pills; transaction display in drill-down
- FixedExpensesPage: source chips in template form
- DashboardPage: payment display in recent movements

## Known Gaps
- No `owner_member_id` on sources (out of scope for v1 attribution)
- Deleting a source leaves `payment_source_id` in existing movements — these fall back to `payment_method` display gracefully
