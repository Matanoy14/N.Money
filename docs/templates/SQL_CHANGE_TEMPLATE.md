# SQL Change Template

Use when writing a Supabase migration. See `docs/skills/DB_CHANGE_PLAYBOOK.md` for full process.

---

## Migration: [Description]

**Date:** YYYY-MM-DD
**Table:** `table_name`
**Type:** Add column / Add index / Add constraint / Create table

---

### SQL

```sql
-- Migration: [description]
-- Date: YYYY-MM-DD

ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS column_name data_type DEFAULT default_value;

-- If adding index:
CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column_name);

-- If adding RLS policy:
-- (paste policy here)
```

---

### Rollback

```sql
-- Rollback: removes the change above
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
```

---

### TypeScript Update Required

- [ ] Update interface in `src/lib/XxxTypes.ts` or inline in the page file
- [ ] Update Supabase `.select()` string in relevant page/context
- [ ] If new column in `payment_sources`: update `PaymentSource` interface in `paymentMethods.ts`

---

### Test

1. Run migration in Supabase SQL editor
2. Verify column appears in table editor
3. Insert a row with the new column — verify no constraint errors
4. Load the relevant page — verify data loads correctly
5. Run `npx tsc --noEmit` — verify no TypeScript errors

---

### Notes

Any special considerations (nullable vs not-null, default behavior on existing rows, etc.)
