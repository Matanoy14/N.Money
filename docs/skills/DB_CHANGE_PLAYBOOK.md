# Skill: DB Change Playbook

Use when a feature requires adding columns to existing tables OR creating brand-new tables.

## Principles
DB changes are irreversible in production. Always:
1. Use nullable columns for new fields on existing tables (zero risk to existing rows)
2. Never NOT NULL without a DEFAULT on existing tables
3. Never rename or remove columns that have historical data — use aliases
4. Never add FK constraints without confirming all existing rows have valid references
5. Test migration on dev/staging before production

---

## Path A — Adding a Column to an Existing Table

### 1. Identify the change
State clearly:
- Table name
- Column name + type
- Always nullable (no default needed unless there's a clear one)
- RLS impact (does new column change any row-level access patterns?)

### 2. Write the SQL
```sql
-- Migration: [description]
-- Date: [YYYY-MM-DD]
-- Risk: low
-- Reversible: no (column removal requires confirming zero active references)

ALTER TABLE public.[table_name]
  ADD COLUMN [column_name] [type] NULL;

-- Verify:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '[table_name]' AND column_name = '[column_name]';
```

### 3. Update TypeScript interface
Add the new field as optional (`field?: Type | null`) to the relevant interface in the affected page/lib.

### 4. Update Supabase select strings
Any `supabase.from(...).select(...)` that queries this table must explicitly include the new field.

### 5. Handle nulls in UI
New nullable columns = legacy rows have null. UI must not crash on null. Show nothing or a safe fallback.

### 6. Update DATA_MODEL.md
Add the column to the table definition in `docs/DATA_MODEL.md`.

### 7. Update MODULE_STATUS.md
Add a note to the relevant module's status entry (e.g., "DB migration: adds `sub_category` column").

### 8. Run tsc
`npx tsc --noEmit` — must be clean.

---

## Path B — Creating a New Table

Use this path when a module requires a table that does not yet exist (e.g., `goals`).

### 1. Design the schema
Document before writing SQL:
- Table name (snake_case, plural)
- All columns: name, type, nullable/NOT NULL, default
- Primary key (UUID `default gen_random_uuid()`)
- Foreign keys + cascade behavior
- `account_id uuid NOT NULL references accounts(id)` — all tables are account-scoped
- `created_at timestamptz NOT NULL default now()`

### 2. Write the SQL
```sql
-- Migration: create [table_name] table
-- Date: [YYYY-MM-DD]
-- Risk: low (new table, no existing data affected)

CREATE TABLE public.[table_name] (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... domain columns ...
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

-- RLS policy: account-scoped access (all members of the account can read/write)
CREATE POLICY "[table_name]_account_member_access"
ON public.[table_name]
FOR ALL
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
);
```

> If INSERT should be restricted to the creating user, split into separate SELECT / INSERT / UPDATE / DELETE policies.

### 3. Create TypeScript interface
Create or add to the relevant lib file:
```ts
export interface [TableName] {
  id: string
  account_id: string
  user_id: string
  // ... domain fields, nullable fields as `field: string | null` ...
  created_at: string
}
```

### 4. Write Supabase select string
Define the full select string in the consuming page or lib. Include all fields used.

### 5. Add loading / empty / error states
All new data sources in a page require:
- `loading` → spinner or skeleton
- `empty` → empty-state component with message + CTA
- `error` → visible error banner (not just console.log)

### 6. Update DATA_MODEL.md
Add the full table definition.

### 7. Update MODULE_STATUS.md
Document the new module or update an existing module's "What exists" section.

### 8. Run tsc
`npx tsc --noEmit` — must be clean.

---

## Known Applied Migrations

| Column | Table | Notes |
|--------|-------|-------|
| `attributed_to_type text null` | `financial_movements` | Expense attribution v1 |
| `attributed_to_member_id uuid null` | `financial_movements` | Expense attribution v1 |
| `sub_category text null` | `recurring_expenses` | Fixed expense subcategory (2026-04-03) |
| `attributed_to_type text null` | `recurring_expenses` | Fixed attribution (2026-04-03) |
| `attributed_to_member_id uuid null` | `recurring_expenses` | Fixed attribution (2026-04-03) |

---

## Do Not
- Do not use NOT NULL without a DEFAULT on existing tables
- Do not drop columns without confirming zero active references
- Do not add FK constraints without confirming all existing rows have valid references
- Do not skip RLS — every new table must have RLS enabled and an account-scoped policy
- Do not create a table without documenting it in DATA_MODEL.md and MODULE_STATUS.md
