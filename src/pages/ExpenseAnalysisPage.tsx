import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, shortMonthNames } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { getCategoryMeta, SUBCATEGORIES } from '../lib/categories';
import { PAYMENT_METHODS, resolvePaymentDisplay } from '../lib/paymentMethods';
import { intervalToMonthly } from '../components/expenses/FixedExpensesTab';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Movement {
  id: string;
  date: string;
  description: string;
  category: string;
  sub_category: string | null;
  payment_method: string;
  payment_source_id: string | null;
  amount: number;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
}

interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  sub_category: string | null;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'bimonthly';
  interval_unit: string | null;
  interval_value: number | null;
  payment_method: string;
  payment_source_id: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
}

interface MonthlyPoint {
  month: string;   // "ינו׳ 26"
  total: number;
  fixed: number;
  variable: number;
}

type PageTab = 'monthly' | 'trends';
type TypeFilter = 'all' | 'variable' | 'fixed';
type TrendPeriod = 3 | 6 | 12;

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)';

// ─── Tooltip ───────────────────────────────────────────────────────────────────

const DonutTooltip = ({ active, payload, total }: {
  active?: boolean;
  payload?: readonly { name: string; value: number; payload: { color: string } }[];
  total: number;
}) => {
  if (!active || !payload?.length) return null;
  const pct = total > 0 ? Math.round((payload[0].value / total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl p-2.5 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-xs font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-xs" style={{ color: payload[0].payload.color }}>{formatCurrency(payload[0].value)}</p>
      <p className="text-xs text-gray-400">{pct}%</p>
    </div>
  );
};

const AreaTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { value?: unknown; dataKey?: string | number | ((obj: unknown) => unknown) }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold text-gray-800">{typeof p.value === 'number' ? formatCurrency(p.value) : '—'}</p>
      ))}
    </div>
  );
};

const StackedTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { value?: unknown; dataKey?: string | number | ((obj: unknown) => unknown); color?: string; name?: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? '#ccc' }} />
          <span className="text-xs text-gray-700">{p.name ?? ''}</span>
          <span className="text-xs font-semibold text-gray-800 mr-auto" style={{ fontVariantNumeric: 'tabular-nums' }}>{typeof p.value === 'number' ? formatCurrency(p.value) : '—'}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

