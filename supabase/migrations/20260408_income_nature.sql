-- Migration: add income_nature to financial_movements
-- Date: 2026-04-08
-- Risk: low — nullable column, no impact on existing rows
-- Scope: income movements only (enforced in application layer)
--
-- Semantics:
--   'one_time'  → חד-פעמית  (single event, chosen explicitly by user)
--   'variable'  → משתנה     (recurring-in-nature but variable amount)
--   NULL        → legacy row (app falls back to expected_amount heuristic for display)
--
-- Backfill: not required. Legacy rows display correctly via the heuristic fallback.
-- New rows always have income_nature set explicitly on insert/update.

ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS income_nature text NULL
    CONSTRAINT financial_movements_income_nature_check
      CHECK (income_nature IN ('one_time', 'variable'));

-- Index: helps nature-based filtering queries
CREATE INDEX IF NOT EXISTS idx_fm_income_nature
  ON public.financial_movements (income_nature)
  WHERE income_nature IS NOT NULL;

-- Verify:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'financial_movements' AND column_name = 'income_nature';
