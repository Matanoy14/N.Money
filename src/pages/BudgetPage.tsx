import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '../lib/categories';

// ─── Types ─────────────────────────────────────────────────────────────────────

type BudgetTab = 'monthly' | 'trends';

interface BudgetRow {
  id: string;
  category: string;
  amount: number;
}

interface MergedCategory {
  category: string;
  budgeted: number;
  actual: number;
  remaining: number;
  overrun: number;
  utilization: number;
  budgetId?: string;
}

interface TrendPoint {
  month: string;   // YYYY-MM-01
  label: string;   // Hebrew short month name
  budgeted: number;
  actual: number;
}

interface TrendCatEntry {
  category: string;
  months: { [month: string]: { actual: number; budgeted: number; utilization: number } };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)';
const BRAND = '#1E56A0';

// ─── Category semantic group ordering ─────────────────────────────────────────
// Groups: 0=housing, 1=food, 2=dining, 3=transport, 4=communication,
//         5=health, 6=education/children, 7=personal, 8=entertainment/travel,
//         9=insurance/savings, 10=misc

const CATEGORY_GROUP_ORDER: Record<string, number> = {
  housing:       0,
  food:          1,
  entertainment: 2,
  transport:     3,
  communication: 4,
  health:        5,
  fitness:       6,
  clothing:      7,
  children:      6,
  education:     6,
  travel:        8,
  pets:          9,
  gifts:         9,
  insurance:     9,
  grooming:      7,
  other:         10,
};

function getCategoryGroup(categoryId: string): number {
  if (CATEGORY_GROUP_ORDER[categoryId] !== undefined) return CATEGORY_GROUP_ORDER[categoryId];
  return 10;
}

function sortCategoriesV2(categories: MergedCategory[]): MergedCategory[] {
  // Overrun categories always first, sorted by overrun amount desc
  const overrun = categories
    .filter(c => c.budgeted > 0 && c.overrun > 0)
    .sort((a, b) => b.overrun - a.overrun);

  // Non-overrun: sort by semantic group, then utilization desc within group
  const normal = categories
    .filter(c => !(c.budgeted > 0 && c.overrun > 0))
    .sort((a, b) => {
      const ga = getCategoryGroup(a.category);
      const gb = getCategoryGroup(b.category);
      if (ga !== gb) return ga - gb;
      const ua = isFinite(a.utilization) ? a.utilization : 1e9;
      const ub = isFinite(b.utilization) ? b.utilization : 1e9;
      return ub - ua;
    });

  return [...overrun, ...normal];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toMonthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function toMonthEnd(date: Date): string {
  // Use UTC arithmetic to avoid timezone-shift: new Date(y, m, 0) creates LOCAL
  // midnight which .toISOString() converts to the previous day in UTC+ zones.
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString().split('T')[0];
}

function getPriorMonthStart(current: Date): string {
  const d = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  return toMonthStart(d);
}

// ─── Utilization color system ─────────────────────────────────────────────────

interface UtilizationColors {
  bar: string;
  badge: string;
  badgeBg: string;
}

function getUtilizationColor(utilization: number): UtilizationColors {
  if (!isFinite(utilization)) {
    return { bar: 'bg-red-500', badge: 'text-red-700', badgeBg: 'bg-red-50' };
  }
  if (utilization > 100) {
    return { bar: 'bg-red-500', badge: 'text-red-700', badgeBg: 'bg-red-50' };
  }
  if (Math.abs(utilization - 100) < 0.01) {
    return { bar: 'bg-blue-500', badge: 'text-blue-700', badgeBg: 'bg-blue-50' };
  }
  if (utilization >= 80) {
    return { bar: 'bg-orange-500', badge: 'text-orange-700', badgeBg: 'bg-orange-50' };
  }
  if (utilization >= 50) {
    return { bar: 'bg-amber-400', badge: 'text-amber-700', badgeBg: 'bg-amber-50' };
  }
  return { bar: 'bg-green-500', badge: 'text-green-700', badgeBg: 'bg-green-50' };
}

// ─── Per-card insight logic ────────────────────────────────────────────────────

function getCategoryInsight(cat: MergedCategory): string | null {
  if (cat.budgeted === 0) return null;
  if (cat.utilization > 100) {
    return `חריגה של ${formatCurrency(cat.overrun)} — עברת את התקציב`;
  }
  if (Math.abs(cat.utilization - 100) < 0.01) {
    return 'השגת את יעד התקציב לקטגוריה זו';
  }
  if (cat.utilization >= 80) {
    return `נותרו רק ${formatCurrency(cat.remaining)} — קרוב לגבול`;
  }
  if (cat.utilization === 0 && cat.budgeted > 0) {
    return 'טרם נרשמו הוצאות בקטגוריה זו החודש';
  }
  if (cat.utilization <= 30 && cat.actual > 0) {
    return `ניצלת ${Math.round(cat.utilization)}% מהתקציב עד כה`;
  }
  return null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// Insight pill
interface InsightPillProps {
  text: string;
  type: 'warn' | 'good' | 'info';
}

const PILL_STYLES: Record<InsightPillProps['type'], { bg: string; color: string; border: string }> = {
  warn: { bg: '#FEF9EC', color: '#92400E', border: '#FDE68A' },
  good: { bg: '#F0FDF4', color: '#14532D', border: '#BBF7D0' },
  info: { bg: '#EFF6FF', color: '#1E3A5F', border: '#BFDBFE' },
};

const InsightPill: React.FC<InsightPillProps> = ({ text, type }) => {
  const s = PILL_STYLES[type];
  return (
    <div
      className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {text}
    </div>
  );
};

// Carry-forward banner
const CarryForwardBanner: React.FC<{ count: number; onDismiss: () => void }> = ({ count, onDismiss }) => (
  <div
    className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center justify-between text-sm"
    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: BRAND }}
  >
    <span className="font-medium">
      הועתקו {count} קטגוריות תקציב מהחודש הקודם. ניתן לערוך כל קטגוריה.
    </span>
    <button
      onClick={onDismiss}
      className="opacity-60 hover:opacity-100 text-lg leading-none mr-2"
    >
      ✕
    </button>
  </div>
);