const ExpenseAnalysisPage: React.FC = () => {
  const { user }                     = useAuth();
  const { accountId, paymentSources, isCouple, isFamily, members } = useAccount();
  const { currentMonth }             = useMonth();
  const navigate         = useNavigate();

  // ── Page-level tab ──────────────────────────────────────────────────────────
  const [pageTab, setPageTab] = useState<PageTab>('monthly');

  // ── Monthly tab state ───────────────────────────────────────────────────────
  const [movements,          setMovements]          = useState<Movement[]>([]);
  const [recurringExpenses,  setRecurringExpenses]  = useState<RecurringExpense[]>([]);
  const [isLoading,          setIsLoading]          = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [selectedCat,        setSelectedCat]        = useState<string | null>(null);
  const [paymentFilter,      setPaymentFilter]      = useState<string>('all');
  const [attributionFilter,  setAttributionFilter]  = useState<string>('all');
  const [typeFilter,         setTypeFilter]         = useState<TypeFilter>('all');

  // ── Trends tab state ────────────────────────────────────────────────────────
  const [trendPeriod,    setTrendPeriod]    = useState<TrendPeriod>(6);
  const [trendData,      setTrendData]      = useState<MonthlyPoint[]>([]);
  const [trendLoading,   setTrendLoading]   = useState(false);
  const [trendCatData,   setTrendCatData]   = useState<{ category: string; name: string; icon: string; color: string; months: Record<string, number> }[]>([]);

  // ── Fetch monthly data (movements + recurring templates) ────────────────────
  const fetchMovements = useCallback(async () => {
    if (!user || !accountId) return;
    setIsLoading(true);
    setError(null);

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const [movRes, recRes] = await Promise.all([
      supabase
        .from('financial_movements')
        .select('id, date, description, category, sub_category, payment_method, payment_source_id, amount, attributed_to_type, attributed_to_member_id')
        .eq('account_id', accountId)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('recurring_expenses')
        .select('id, description, category, sub_category, amount, frequency, interval_unit, interval_value, payment_method, payment_source_id, attributed_to_type, attributed_to_member_id')
        .eq('account_id', accountId)
        .eq('is_active', true),
    ]);

    if (movRes.error) {
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } else {
      setMovements((movRes.data ?? []) as Movement[]);
    }
    setRecurringExpenses((recRes.data ?? []) as RecurringExpense[]);
    setIsLoading(false);
  }, [user?.id, accountId, currentMonth]);

  useEffect(() => {
    if (pageTab === 'monthly') fetchMovements();
  }, [fetchMovements, pageTab]);

  // ── Fetch trends data ───────────────────────────────────────────────────────
  const fetchTrends = useCallback(async () => {
    if (!user || !accountId) return;
    setTrendLoading(true);

    // Build month ranges: last N months including current
    const months: { year: number; month: number; start: string; end: string; label: string }[] = [];
    for (let i = trendPeriod - 1; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end   = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const label = `${shortMonthNames[month]} ${String(year).slice(2)}`;
      months.push({ year, month, start, end, label });
    }

    const earliest = months[0].start;
    const latest   = months[months.length - 1].end;

    // Fetch all expense movements in the range
    const { data: expData } = await supabase
      .from('financial_movements')
      .select('date, category, amount, attributed_to_type')
      .eq('account_id', accountId)
      .eq('type', 'expense')
      .gte('date', earliest)
      .lte('date', latest);

    const rows = (expData ?? []) as { date: string; category: string; amount: number; attributed_to_type: string | null }[];

    // Build monthly totals
    const points: MonthlyPoint[] = months.map(m => {
      const inMonth = rows.filter(r => r.date >= m.start && r.date <= m.end);
      const total = inMonth.reduce((s, r) => s + r.amount, 0);
      return { month: m.label, total, fixed: 0, variable: total };
    });

    setTrendData(points);

    // Fetch fixed expense templates to compute monthly fixed projection per month
    const { data: recurringData } = await supabase
      .from('recurring_expenses')
      .select('amount, interval_unit, interval_value, frequency')
      .eq('account_id', accountId)
      .eq('is_active', true);

    if (recurringData && recurringData.length > 0) {
      const fixedMonthly = recurringData.reduce((s: number, e: { amount: number; interval_unit: string | null; interval_value: number | null; frequency: string }) => {
        // Simple monthly projection
        if (e.interval_unit === 'month' || e.frequency === 'monthly') return s + e.amount;
        if (e.interval_unit === 'week' || e.frequency === 'weekly') return s + e.amount * 4;
        if (e.interval_unit === 'year' || e.frequency === 'yearly') return s + e.amount / 12;
        if (e.frequency === 'bimonthly') return s + e.amount / 2;
        return s + e.amount;
      }, 0);

      // Apply fixed projection to all months (as an estimate)
      setTrendData(pts => pts.map(p => ({
        ...p,
        fixed: Math.round(fixedMonthly),
        variable: Math.max(0, p.total - Math.round(fixedMonthly)),
      })));
    }

    // Category trends: top categories across period
    const catTotals: Record<string, number> = {};
    rows.forEach(r => { catTotals[r.category] = (catTotals[r.category] ?? 0) + r.amount; });
    const topCats = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const catRows: typeof trendCatData = topCats.map(cat => {
      const meta = getCategoryMeta(cat);
      const monthAmounts: Record<string, number> = {};
      months.forEach(m => {
        const inMonth = rows.filter(r => r.date >= m.start && r.date <= m.end && r.category === cat);
        monthAmounts[m.label] = inMonth.reduce((s, r) => s + r.amount, 0);
      });
      return { category: cat, name: meta.name, icon: meta.icon, color: meta.chartColor, months: monthAmounts };
    });

    setTrendCatData(catRows);
    setTrendLoading(false);
  }, [user?.id, accountId, currentMonth, trendPeriod]);

  useEffect(() => {
    if (pageTab === 'trends') fetchTrends();
  }, [fetchTrends, pageTab]);

  // ── Recurring projected amounts ─────────────────────────────────────────────

  // Project each recurring template to a monthly amount for the current month
  const recurringWithMonthly = recurringExpenses.map(r => ({
    ...r,
    monthlyAmount: intervalToMonthly(r.amount, r.interval_unit, r.interval_value, r.frequency),
  }));

  const fixedTotal = recurringWithMonthly.reduce((s, r) => s + r.monthlyAmount, 0);

  // ── Apply attribution filter to recurring expenses ──────────────────────────
  const filteredRecurring = (() => {
    if (!isCouple && !isFamily) return recurringWithMonthly;
    if (attributionFilter === 'all') return recurringWithMonthly;
    if (attributionFilter === 'shared') return recurringWithMonthly.filter(r => r.attributed_to_type === 'shared');
    if (attributionFilter === 'unattributed') return recurringWithMonthly.filter(r => !r.attributed_to_type);
    return recurringWithMonthly.filter(r => r.attributed_to_type === 'member' && r.attributed_to_member_id === attributionFilter);
  })();

  // ── Monthly derived data ────────────────────────────────────────────────────

  // Payment-filter movements
  const paymentFiltered = paymentFilter === 'all'
    ? movements
    : paymentSources.length > 0
      ? movements.filter(m => m.payment_source_id === paymentFilter)
      : movements.filter(m => m.payment_method === paymentFilter);

  // Attribution-filter movements
  const filtered = (() => {
    if (!isCouple && !isFamily) return paymentFiltered;
    if (attributionFilter === 'all') return paymentFiltered;
    if (attributionFilter === 'shared') return paymentFiltered.filter(m => m.attributed_to_type === 'shared');
    if (attributionFilter === 'unattributed') return paymentFiltered.filter(m => !m.attributed_to_type);
    return paymentFiltered.filter(m => m.attributed_to_type === 'member' && m.attributed_to_member_id === attributionFilter);
  })();

  const hasUnattributed = (isCouple || isFamily) && movements.some(m => !m.attributed_to_type);

  // Total for the full month (no filters) — basis for breakdown %s
  const totalMovements  = movements.reduce((s, m) => s + m.amount, 0);
  const variableTotal   = filtered.reduce((s, m) => s + m.amount, 0);
  const filteredFixedTotal = filteredRecurring.reduce((s, r) => s + r.monthlyAmount, 0);

  // KPI total depends on mode
  const totalExpenses = typeFilter === 'all'
    ? variableTotal + filteredFixedTotal
    : typeFilter === 'variable'
      ? variableTotal
      : filteredFixedTotal;

  // Payment breakdown — always from full movements
  const pmBreakdown: Record<string, { name: string; color: string; amount: number }> = {};
  for (const m of movements) {
    const key = m.payment_source_id ?? m.payment_method;
    if (!pmBreakdown[key]) {
      const display = resolvePaymentDisplay(m.payment_source_id, m.payment_method, paymentSources);
      pmBreakdown[key] = { name: display.name, color: display.color, amount: 0 };
    }
    pmBreakdown[key].amount += m.amount;
  }
  const pmList = Object.entries(pmBreakdown)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([, v]) => v);

  // Attribution totals — always from full movements
  const attrTotals: Record<string, number> = {};
  if (isCouple || isFamily) {
    for (const m of movements) {
      const key = m.attributed_to_type === 'member' && m.attributed_to_member_id
        ? m.attributed_to_member_id
        : m.attributed_to_type === 'shared'
          ? '__shared__'
          : '__unattributed__';
      attrTotals[key] = (attrTotals[key] ?? 0) + m.amount;
    }
  }

  // Category totals — from variable movements (for "הכל" and "משתנות" modes)
  const categoryTotals: Record<string, number> = {};
  for (const m of filtered) {
    categoryTotals[m.category] = (categoryTotals[m.category] ?? 0) + m.amount;
  }

  // Category totals from recurring (for "קבועות" mode)
  const fixedCategoryTotals: Record<string, number> = {};
  for (const r of filteredRecurring) {
    fixedCategoryTotals[r.category] = (fixedCategoryTotals[r.category] ?? 0) + r.monthlyAmount;
  }

  // Which category list to show in donut/ranking
  const activeCategoryTotals = typeFilter === 'fixed' ? fixedCategoryTotals : categoryTotals;
  const activeTotal = typeFilter === 'fixed' ? filteredFixedTotal : variableTotal;

  const categoryList = Object.entries(activeCategoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => {
      const meta = getCategoryMeta(id);
      return { id, name: meta.name, icon: meta.icon, color: meta.chartColor, amount };
    });

  // Subcategory drill-down (variable movements only — recurring have no individual transactions)
  const selectedMeta = selectedCat ? getCategoryMeta(selectedCat) : null;
  const catMovements = selectedCat ? filtered.filter(m => m.category === selectedCat) : [];
  const subTotals: Record<string, number> = {};
  for (const m of catMovements) {
    const key = m.sub_category || 'ללא פירוט';
    subTotals[key] = (subTotals[key] ?? 0) + m.amount;
  }
  const subList = Object.entries(subTotals).sort((a, b) => b[1] - a[1]);

  // Fixed category list for summary card in "הכל" mode
  const fixedCategoryList = Object.entries(fixedCategoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => {
      const meta = getCategoryMeta(id);
      return { id, name: meta.name, icon: meta.icon, color: meta.chartColor, amount };
    });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/expenses')}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-xl"
            title="חזרה להוצאות"
          >
            ‹
          </button>
          <h1 className="text-xl font-semibold text-gray-900">ניתוח הוצאות</h1>
          {/* MonthSelector only for monthly tab */}
          {pageTab === 'monthly' && <MonthSelector />}
        </div>
      </div>

      {/* ── Page tab nav: חודשי / מגמות ─────────────────────────────────────── */}
      <div className="flex gap-0 bg-gray-100 rounded-xl p-1 mb-4 w-full sm:w-fit">
        {([
          { key: 'monthly' as PageTab, label: 'חודשי' },
          { key: 'trends'  as PageTab, label: 'מגמות' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => {
              setPageTab(t.key);
              setSelectedCat(null);
            }}
            className="flex-1 sm:flex-none px-6 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200 select-none"
            style={pageTab === t.key
              ? { backgroundColor: '#1E56A0', color: '#fff', boxShadow: '0 1px 4px rgba(30,86,160,0.3)' }
              : { color: '#6b7280', backgroundColor: 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MONTHLY TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'monthly' && (
        <>
          {/* Error banner */}
          {error && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
              style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
            </div>
          )}

          {/* ── Type filter (FIRST) ────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-xs font-semibold text-gray-400 flex-shrink-0 pr-1">סוג:</span>
            {([
              { key: 'all'      as TypeFilter, label: 'הכל'    },
              { key: 'variable' as TypeFilter, label: 'משתנות' },
              { key: 'fixed'    as TypeFilter, label: 'קבועות' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => { setTypeFilter(opt.key); setSelectedCat(null); }}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                style={typeFilter === opt.key
                  ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ── Attribution filter (couple/family only) ────────────────────── */}
          {(isCouple || isFamily) && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-xs font-semibold text-gray-400 flex-shrink-0 pr-1">לפי שיוך:</span>
              {[
                { key: 'all', label: 'הכל' },
                { key: 'shared', label: 'משותף' },
                ...members.map(m => ({ key: m.id, label: m.name, color: m.avatarColor })),
                ...(hasUnattributed ? [{ key: 'unattributed', label: 'לא משויך' }] : []),
              ].map(opt => {
                const isActive = attributionFilter === opt.key;
                const color = (opt as { color?: string }).color;
                return (
                  <button
                    key={opt.key}
                    onClick={() => { setAttributionFilter(opt.key); setSelectedCat(null); }}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                    style={isActive
                      ? { backgroundColor: color ?? '#1E56A0', color: '#fff', borderColor: color ?? '#1E56A0' }
                      : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Payment filter (hidden in קבועות mode — recurring has no per-transaction payment filter) */}
          {typeFilter !== 'fixed' && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              <span className="text-xs font-semibold text-gray-400 flex-shrink-0 pr-1">לפי תשלום:</span>
              <button
                onClick={() => setPaymentFilter('all')}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                style={paymentFilter === 'all'
                  ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {paymentSources.length > 0 ? 'כל המקורות' : 'כל אמצעי התשלום'}
              </button>
              {paymentSources.length > 0
                ? paymentSources.map(src => (
                    <button
                      key={src.id}
                      onClick={() => setPaymentFilter(src.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                      style={paymentFilter === src.id
                        ? { backgroundColor: src.color, color: '#fff', borderColor: src.color }
                        : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                    >
                      {src.name}
                    </button>
                  ))
                : PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentFilter(pm.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                      style={paymentFilter === pm.id
                        ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                        : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                    >
                      {pm.name}
                    </button>
                  ))
              }
            </div>
          )}
          {typeFilter === 'fixed' && <div className="mb-3" />}

          {/* ── Loading ────────────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: CARD_SHADOW }}>
              <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">טוען נתונים...</p>
            </div>

          ) : typeFilter === 'fixed' ? (
            /* ══ FIXED / RECURRING MODE ══ */
            filteredRecurring.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-700 font-semibold mb-1">אין הוצאות קבועות פעילות</p>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  הוסף הוצאות קבועות בלשונית הקבועות כדי לראות אותן כאן.
                </p>
              </div>
            ) : (
              <>
                {/* KPI for recurring */}
                <div className="bg-white rounded-2xl p-5 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-gray-400 mb-1">
                    הוצאות קבועות — צפי חודשי
                  </p>
                  <p className="text-3xl font-semibold text-gray-900 mb-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(filteredFixedTotal)}
                  </p>
                  <p className="text-xs text-gray-400">{filteredRecurring.length} התחייבויות פעילות · צפי בלבד</p>
                </div>

                {/* Recurring category donut */}
                {categoryList.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                    <p className="text-sm font-semibold text-gray-600 mb-3">חלוקה לפי קטגוריה</p>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                        <ResponsiveContainer width={160} height={160}>
                          <PieChart>
                            <Pie
                              data={categoryList}
                              cx={80}
                              cy={80}
                              innerRadius={48}
                              outerRadius={70}
                              dataKey="amount"
                              nameKey="name"
                              strokeWidth={2}
                              stroke="#fff"
                            >
                              {categoryList.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={(props) => <DonutTooltip {...props} total={filteredFixedTotal} />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] text-gray-400">סה״כ</span>
                          <span className="text-sm font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(filteredFixedTotal)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 w-full space-y-1.5 min-w-0">
                        {categoryList.slice(0, 6).map(cat => {
                          const pct = filteredFixedTotal > 0 ? Math.round((cat.amount / filteredFixedTotal) * 100) : 0;
                          return (
                            <div key={cat.id} className="w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="text-gray-700 truncate">{cat.name}</span>
                              </div>
                              <span className="font-semibold text-gray-800 mr-2 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(cat.amount)}
                                <span className="text-gray-400 text-[10px] mr-1"> · {pct}%</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recurring obligations list */}
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <p className="text-sm font-semibold text-gray-600 mb-3">רשימת התחייבויות</p>
                  <div className="space-y-2">
                    {filteredRecurring.map(r => {
                      const meta = getCategoryMeta(r.category);
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: meta.chartColor + '18' }}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{meta.name}</span>
                              {r.sub_category && (
                                <span className="text-xs text-gray-400">· {r.sub_category}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-gray-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(r.monthlyAmount)}
                            </p>
                            <p className="text-xs text-gray-400">לחודש</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attribution breakdown for recurring (couple/family) */}
                {(isCouple || isFamily) && filteredRecurring.length > 0 && (() => {
                  const rAttrTotals: Record<string, number> = {};
                  for (const r of filteredRecurring) {
                    const key = r.attributed_to_type === 'member' && r.attributed_to_member_id
                      ? r.attributed_to_member_id
                      : r.attributed_to_type === 'shared'
                        ? '__shared__'
                        : '__unattributed__';
                    rAttrTotals[key] = (rAttrTotals[key] ?? 0) + r.monthlyAmount;
                  }
                  return (
                    <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-600">חלוקה לפי שיוך</p>
                        <span className="text-xs text-gray-400">צפי חודשי</span>
                      </div>
                      <div className="space-y-2.5">
                        {members.map(m => {
                          const amt = rAttrTotals[m.id] ?? 0;
                          if (amt === 0) return null;
                          const pct = filteredFixedTotal > 0 ? Math.round((amt / filteredFixedTotal) * 100) : 0;
                          return (
                            <div key={m.id} className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: m.avatarColor }}>
                                {m.name[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                                  <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(amt)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m.avatarColor }} />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                            </div>
                          );
                        })}
                        {(rAttrTotals['__shared__'] ?? 0) > 0 && (() => {
                          const amt = rAttrTotals['__shared__'];
                          const pct = filteredFixedTotal > 0 ? Math.round((amt / filteredFixedTotal) * 100) : 0;
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: '#6B728020', color: '#6B7280' }}>מ</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-800">משותף</span>
                                  <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(amt)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#9CA3AF' }} />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                            </div>
                          );
                        })()}
                        {(rAttrTotals['__unattributed__'] ?? 0) > 0 && (() => {
                          const amt = rAttrTotals['__unattributed__'];
                          const pct = filteredFixedTotal > 0 ? Math.round((amt / filteredFixedTotal) * 100) : 0;
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>?</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-400">לא משויך</span>
                                  <span className="text-sm font-bold text-gray-500 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(amt)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#D1D5DB' }} />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </>
            )

          ) : filtered.length === 0 && (typeFilter === 'variable' || (typeFilter === 'all' && fixedTotal === 0)) ? (
            <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: CARD_SHADOW }}>
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-500 font-medium">אין הוצאות לתקופה זו</p>
              {(paymentFilter !== 'all' || attributionFilter !== 'all') && (
                <p className="text-sm text-gray-400 mt-1">נסה לשנות את הסינון</p>
              )}
            </div>

          ) : (
            <>
              {/* ── KPI card ──────────────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl p-5 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-[11px] font-medium uppercase tracking-widest text-gray-400 mb-1">
                  {typeFilter === 'all' ? 'סה״כ הוצאות החודש' : 'הוצאות משתנות החודש'}
                </p>
                <p className="text-3xl font-semibold text-gray-900 mb-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(totalExpenses)}
                </p>
                {typeFilter === 'all' ? (
                  <p className="text-xs text-gray-400">
                    {filtered.length} תנועות משתנות
                    {filteredFixedTotal > 0 && ` · קבועות (צפי): ${formatCurrency(filteredFixedTotal)}`}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">{filtered.length} תנועות</p>
                )}
              </div>

              {/* ── Fixed summary card (הכל mode only) ───────────────────────── */}
              {typeFilter === 'all' && fixedCategoryList.length > 0 && (
                <div className="bg-white rounded-2xl p-5 mb-5 border border-blue-100" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">הוצאות קבועות לחודש זה</p>
                      <p className="text-xs text-gray-400 mt-0.5">צפי חודשי — {recurringWithMonthly.length} התחייבויות</p>
                    </div>
                    <p className="text-base font-semibold text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(fixedTotal)}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {fixedCategoryList.slice(0, 5).map(cat => {
                      const pct = fixedTotal > 0 ? Math.round((cat.amount / fixedTotal) * 100) : 0;
                      return (
                        <div key={cat.id} className="flex items-center gap-2">
                          <span className="text-sm leading-none">{cat.icon}</span>
                          <span className="text-xs text-gray-600 flex-1 truncate">{cat.name}</span>
                          <span className="text-xs font-semibold text-gray-700 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cat.amount)}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-center">{pct}%</span>
                        </div>
                      );
                    })}
                    {fixedCategoryList.length > 5 && (
                      <p className="text-xs text-gray-400 pt-1">ועוד {fixedCategoryList.length - 5} קטגוריות נוספות</p>
                    )}
                  </div>
                  <button
                    onClick={() => setTypeFilter('fixed')}
                    className="mt-3 text-xs font-semibold"
                    style={{ color: '#1E56A0' }}
                  >
                    צפה בפירוט קבועות ›
                  </button>
                </div>
              )}

              {/* ── Donut chart (variable data only for הכל / משתנות) ─────────── */}
              {categoryList.length > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <p className="text-sm font-semibold text-gray-600 mb-1">חלוקה לפי קטגוריה</p>
                  {typeFilter === 'all' && (
                    <p className="text-xs text-gray-400 mb-3">הוצאות משתנות בלבד</p>
                  )}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={categoryList}
                            cx={80}
                            cy={80}
                            innerRadius={48}
                            outerRadius={70}
                            dataKey="amount"
                            nameKey="name"
                            strokeWidth={2}
                            stroke="#fff"
                            onClick={(entry) => { const id = (entry as unknown as { id: string }).id; setSelectedCat(selectedCat === id ? null : id); }}
                            style={{ cursor: 'pointer' }}
                          >
                            {categoryList.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={entry.color}
                                opacity={selectedCat && selectedCat !== entry.id ? 0.3 : 1}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={(props) => <DonutTooltip {...props} total={activeTotal} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-gray-400">סה״כ</span>
                        <span className="text-sm font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(activeTotal)}
                        </span>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 w-full space-y-1.5 min-w-0">
                      {categoryList.slice(0, 6).map(cat => {
                        const pct = activeTotal > 0 ? Math.round((cat.amount / activeTotal) * 100) : 0;
                        const isSelected = selectedCat === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                            className="w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5 transition-colors"
                            style={{ backgroundColor: isSelected ? cat.color + '18' : 'transparent' }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-gray-700 truncate">{cat.name}</span>
                            </div>
                            <span className="font-semibold text-gray-800 mr-2 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(cat.amount)}
                              <span className="text-gray-400 text-[10px] mr-1"> · {pct}%</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payment breakdown ─────────────────────────────────────────── */}
              {totalMovements > 0 && pmList.length > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-600">חלוקה לפי אמצעי תשלום</p>
                    <span className="text-xs text-gray-400">כל החודש</span>
                  </div>
                  <div className="space-y-2.5">
                    {pmList.map(pm => {
                      const pct = totalMovements > 0 ? Math.round((pm.amount / totalMovements) * 100) : 0;
                      return (
                        <div key={pm.name} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: pm.color }}>
                            {pm.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800">{pm.name}</span>
                              <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(pm.amount)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: pm.color }} />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Attribution breakdown (couple/family) ─────────────────────── */}
              {(isCouple || isFamily) && totalMovements > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-600">חלוקה לפי שיוך</p>
                    <span className="text-xs text-gray-400">כל החודש</span>
                  </div>
                  <div className="space-y-2.5">
                    {members.map(m => {
                      const amt = attrTotals[m.id] ?? 0;
                      if (amt === 0) return null;
                      const pct = totalMovements > 0 ? Math.round((amt / totalMovements) * 100) : 0;
                      return (
                        <div key={m.id} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: m.avatarColor }}>
                            {m.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                              <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(amt)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: m.avatarColor }} />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                        </div>
                      );
                    })}
                    {(attrTotals['__shared__'] ?? 0) > 0 && (() => {
                      const amt = attrTotals['__shared__'];
                      const pct = Math.round((amt / totalMovements) * 100);
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#6B728020', color: '#6B7280' }}>
                            מ
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800">משותף</span>
                              <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(amt)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: '#9CA3AF' }} />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                        </div>
                      );
                    })()}
                    {(attrTotals['__unattributed__'] ?? 0) > 0 && (() => {
                      const amt = attrTotals['__unattributed__'];
                      const pct = Math.round((amt / totalMovements) * 100);
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>
                            ?
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-400">לא משויך</span>
                              <span className="text-sm font-bold text-gray-500 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(amt)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: '#D1D5DB' }} />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-center">{pct}%</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── Category ranking with drill-down ─────────────────────────── */}
              {categoryList.length > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-600">קטגוריות לפי סכום</h3>
                    {selectedCat && (
                      <button
                        onClick={() => setSelectedCat(null)}
                        className="text-sm font-semibold px-4 py-1.5 rounded-full border border-[#1E56A0]/20"
                        style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
                      >
                        נקה ✕
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {categoryList.map((cat, i) => {
                      const pct = activeTotal > 0 ? (cat.amount / activeTotal) * 100 : 0;
                      const isSelected = selectedCat === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCat(isSelected ? null : cat.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all text-right"
                          style={isSelected
                            ? { borderColor: cat.color, backgroundColor: cat.color + '0D' }
                            : { borderColor: 'transparent', backgroundColor: '#f9fafb' }}
                        >
                          <span className="text-gray-400 text-xs font-bold w-5 text-center flex-shrink-0">{i + 1}</span>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: cat.color + '18' }}>
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                              <span className="text-sm font-semibold text-gray-800 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(cat.amount)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 mr-1">{Math.round(pct)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Drill-down panel (variable movements only) ────────────────── */}
              {selectedCat && selectedMeta && catMovements.length > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                        style={{ backgroundColor: selectedMeta.chartColor + '18' }}>
                        {selectedMeta.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">{selectedMeta.name}</h3>
                        <p className="text-xs text-gray-400">
                          {formatCurrency(categoryTotals[selectedCat] ?? 0)} • {catMovements.length} תנועות
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCat(null)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {SUBCATEGORIES[selectedCat] && subList.length > 1 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">פירוט</p>
                      <div className="space-y-1.5">
                        {subList.map(([sub, amt]) => {
                          const catTotal = categoryTotals[selectedCat] ?? 1;
                          const pct = Math.round((amt / catTotal) * 100);
                          return (
                            <div key={sub} className="flex items-center gap-3">
                              <span className="text-xs text-gray-600 w-24 sm:w-32 truncate flex-shrink-0">{sub}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: selectedMeta.chartColor }} />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 flex-shrink-0 w-16 text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(amt)}
                              </span>
                              <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-center">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">תנועות</p>
                  <div className="space-y-2">
                    {catMovements.map(m => {
                      const pm = resolvePaymentDisplay(m.payment_source_id, m.payment_method, paymentSources);
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{m.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                              {m.sub_category && (
                                <span className="text-xs text-gray-400">· {m.sub_category}</span>
                              )}
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: pm.color + '15', color: pm.color }}>
                                {pm.name}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-800 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(m.amount)}
                          </span>
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

      {/* ══════════════════════════════════════════════════════════════════════
          TRENDS TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'trends' && (
        <>
          {/* Period selector */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-xs font-semibold text-gray-400 flex-shrink-0 pr-1">תקופה:</span>
            {([3, 6, 12] as TrendPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setTrendPeriod(p)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                style={trendPeriod === p
                  ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {p} חודשים
              </button>
            ))}
          </div>

          {trendLoading ? (
            <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: CARD_SHADOW }}>
              <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">טוען מגמות...</p>
            </div>
          ) : trendData.length === 0 || trendData.every(p => p.total === 0) ? (
            <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: CARD_SHADOW }}>
              <p className="text-4xl mb-3">📈</p>
              <p className="text-gray-500 font-medium">אין נתונים לתקופה זו</p>
              <p className="text-sm text-gray-400 mt-1">הוסף הוצאות כדי לראות מגמות</p>
            </div>
          ) : (
            <>
              {/* ── Area chart: monthly total spend ──────────────────────────── */}
              <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-sm font-semibold text-gray-600 mb-1">סה״כ הוצאות לפי חודש</p>
                <p className="text-xs text-gray-400 mb-3">מגמה כללית</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1E56A0" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1E56A0" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `₪${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`}
                      width={52}
                    />
                    <Tooltip content={(props) => <AreaTooltip {...props} />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#1E56A0"
                      strokeWidth={2.5}
                      fill="url(#totalGrad)"
                      dot={{ r: 3, fill: '#1E56A0', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#1E56A0' }}
                      name="סה״כ"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Stacked bar chart: fixed vs variable ─────────────────────── */}
              <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-sm font-semibold text-gray-600 mb-1">קבועות לעומת משתנות</p>
                <p className="text-xs text-gray-400 mb-3">פירוט לפי חודש (צפי קבועות + משתנות בפועל)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barSize={trendPeriod === 12 ? 16 : 22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `₪${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`}
                      width={52}
                    />
                    <Tooltip content={(props) => <StackedTooltip {...props} />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, direction: 'rtl', paddingTop: 8 }}
                    />
                    <Bar dataKey="variable" name="משתנות"       stackId="a" fill="#1E56A0" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="fixed"    name="קבועות (צפי)" stackId="a" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Category trends table ─────────────────────────────────────── */}
              {trendCatData.length > 0 && (
                <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: CARD_SHADOW }}>
                  <p className="text-sm font-semibold text-gray-600 mb-1">קטגוריות מובילות לאורך זמן</p>
                  <p className="text-xs text-gray-400 mb-3">סה״כ לפי חודש — 5 קטגוריות מובילות</p>

                  {/* Month headers */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right" style={{ direction: 'rtl', minWidth: 400 }}>
                      <thead>
                        <tr>
                          <th className="text-xs text-gray-500 font-semibold pb-2 pr-0 pl-3 text-right w-32">קטגוריה</th>
                          {trendData.map(p => (
                            <th key={p.month} className="text-xs text-gray-400 font-medium pb-2 px-2 text-center whitespace-nowrap">
                              {p.month}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trendCatData.map(cat => {
                          const maxAmt = Math.max(...Object.values(cat.months), 1);
                          return (
                            <tr key={cat.category} className="border-t border-gray-50">
                              <td className="py-2 pr-0 pl-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base leading-none">{cat.icon}</span>
                                  <span className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{cat.name}</span>
                                </div>
                              </td>
                              {trendData.map(p => {
                                const amt = cat.months[p.month] ?? 0;
                                const intensity = maxAmt > 0 ? amt / maxAmt : 0;
                                return (
                                  <td key={p.month} className="py-2 px-2 text-center">
                                    <div
                                      className="inline-block px-2 py-1 rounded-lg text-xs font-semibold"
                                      style={{
                                        backgroundColor: amt === 0 ? 'transparent' : cat.color + Math.round(intensity * 40 + 15).toString(16).padStart(2, '0'),
                                        color: amt === 0 ? '#d1d5db' : '#1f2937',
                                        fontVariantNumeric: 'tabular-nums',
                                        minWidth: 48,
                                      }}
                                    >
                                      {amt === 0 ? '—' : `₪${Math.round(amt).toLocaleString('he-IL')}`}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ExpenseAnalysisPage;
