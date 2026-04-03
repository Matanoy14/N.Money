# Skill: DB Change Playbook

Use when a feature requires adding/modifying DB columns or tables.

## Principle
DB changes are irreversible in production. Always:
1. Use nullable columns for new fields (zero risk to existing rows)
2. Add backward-compat aliases in code before deploying
3. Never rename or remove columns that have historical data
4. Test migration on dev/staging before production

## Step-by-Step

### 1. Identify the change
State clearly:
- Table name
- Column name + type
- Nullable or not (always nullable for new additions)
- Default value if any
- RLS impact

### 2. Write the SQL
Use this template (`docs/templates/SQL_CHANGE_TEMPLATE.md`):
```sql
-- Migration: [description]
-- Date: [YYYY-MM-DD]
-- Risk: low / medium / high
-- Reversible: yes / no

ALTER TABLE public.[table_name]
  ADD COLUMN [column_name] [type] NULL;

-- Verify:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '[table_name]' AND column_name = '[column_name]';
```

### 3. Update TypeScript interface
Add the new field as optional/nullable to the relevant interface in the affected page/lib.

### 4. Update Supabase select strings
Any `supabase.from(...).select(...)` that needs the new field must include it explicitly.

### 5. Handle nulls in UI
New nullable columns = legacy rows have null. UI must not crash on null. Show nothing or a fallback.

### 6. Update DATA_MODEL.md
Add the column to the table definition.

### 7. Run tsc
`npx tsc --noEmit` — must be clean.

## Known Existing Migrations (already applied)
- `financial_movements.attributed_to_type text null`
- `financial_movements.attributed_to_member_id uuid null`

## Do Not
- Do not use NOT NULL without a DEFAULT on existing tables
- Do not drop columns without confirming they have no active references
- Do not add FK constraints without confirming all existing rows have valid references