// Empty state
const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="bg-white rounded-2xl p-12 text-center mx-4" style={{ boxShadow: CARD_SHADOW }}>
    <p className="text-gray-700 font-semibold text-base mb-1">הגדר את התקציב החודשי שלך</p>
    <p className="text-gray-400 text-sm mb-6">עקוב אחר ההוצאות שלך מול היעד החודשי</p>
    <button
      onClick={onAdd}
      className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
      style={{ backgroundColor: BRAND, boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
    >
      הוסף קטגוריה
    </button>
  </div>
);

// Loading spinner
const LoadingSpinner: React.FC = () => (
  <div className="bg-white rounded-2xl p-12 text-center mx-4" style={{ boxShadow: CARD_SHADOW }}>
    <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
    <p className="text-gray-400 text-sm">טוען תקציב...</p>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const BudgetPage: React.FC = () => {
  const { user }         = useAuth();
  const { accountId }    = useAccount();
  const { currentMonth } = useMonth();

  // ── Tab state ────────────────────────────────────────────────────────────
  const [budgetTab, setBudgetTab] = useState<BudgetTab>('monthly');

  // ── Data state ──────────────────────────────────────────────────────────
  const [budgets, setBudgets]               = useState<BudgetRow[]>([]);
  const [variableMap, setVariableMap]       = useState<Record<string, number>>({});
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [carriedForward, setCarriedForward] = useState(false);
  const [carriedCount, setCarriedCount]     = useState(0);

  // ── Donut selection ──────────────────────────────────────────────────────
  const [selectedDonutCat, setSelectedDonutCat] = useState<string | null>(null);

  // ── Prior month ──────────────────────────────────────────────────────────
  const [priorMonthActual, setPriorMonthActual] = useState<number | null>(null);

  // ── Loans integration ────────────────────────────────────────────────────
  const [totalLoanPayments, setTotalLoanPayments] = useState(0);

  // ── Trends state ─────────────────────────────────────────────────────────
  const [trendPeriod, setTrendPeriod]       = useState<3 | 6 | 12 | 'ytd'>(6);
  const [trendData, setTrendData]           = useState<TrendPoint[]>([]);
  const [trendCatData, setTrendCatData]     = useState<TrendCatEntry[]>([]);
  const [trendsLoading, setTrendsLoading]   = useState(false);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [showPanel, setShowPanel]         = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [formCategory, setFormCategory]   = useState(EXPENSE_CATEGORIES[0].id);
  const [formAmount, setFormAmount]       = useState('');
  const [isSaving, setIsSaving]           = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [prefillCategory, setPrefillCategory] = useState<string | null>(null);

  // ── Inline edit state ────────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId]       = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // ── Month string ─────────────────────────────────────────────────────────
  const monthStart = toMonthStart(currentMonth);

  // ── sessionStorage cache key ─────────────────────────────────────────────
  const CACHE_KEY = `nmoney_budget_data_${monthStart}`;

  // ── Core fetch ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user || !accountId) return;
    setError(null);
    setCarriedForward(false);

    // Try cache first — show instantly, no spinner on background refresh
    let showedCache = false;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { budgets: cb, variableMap: cv } = JSON.parse(cached);
        setBudgets(cb);
        setVariableMap(cv);
        setLoading(false);
        showedCache = true;
      }
    } catch {}

    // Only show spinner if there was no cache to display immediately
    if (!showedCache) setLoading(true);

    const startDate = monthStart;
    const endDate   = toMonthEnd(new Date(monthStart));

    // Prior month date range
    const priorEnd = new Date(monthStart);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorEndStr = priorEnd.toISOString().slice(0, 10);
    // Use Date.UTC to avoid LOCAL midnight → UTC shift (same bug pattern as toMonthEnd)
    const priorStartStr = new Date(Date.UTC(priorEnd.getUTCFullYear(), priorEnd.getUTCMonth(), 1))
      .toISOString().slice(0, 10);

    const [budgetRes, movRes, priorMovRes, loansRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('id, category, amount')
        .eq('account_id', accountId)
        .eq('month', monthStart),
      supabase
        .from('financial_movements')
        .select('category, amount')
        .eq('type', 'expense')
        .eq('account_id', accountId)
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('financial_movements')
        .select('amount')
        .eq('type', 'expense')
        .eq('account_id', accountId)
        .gte('date', priorStartStr)
        .lte('date', priorEndStr),
      supabase
        .from('loans')
        .select('monthly_payment, status')
        .eq('account_id', accountId)
        .eq('status', 'active'),
    ]);

    if (budgetRes.error) {
      setError('שגיאה בטעינת התקציב.');
      setLoading(false);
      return;
    }

    let fetchedBudgets: BudgetRow[] = (budgetRes.data ?? []) as BudgetRow[];

    // ── Carry-forward logic ─────────────────────────────────────────────
    if (fetchedBudgets.length === 0) {
      const sessionKey = `nmoney_budget_carried_${monthStart}`;
      if (!sessionStorage.getItem(sessionKey)) {
        const priorMonth = getPriorMonthStart(new Date(monthStart));
        const { data: priorData } = await supabase
          .from('budgets')
          .select('category, amount')
          .eq('account_id', accountId)
          .eq('month', priorMonth);

        if (priorData && priorData.length > 0) {
          const { error: insertErr } = await supabase.from('budgets').insert(
            priorData.map((b: { category: string; amount: number }) => ({
              account_id: accountId,
              month:      monthStart,
              category:   b.category,
              amount:     b.amount,
            })),
          );
          if (!insertErr) {
            sessionStorage.setItem(sessionKey, '1');
            setCarriedForward(true);
            setCarriedCount(priorData.length);
          }

          const { data: refetchedBudgets } = await supabase
            .from('budgets')
            .select('id, category, amount')
            .eq('account_id', accountId)
            .eq('month', monthStart);
          fetchedBudgets = (refetchedBudgets ?? []) as BudgetRow[];
        }
      }
    }

    // Variable spending map — confirmed movements only
    const vm: Record<string, number> = {};
    if (movRes.data) {
      for (const m of movRes.data) {
        vm[m.category] = (vm[m.category] ?? 0) + m.amount;
      }
    }

    setBudgets(fetchedBudgets);
    setVariableMap(vm);

    // Prior month actual
    const priorTotal = (priorMovRes.data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);
    setPriorMonthActual(priorTotal);

    // Active loans monthly total
    const loanTotal = (loansRes.data ?? []).reduce((sum, l) => sum + (l.monthly_payment ?? 0), 0);
    setTotalLoanPayments(loanTotal);

    // Cache results
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ budgets: fetchedBudgets, variableMap: vm }));
    } catch {}

    setLoading(false);
  }, [user, accountId, monthStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // Focus inline input when it opens
  useEffect(() => {
    if (inlineEditId && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEditId]);

  // ── Trends fetch ────────────────────────────────────────────────────────
  const fetchTrends = useCallback(async (period: 3 | 6 | 12 | 'ytd') => {
    if (!accountId) return;
    setTrendsLoading(true);

    const months: string[] = [];
    if (period === 'ytd') {
      // Parse year/month directly from the YYYY-MM-DD string to avoid
      // timezone-shift bugs: new Date(year, m, 1).toISOString() converts
      // local midnight to UTC, which shifts the date backward in UTC+ zones.
      const [yearStr, monthStr] = monthStart.split('-');
      const currentYear = parseInt(yearStr, 10);
      const currentMonth = parseInt(monthStr, 10); // 1-based (Jan=1)
      for (let m = 1; m <= currentMonth; m++) {
        months.push(`${currentYear}-${String(m).padStart(2, '0')}-01`);
      }
    } else {
      for (let i = period - 1; i >= 0; i--) {
        const d = new Date(monthStart);
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7) + '-01');
      }
    }

    const rangeStart = months[0];
    const rangeEndDate = new Date(monthStart);
    rangeEndDate.setMonth(rangeEndDate.getMonth() + 1);
    rangeEndDate.setDate(rangeEndDate.getDate() - 1);
    const rangeEndStr = rangeEndDate.toISOString().slice(0, 10);

    const [budgetRes, movRes] = await Promise.all([
      supabase.from('budgets').select('month, category, amount').eq('account_id', accountId).in('month', months),
      supabase.from('financial_movements').select('date, category, amount').eq('type', 'expense').eq('account_id', accountId).gte('date', rangeStart.slice(0, 10)).lte('date', rangeEndStr),
    ]);

    const budgetByMonth: Record<string, number> = {};
    const actualByMonth: Record<string, number> = {};
    months.forEach(m => { budgetByMonth[m] = 0; actualByMonth[m] = 0; });

    (budgetRes.data ?? []).forEach(r => { budgetByMonth[r.month] = (budgetByMonth[r.month] ?? 0) + r.amount; });
    (movRes.data ?? []).forEach(r => {
      const m = r.date.slice(0, 7) + '-01';
      actualByMonth[m] = (actualByMonth[m] ?? 0) + r.amount;
    });

    const points: TrendPoint[] = months.map(m => ({
      month: m,
      label: new Date(m).toLocaleDateString('he-IL', { month: 'short' }),
      budgeted: budgetByMonth[m],
      actual: actualByMonth[m],
    }));
    setTrendData(points);

    // Top 5 categories by total budgeted for heat table
    const catBudgetTotals: Record<string, number> = {};
    (budgetRes.data ?? []).forEach(r => { catBudgetTotals[r.category] = (catBudgetTotals[r.category] ?? 0) + r.amount; });
    const top5cats = Object.entries(catBudgetTotals).sort((a, b) => b[1] - a[1]).map(([c]) => c);

    const budgetByCatMonth: Record<string, Record<string, number>> = {};
    const actualByCatMonth: Record<string, Record<string, number>> = {};
    top5cats.forEach(cat => {
      budgetByCatMonth[cat] = {};
      actualByCatMonth[cat] = {};
      months.forEach(m => { budgetByCatMonth[cat][m] = 0; actualByCatMonth[cat][m] = 0; });
    });

    (budgetRes.data ?? []).forEach(r => { if (budgetByCatMonth[r.category]) budgetByCatMonth[r.category][r.month] = r.amount; });
    (movRes.data ?? []).forEach(r => {
      const m = r.date.slice(0, 7) + '-01';
      if (actualByCatMonth[r.category]) actualByCatMonth[r.category][m] = (actualByCatMonth[r.category][m] ?? 0) + r.amount;
    });

    const entries: TrendCatEntry[] = top5cats.map(cat => ({
      category: cat,
      months: Object.fromEntries(months.map(m => [m, {
        actual: actualByCatMonth[cat][m] ?? 0,
        budgeted: budgetByCatMonth[cat][m] ?? 0,
        utilization: budgetByCatMonth[cat][m] > 0
          ? (actualByCatMonth[cat][m] ?? 0) / budgetByCatMonth[cat][m] * 100
          : 0,
      }])),
    }));
    setTrendCatData(entries);
    setTrendsLoading(false);
  }, [accountId, monthStart]);

  useEffect(() => {
    if (budgetTab === 'trends' && accountId && monthStart) {
      fetchTrends(trendPeriod);
    }
  }, [budgetTab, trendPeriod, accountId, monthStart, fetchTrends]);

  // ── Open panel helpers ──────────────────────────────────────────────────
  const openAdd = (category?: string) => {
    setEditingBudget(null);
    setFormCategory(category ?? EXPENSE_CATEGORIES[0].id);
    setFormAmount('');
    setPrefillCategory(category ?? null);
    setShowPanel(true);
  };

  const closePanel = () => {
    setShowPanel(false);
    setEditingBudget(null);
    setFormCategory(EXPENSE_CATEGORIES[0].id);
    setFormAmount('');
    setPrefillCategory(null);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(formAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    setIsSaving(true);
    sessionStorage.removeItem(CACHE_KEY);

    if (editingBudget) {
      const { data, error: err } = await supabase
        .from('budgets')
        .update({ amount: rawAmount })
        .eq('id', editingBudget.id)
        .select('id, category, amount')
        .single();

      setIsSaving(false);
      if (err) { setError('שגיאה בעדכון התקציב.'); return; }
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? (data as BudgetRow) : b));
    } else {
      const existing = budgets.find(b => b.category === formCategory);
      if (existing) {
        setError(`כבר קיים תקציב לקטגוריה "${getCategoryMeta(formCategory).name}" החודש.`);
        setIsSaving(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('budgets')
        .insert({
          account_id: accountId,
          month:      monthStart,
          category:   formCategory,
          amount:     rawAmount,
        })
        .select('id, category, amount')
        .single();

      setIsSaving(false);
      if (err) { setError('שגיאה בשמירת התקציב.'); return; }
      setBudgets(prev => [...prev, data as BudgetRow]);
    }

    closePanel();
  };

  // ── Inline edit save ────────────────────────────────────────────────────
  const handleInlineSave = async (budgetId: string) => {
    const val = parseFloat(inlineEditValue);
    if (isNaN(val) || val <= 0) {
      setInlineEditId(null);
      return;
    }
    sessionStorage.removeItem(CACHE_KEY);
    const { data, error: err } = await supabase
      .from('budgets')
      .update({ amount: val })
      .eq('id', budgetId)
      .select('id, category, amount')
      .single();

    if (!err && data) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? (data as BudgetRow) : b));
    }
    setInlineEditId(null);
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!accountId) return;
    setDeletingId(id);
    sessionStorage.removeItem(CACHE_KEY);
    const { error: err } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);
    setDeletingId(null);
    if (err) { setError('שגיאה במחיקת התקציב.'); return; }
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  // ── Computed: merged categories ─────────────────────────────────────────
  const allCategories = Array.from(new Set([
    ...budgets.map(b => b.category),
    ...Object.keys(variableMap),
  ]));

  const mergedCategories: MergedCategory[] = allCategories.map(cat => {
    const budgetRow = budgets.find(b => b.category === cat);
    const budgeted  = budgetRow?.amount ?? 0;
    const actual    = variableMap[cat] ?? 0;
    const remaining = budgeted - actual;
    const overrun   = Math.max(0, actual - budgeted);
    const utilization = budgeted > 0
      ? (actual / budgeted) * 100
      : (actual > 0 ? Infinity : 0);

    return { category: cat, budgeted, actual, remaining, overrun, utilization, budgetId: budgetRow?.id };
  });

  const sortedCategories = sortCategoriesV2(mergedCategories);

  const missingBudgetCategories = mergedCategories.filter(c => c.budgeted === 0 && c.actual > 0);

  // KPIs
  const totalBudgeted  = budgets.reduce((s, b) => s + b.amount, 0);
  const totalActual    = mergedCategories.reduce((s, c) => s + c.actual, 0);
  const totalRemaining = totalBudgeted - totalActual;

  // Global insights pills
  interface Insight { text: string; type: 'good' | 'warn' | 'info' }
  const insights: Insight[] = [];

  // Pill 1: month-over-month comparison
  if (priorMonthActual !== null && priorMonthActual > 0 && totalActual > 0) {
    const momPct = Math.round(((totalActual - priorMonthActual) / priorMonthActual) * 100);
    if (momPct > 0) {
      insights.push({ text: `סך הוצאות גדל ב-${momPct}% לעומת חודש קודם`, type: 'warn' });
    } else if (momPct < 0) {
      insights.push({ text: `סך הוצאות קטן ב-${Math.abs(momPct)}% לעומת חודש קודם`, type: 'good' });
    } else {
      insights.push({ text: 'הוצאות זהות לחודש קודם', type: 'info' });
    }
  }

  // Pill 2: unbudgeted count
  if (missingBudgetCategories.length > 0) {
    insights.push({
      text: `${missingBudgetCategories.length} קטגוריות עם הוצאות ללא תקציב`,
      type: 'warn',
    });
  }

  const hasAnyActual = totalActual > 0;
  const hasContent   = budgets.length > 0 || hasAnyActual;

  // Available categories (not yet budgeted this month)
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !budgets.find(b => b.category === c.id));

  // Donut data
  const donutData = [...budgets]
    .sort((a, b) => b.amount - a.amount)
    .map(b => {
      const meta = getCategoryMeta(b.category);
      return { category: b.category, name: meta.name, value: b.amount, color: meta.chartColor ?? BRAND };
    });

  // ── Legend: semantic group ordering for the hero left-third ──────────────
  const legendData = [...donutData].sort((a, b) => {
    const ga = getCategoryGroup(a.category);
    const gb = getCategoryGroup(b.category);
    return ga !== gb ? ga - gb : b.value - a.value;
  });

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen pb-24 lg:pb-8" style={{ backgroundColor: '#F0F4FA' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">תקציב</h1>
          {budgetTab === 'monthly' && <MonthSelector />}
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: BRAND, boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold text-base leading-none">+</span>
          הוסף קטגוריה
        </button>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <div className="px-4 mb-4 mt-2">
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
          <button
            onClick={() => setBudgetTab('monthly')}
            className={`flex-1 text-sm py-1.5 rounded-lg transition-colors ${
              budgetTab === 'monthly'
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ניתוח חודשי
          </button>
          <button
            onClick={() => setBudgetTab('trends')}
            className={`flex-1 text-sm py-1.5 rounded-lg transition-colors ${
              budgetTab === 'trends'
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            מגמות
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div
          className="mx-4 mb-4 flex items-center justify-between gap-3 px-5 py-3 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* ── Carry-forward banner ────────────────────────────────────────── */}
      {carriedForward && (
        <CarryForwardBanner
          count={carriedCount}
          onDismiss={() => setCarriedForward(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MONTHLY TAB
          ════════════════════════════════════════════════════════════════════ */}
      {budgetTab === 'monthly' && (
        <>
          {/* ── Loading ─────────────────────────────────────────────────── */}
          {loading && <LoadingSpinner />}

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {!loading && !hasContent && (
            <EmptyState onAdd={() => openAdd()} />
          )}

          {/* ── Main content ────────────────────────────────────────────── */}
          {!loading && hasContent && (
            <>
              {/* ── HERO CARD ────────────────────────────────────────────── */}
              <div style={{ boxShadow: CARD_SHADOW }} className="bg-white rounded-2xl py-5 mb-4 mx-4">

                {/* Rebalanced macro: 1fr 1.7fr 1fr — center still dominant but narrower, sides wider.
                    RTL: JSX col-1 = visual RIGHT (KPI), JSX col-2 = CENTER (donut), JSX col-3 = visual LEFT (legend).
                    border-l on cols 1+2 creates full-height separators. */}
                <div className="grid" style={{ gridTemplateColumns: '1fr 1.7fr 1fr' }}>

                  {/* ── Col 1 (visual RIGHT): KPI totals block ── */}
                  <div className="border-l border-gray-200 flex flex-col justify-center px-2 py-4">
                    <div className="bg-gray-50 rounded-xl px-2 py-3 space-y-3 text-center" style={{ border: '1px solid #E5E7EB' }}>
                      {/* תקציב */}
                      <div>
                        <p className="text-[16px] text-gray-400 font-medium mb-0.5">תקציב</p>
                        <p className="text-[18px] font-bold text-[#1E56A0] tabular-nums leading-tight">
                          {formatCurrency(totalBudgeted)}
                        </p>
                      </div>
                      {/* שימוש בפועל */}
                      <div>
                        <p className="text-[16px] text-gray-400 font-medium mb-0.5">שימוש בפועל</p>
                        <p className="text-[18px] font-bold text-gray-800 tabular-nums leading-tight">
                          {formatCurrency(totalActual)}
                        </p>
                      </div>
                      {/* יתרה / חריגה */}
                      <div>
                        <p className="text-[16px] text-gray-400 font-medium mb-0.5">
                          {totalRemaining >= 0 ? 'יתרה' : 'חריגה'}
                        </p>
                        <p className={`text-[18px] font-bold tabular-nums leading-tight ${totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(totalRemaining))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Col 2 (CENTER): Enlarged donut — 148×148, 5px SVG margin, ring width 25px ── */}
                  <div className="border-l border-gray-200 flex flex-col items-center justify-center py-2">
                    {budgets.length > 0 && (
                      <div className="relative">
                        <PieChart width={148} height={148}>
                          <Pie
                            data={donutData}
                            cx={74}
                            cy={74}
                            innerRadius={44}
                            outerRadius={69}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={2}
                            onClick={(entry: { category: string }) => setSelectedDonutCat(
                              selectedDonutCat === entry.category ? null : entry.category
                            )}
                            style={{ cursor: 'pointer' }}
                          >
                            {donutData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.color}
                                opacity={selectedDonutCat && selectedDonutCat !== entry.category ? 0.35 : 1}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const item = payload[0];
                              const total = donutData.reduce((s, d) => s + d.value, 0);
                              const pct = total > 0 ? Math.round(((item.value as number) / total) * 100) : 0;
                              return (
                                <div
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-md"
                                  style={{ backgroundColor: item.payload?.color ?? '#1E56A0' }}
                                >
                                  {item.name}: {pct}%
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] text-gray-400 leading-none mb-1">שנוצל</span>
                          <span className="text-base font-bold text-gray-700 tabular-nums leading-none">
                            {totalBudgeted > 0 ? `${Math.round((totalActual / totalBudgeted) * 100)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Col 3 (visual LEFT): 2-column legend, all categories visible ── */}
                  <div className="py-4 px-2 flex flex-col justify-center">
                    {budgets.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 text-center">
                        {legendData.map((d) => (
                          <div key={d.category} className="flex items-center gap-1 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-[14px] text-gray-600 truncate leading-none">{d.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Goals awareness ── */}
                {hasContent && (
                  <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between gap-2 px-5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎯</span>
                      <p className="text-sm text-gray-500">יעדי חיסכון — הגדר יעדים כדי לתכנן חיסכון חודשי</p>
                    </div>
                    <Link to="/goals" className="text-xs text-[#1E56A0] hover:underline shrink-0">הגדר ›</Link>
                  </div>
                )}
              </div>

              {/* Insights strip */}
              {insights.length > 0 && (
                <div className="flex gap-2 overflow-x-auto px-4 mb-4 pb-0.5" style={{ scrollbarWidth: 'none' }}>
                  {insights.map((ins, i) => (
                    <InsightPill key={i} text={ins.text} type={ins.type} />
                  ))}
                </div>
              )}

              {/* Category cards — responsive grid (loan obligations card first, then budget categories) */}
              {(totalLoanPayments > 0 || sortedCategories.filter(c => c.budgeted > 0).length > 0) && (
                <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {/* Loan obligations card — synthetic read-only card, appears first */}
                  {totalLoanPayments > 0 && (
                    <div style={{ boxShadow: CARD_SHADOW }} className="bg-white rounded-2xl p-4">
                      {/* Row 1: Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏦</span>
                          <span className="text-sm font-semibold text-gray-800">תשלומי הלוואות</span>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">מחויב</span>
                      </div>
                      {/* Row 2: Amount */}
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-400">תשלום חודשי מחויב</span>
                        <span className="text-base font-semibold text-gray-800 tabular-nums">{formatCurrency(totalLoanPayments)}</span>
                      </div>
                      {/* Row 3: Link to loans module */}
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                        <Link to="/loans" className="text-xs text-[#1E56A0] hover:underline">לניהול הלוואות ›</Link>
                        <span className="text-xs text-gray-400">ללא גבול תקציב</span>
                      </div>
                    </div>
                  )}
                  {sortedCategories
                    .filter(c => c.budgeted > 0)
                    .map(cat => {
                      const meta            = getCategoryMeta(cat.category);
                      const pct             = Math.min(isFinite(cat.utilization) ? cat.utilization : 100, 100);
                      const colors          = getUtilizationColor(cat.utilization);
                      const isDeleting      = deletingId === cat.budgetId;
                      const isInlineEditing = inlineEditId === cat.budgetId;
                      const insight         = getCategoryInsight(cat);

                      let statusText: string;
                      if (!isFinite(cat.utilization) && cat.actual > 0) {
                        statusText = 'אין תקציב';
                      } else if (cat.utilization > 100) {
                        statusText = 'חריגה';
                      } else if (Math.abs(cat.utilization - 100) < 0.01) {
                        statusText = 'הגעת ליעד';
                      } else {
                        statusText = isFinite(cat.utilization) ? `${Math.round(cat.utilization)}%` : '—';
                      }

                      const middleLabel = cat.overrun > 0
                        ? `חריגה ${formatCurrency(cat.overrun)}`
                        : `יתרה ${formatCurrency(cat.remaining)}`;

                      return (
                        <div
                          key={cat.category}
                          className={`bg-white rounded-2xl p-4 transition-all ${selectedDonutCat === cat.category ? 'ring-2 ring-[#1E56A0] ring-offset-1' : ''}`}
                          style={{ boxShadow: CARD_SHADOW, opacity: isDeleting ? 0.5 : 1 }}
                        >
                          {/* Row 1: icon + name + status badge */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                                {meta.icon}
                              </div>
                              <span className="text-sm font-semibold text-gray-900 truncate">{meta.name}</span>
                            </div>
                            <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full flex-shrink-0 mr-2 ${colors.badgeBg} ${colors.badge}`}>
                              {statusText}
                            </span>
                          </div>

                          {/* Row 2: progress bar */}
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Row 3: amounts */}
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                            <span className="tabular-nums">{formatCurrency(cat.actual)} בפועל</span>
                            <span className={`tabular-nums font-medium ${cat.overrun > 0 ? colors.badge : 'text-gray-500'}`}>
                              {middleLabel}
                            </span>
                            {isInlineEditing ? (
                              <span className="flex items-center gap-1">
                                <span className="text-gray-400">תקציב:</span>
                                <input
                                  ref={inlineInputRef}
                                  type="number"
                                  value={inlineEditValue}
                                  onChange={e => setInlineEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleInlineSave(cat.budgetId!);
                                    if (e.key === 'Escape') setInlineEditId(null);
                                  }}
                                  onBlur={() => handleInlineSave(cat.budgetId!)}
                                  className="w-20 border border-[#1E56A0] rounded px-1 py-0.5 text-xs text-center focus:outline-none"
                                  style={{ fontVariantNumeric: 'tabular-nums' }}
                                />
                              </span>
                            ) : (
                              <button
                                className="tabular-nums text-gray-400 hover:underline hover:text-[#1E56A0] transition-colors"
                                onClick={() => {
                                  if (cat.budgetId) {
                                    setInlineEditId(cat.budgetId);
                                    setInlineEditValue(String(cat.budgeted));
                                  }
                                }}
                                title="לחץ לעריכה"
                              >
                                תקציב {formatCurrency(cat.budgeted)}
                              </button>
                            )}
                          </div>

                          {/* Row 4: per-card insight */}
                          {insight && (
                            <p className="text-xs text-gray-400 mt-1">{insight}</p>
                          )}

                          {/* Row 5: navigation + delete */}
                          <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-gray-50">
                            <Link to="/expenses" className="text-xs text-[#1E56A0] hover:underline">
                              ראה בהוצאות
                            </Link>
                            {cat.budgetId && (
                              <button
                                onClick={() => handleDelete(cat.budgetId!)}
                                disabled={isDeleting}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed"
                                title="מחק תקציב"
                              >
                                מחק
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Missing budget nudge */}
              {missingBudgetCategories.length > 0 && (
                <div
                  className="mx-4 mb-4 rounded-2xl p-4"
                  style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}
                >
                  <p className="text-sm font-semibold text-amber-800 mb-2.5">קטגוריות ללא תקציב</p>
                  <div className="space-y-2">
                    {missingBudgetCategories.map(mc => {
                      const meta = getCategoryMeta(mc.category);
                      return (
                        <div key={mc.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm flex-shrink-0">{meta.icon}</span>
                            <span className="text-sm text-gray-700 truncate">{meta.name}</span>
                            <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{formatCurrency(mc.actual)}</span>
                          </div>
                          <button
                            onClick={() => openAdd(mc.category)}
                            className="text-xs px-3 py-1 rounded-lg font-semibold transition hover:opacity-80 flex-shrink-0 mr-2"
                            style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
                          >
                            הגדר
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TRENDS TAB
          ════════════════════════════════════════════════════════════════════ */}
      {budgetTab === 'trends' && (
        <div className="px-4 pb-6">
          {/* Period selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {([3, 6, 12] as const).map(p => (
              <button
                key={p}
                onClick={() => setTrendPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  trendPeriod === p
                    ? 'bg-[#1E56A0] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p} חודשים
              </button>
            ))}
            <button
              onClick={() => setTrendPeriod('ytd')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                trendPeriod === 'ytd'
                  ? 'bg-[#1E56A0] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              מתחילת השנה
            </button>
          </div>

          {trendsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1E56A0]" />
            </div>
          ) : (
            <>
              {/* Budget vs actual BarChart */}
              <div style={{ boxShadow: CARD_SHADOW }} className="bg-white rounded-2xl p-4 mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-1">תקציב מול הוצאות</p>
                <p className="text-xs text-gray-400 mb-3">השוואה חודשית</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={trendData} barGap={2} barCategoryGap="30%">
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={() => ''} />
                    <Bar dataKey="budgeted" fill="#BFDBFE" radius={[3, 3, 0, 0]} name="תקציב" />
                    <Bar dataKey="actual" fill="#1E56A0" radius={[3, 3, 0, 0]} name="בפועל" />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-500">{v}</span>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category utilization heat table — all categories + average column */}
              {trendCatData.length > 0 && (
                <div style={{ boxShadow: CARD_SHADOW }} className="bg-white rounded-2xl p-4 mb-4">
                  <p className="text-sm font-semibold text-gray-600 mb-3">ניצול תקציב לפי קטגוריה</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" dir="rtl">
                      <thead>
                        <tr>
                          <th className="text-right text-gray-400 font-medium pb-2 pr-1">קטגוריה</th>
                          {trendData.map(p => (
                            <th key={p.month} className="text-center text-gray-400 font-medium pb-2 px-1 min-w-[44px]">{p.label}</th>
                          ))}
                          <th className="text-center text-gray-500 font-semibold pb-2 px-1 min-w-[44px]">ממוצע</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendCatData.map(entry => {
                          const meta = getCategoryMeta(entry.category);
                          const monthsWithBudget = Object.values(entry.months).filter(m => m.budgeted > 0);
                          const avgUtil = monthsWithBudget.length > 0
                            ? monthsWithBudget.reduce((s, m) => s + m.utilization, 0) / monthsWithBudget.length
                            : 0;
                          const avgColors = getUtilizationColor(avgUtil);
                          return (
                            <tr key={entry.category}>
                              <td className="py-1 pr-1 text-gray-700 font-medium whitespace-nowrap">{meta.name}</td>
                              {trendData.map(p => {
                                const cell = entry.months[p.month];
                                const u = cell?.utilization ?? 0;
                                const colors = getUtilizationColor(u);
                                const cellBg = u === 0 ? '' : colors.badgeBg;
                                return (
                                  <td key={p.month} className={`py-1 px-1 text-center rounded ${cellBg}`}>
                                    <span className={u === 0 ? 'text-gray-300' : colors.badge}>
                                      {u === 0 ? '—' : `${Math.round(u)}%`}
                                    </span>
                                  </td>
                                );
                              })}
                              {/* Average utilization column */}
                              <td className={`py-1 px-1 text-center rounded font-semibold ${avgUtil === 0 ? '' : avgColors.badgeBg}`}>
                                <span className={avgUtil === 0 ? 'text-gray-300' : avgColors.badge}>
                                  {avgUtil === 0 ? '—' : `${Math.round(avgUtil)}%`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Monthly budget vs actual — LINE CHART */}
              {trendData.length > 0 && (
                <div style={{ boxShadow: CARD_SHADOW }} className="bg-white rounded-2xl p-4 mb-4">
                  <p className="text-sm font-semibold text-gray-600 mb-1">מגמת תקציב מול ביצוע</p>
                  <p className="text-xs text-gray-400 mb-3">השוואה חודשית לפי תקופה</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid stroke="#F3F4F6" strokeDasharray="0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
                              <p className="font-semibold text-gray-800 mb-1.5">{label}</p>
                              {payload.map((p, i) => (
                                <p key={i} className="tabular-nums" style={{ color: p.color }}>
                                  {p.name}: {formatCurrency(p.value as number)}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="budgeted"
                        name="תקציב"
                        stroke="#93C5FD"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#93C5FD', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="בפועל"
                        stroke="#1E56A0"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#1E56A0', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => <span className="text-xs text-gray-500">{v}</span>}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Add / Edit Panel ─────────────────────────────────────────────── */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div
            className="fixed top-0 right-0 bottom-0 w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}
          >
            <div className="p-6" dir="rtl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingBudget ? 'עריכת תקציב' : 'תקציב חדש'}
                </h2>
                <button
                  onClick={closePanel}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                {editingBudget && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{getCategoryMeta(editingBudget.category).icon}</span>
                    <span className="font-semibold text-gray-900">{getCategoryMeta(editingBudget.category).name}</span>
                  </div>
                )}

                {!editingBudget && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                    {availableCategories.length === 0 ? (
                      <p className="text-sm text-gray-500">כל הקטגוריות כבר מתוקצבות החודש.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                        {(prefillCategory
                          ? availableCategories.filter(c => c.id === prefillCategory).concat(
                              availableCategories.filter(c => c.id !== prefillCategory)
                            )
                          : availableCategories
                        ).map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setFormCategory(cat.id)}
                            className="flex flex-col items-center gap-1 p-2.5 border-2 rounded-xl transition-all"
                            style={
                              formCategory === cat.id
                                ? { borderColor: BRAND, backgroundColor: '#E8F0FB' }
                                : { borderColor: '#E5E7EB' }
                            }
                          >
                            <span className="text-xl">{cat.icon}</span>
                            <span
                              className="text-[10px] font-medium text-center leading-tight"
                              style={{ color: formCategory === cat.id ? BRAND : '#6B7280' }}
                            >
                              {cat.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום תקציב חודשי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving || !formAmount || (!editingBudget && availableCategories.length === 0)}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: BRAND, boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
                >
                  {isSaving ? 'שומר...' : editingBudget ? 'עדכן תקציב' : 'שמור תקציב'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BudgetPage;
