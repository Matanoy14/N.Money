// ─── Shared recurring expense utilities ───────────────────────────────────────
// Extracted from FixedExpensesTab.tsx so BudgetPage + ExpenseAnalysisPage
// can import without circular dependencies.

type FrequencyKey = 'monthly' | 'weekly' | 'yearly' | 'bimonthly';

/**
 * Convert a recurring expense amount to its monthly equivalent.
 * @param amount        The per-interval amount
 * @param interval_unit  'week' | 'month' | 'year' (or null for legacy path)
 * @param interval_value Number of units per interval (or null for legacy path)
 * @param legacyFrequency Fallback for rows created before interval columns existed
 */
export function intervalToMonthly(
  amount: number,
  interval_unit: string | null,
  interval_value: number | null,
  legacyFrequency: FrequencyKey = 'monthly',
): number {
  if (interval_unit && interval_value && interval_value > 0) {
    switch (interval_unit) {
      case 'week':  return (amount * 52) / (12 * interval_value);
      case 'month': return amount / interval_value;
      case 'year':  return amount / (12 * interval_value);
    }
  }
  switch (legacyFrequency) {
    case 'monthly':   return amount;
    case 'weekly':    return (amount * 52) / 12;
    case 'yearly':    return amount / 12;
    case 'bimonthly': return amount / 2;
  }
  return amount;
}
