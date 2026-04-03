import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate, formatDayOfWeek, shortMonthNames } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { getCategoryMeta as getSharedCategoryMeta } from '../lib/categories';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Movement {
  id: string;
  date: string;
  description: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  amount: number;
}

interface BudgetRow {
  id: string;
  category: string;
  amount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Virtual types not in shared lib
const virtualCategoryMeta: Record<string, { name: string; icon: string; color: string }> = {
  income:   { name: 'הכנסה', icon: '💰', color: '#00A86B' },
  transfer: { name: 'העברה', icon: '↔️', color: '#6B7280' },
};

const getCategoryMeta = (id: string) =>
  virtualCategoryMeta[id] ?? getSharedCategoryMeta(id);


const getHealthMessage = (score: number): { msg: string; color: string } => {
  if (score >= 90) return { msg: 'מצוין! אתה שולט מצוין בכספים שלך 🌟', color: '#00A86B' };
  if (score >= 70) return { msg: 'טוב מאוד! כמה שיפורים קטנים יקחו אותך לרמה הבאה 👍', color: '#00A86B' };
  if (score >= 50) return { msg: 'בדרך הנכונה! המשך לעקוב ותראה שיפור 📈', color: '#F59E0B' };
  if (score >= 30) return { msg: 'כל צעד קדימה נחשב. התמקד בדבר אחד השבוע ⚡', color: '#F59E0B' };
  return { msg: 'המודעות היא הצעד הראשון. בוא נשפר יחד 💪', color: '#E53E3E' };
};

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

interface BarTooltipPayloadItem { value: number; name: string; color: string; }

const CustomBarTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: BarTooltipPayloadItem[]; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-xs font-bold text-gray-600 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name === 'income' ? 'הכנסות' : 'הוצאות'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

interface DonutTooltipItem { name: string; value: number; payload: { color: string }; }

const CustomDonutTooltip = ({ active, payload, total }: {
  active?: boolean; payload?: DonutTooltipItem[]; total: number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
      <p className="text-sm" style={{ color: payload[0].payload.color }}>{formatCurrency(payload[0].value)}</p>
      <p className="text-xs text-gray-500">{total > 0 ? Math.round((payload[0].value / total) * 100) : 0}%</p>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { user }         = useAuth();
  const { accountId }    = useAccount();
  const { currentMonth } = useMonth();
  const today            = new Date();

  // ── State ──────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [barData, setBarData]     = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [netWorth, setNetWorth]   = useState<number | null>(null);
  const [budgets, setBudgets]     = useState<BudgetRow[]>([]);

  // ── Fetch data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      setIsLoading(true);

      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString().split('T')[0];
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        .toISOString().split('T')[0];

      // 6 months ago for bar chart
      const sixMonthsAgo = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 5, 1)
        .toISOString().split('T')[0];

      const monthStart = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const [currentRes, sixMonthRes, assetsRes, loansRes, budgetsRes] = await Promise.all([
        supabase
          .from('financial_movements')
          .select('id, date, description, type, category, amount')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('financial_movements')
          .select('date, type, amount')
          .gte('date', sixMonthsAgo)
          .lte('date', endDate),
        accountId
          ? supabase.from('assets').select('value').eq('account_id', accountId)
          : Promise.resolve({ data: null, error: null }),
        accountId
          ? supabase.from('loans').select('balance').eq('account_id', accountId).eq('status', 'active')
          : Promise.resolve({ data: null, error: null }),
        accountId
          ? supabase.from('budgets').select('id, category, amount').eq('account_id', accountId).eq('month', monthStart)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (currentRes.data) {
        setMovements(currentRes.data as Movement[]);
      }

      // Build bar chart data: 6 months
      if (sixMonthRes.data) {
        const monthMap: Record<string, { income: number; expenses: number }> = {};

        // Initialize 6 month buckets
        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthMap[key] = { income: 0, expenses: 0 };
        }

        for (const row of sixMonthRes.data) {
          const key = row.date.substring(0, 7); // "YYYY-MM"
          if (monthMap[key]) {
            if (row.type === 'income') monthMap[key].income += row.amount;
            else if (row.type === 'expense') monthMap[key].expenses += row.amount;
          }
        }

        const bars = Object.entries(monthMap).map(([key, vals]) => {
          const [year, month] = key.split('-').map(Number);
          return {
            month: shortMonthNames[month - 1] ?? key,
            income: vals.income,
            expenses: vals.expenses,
          };
        });

        setBarData(bars);
      }

      // Net worth
      if (assetsRes.data && loansRes.data) {
        const totalAssets = (assetsRes.data as { value: number }[]).reduce((s, a) => s + a.value, 0);
        const totalLoans  = (loansRes.data as { balance: number }[]).reduce((s, l) => s + l.balance, 0);
        setNetWorth(totalAssets - totalLoans);
      }

      // Budgets for current month
      if (budgetsRes.data) {
        setBudgets(budgetsRes.data as BudgetRow[]);
      }

      setIsLoading(false);
    };

    fetchDashboard();
  }, [user?.id, accountId, currentMonth]);

  // ── Computed KPIs ───────────────────────────────────────────────────────
  const totalIncome   = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const totalExpenses = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const netFlow       = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? Math.round((netFlow / totalIncome) * 100) : 0;

  // Health score: rule-based from current data
  const healthScore = (() => {
    if (movements.length === 0) return 0;
    let score = 0;
    if (totalIncome > 0) score += 25;                                      // has income
    if (netFlow > 0) score += 25;                                           // positive net flow
    const sr = totalIncome > 0 ? netFlow / totalIncome : 0;
    const savingsGoal = (() => { try { return Math.max(5, Math.min(50, parseInt(localStorage.getItem('nmoney_savings_goal_pct') ?? '20', 10))) / 100; } catch { return 0.20; } })();
    score += Math.round(Math.min(sr / savingsGoal, 1) * 25);                // savings rate: user goal % = full 25pts
    if (movements.length >= 5) score += 25;                                 // tracking consistency
    return Math.min(score, 100);
  })();

  const healthInfo = getHealthMessage(healthScore);

  // Expense category breakdown for donut
  const expenseMovements = movements.filter(m => m.type === 'expense');
  const categoryTotals: Record<string, number> = {};
  for (const m of expenseMovements) {
    categoryTotals[m.category] = (categoryTotals[m.category] ?? 0) + m.amount;
  }
  const donutData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, value]) => {
      const meta = getCategoryMeta(cat);
      return {
        id:    cat,
        name:  meta.name,
        value,
        color: meta.chartColor,
        icon:  meta.icon,
      };
    });

  // Sparkline: last 6 data points from bar chart net flow
  const sparklineData = barData.map(b => ({ v: b.income - b.expenses }));

  // Recent movements: last 5
  const recentMovements = movements.slice(0, 5);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            שלום {user?.user_metadata?.full_name?.split(' ')[0] || 'שם משתמש'} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDayOfWeek(today)}, {formatDate(today)}
          </p>
        </div>
        <MonthSelector />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">

        {/* Card 1 — Income */}
        <div
          className="rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(145deg, #f0fdf8 0%, #ffffff 60%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">הכנסות</span>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}
            >
              💰
            </div>
          </div>
          <p className="text-3xl font-extrabold mb-1.5" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
            {totalIncome > 0 ? formatCurrency(totalIncome) : '—'}
          </p>
          <p className="text-xs text-gray-400">
            {movements.filter(m => m.type === 'income').length} תנועות החודש
          </p>
        </div>

        {/* Card 2 — Expenses */}
        <div
          className="rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(145deg, #fff5f5 0%, #ffffff 60%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">הוצאות</span>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)' }}
            >
              🛒
            </div>
          </div>
          <p className="text-3xl font-extrabold mb-1.5" style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
            {totalExpenses > 0 ? formatCurrency(totalExpenses) : '—'}
          </p>
          <p className="text-xs text-gray-400">
            {movements.filter(m => m.type === 'expense').length} תנועות החודש
          </p>
        </div>

        {/* Card 3 — Net cash flow */}
        <div
          className="rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(145deg, #eff6ff 0%, #ffffff 60%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">תזרים נטו</span>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)' }}
            >
              📈
            </div>
          </div>
          <p
            className="text-3xl font-extrabold mb-1.5"
            style={{ color: netFlow >= 0 ? '#00A86B' : '#E53E3E', fontVariantNumeric: 'tabular-nums' }}
          >
            {totalIncome > 0 || totalExpenses > 0
              ? `${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}`
              : '—'}
          </p>
          <p className="text-xs text-gray-400">
            {totalIncome > 0 ? `שיעור חיסכון: ${savingsRate}%` : 'הכנסות פחות הוצאות'}
          </p>
          {totalIncome > 0 && sparklineData.length > 1 && (
            <div style={{ height: 36, marginRight: -4, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height={36}>
                <AreaChart data={sparklineData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E56A0" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1E56A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#1E56A0" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Card 4 — Net worth */}
        <div
          className="rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(145deg, #fffbeb 0%, #ffffff 60%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">הון נטו</span>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}
            >
              🏦
            </div>
          </div>
          {netWorth !== null ? (
            <>
              <p
                className="text-3xl font-extrabold mb-1.5"
                style={{ color: netWorth >= 0 ? '#00A86B' : '#E53E3E', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCurrency(netWorth)}
              </p>
              <p className="text-xs text-gray-400">נכסים פחות הלוואות</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-extrabold mb-1.5 text-gray-200" style={{ fontVariantNumeric: 'tabular-nums' }}>—</p>
              <p className="text-xs text-gray-400">הוסף נכסים והלוואות</p>
            </>
          )}
        </div>
      </div>

      {/* Section label */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">ניתוח חודשי</p>

      {/* Health Score + Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Financial Health Score */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
          <h3 className="font-bold text-gray-900 mb-4">ציון בריאות פיננסית</h3>
          {movements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">הוסף נתונים כדי לחשב את ציון הבריאות</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-32 h-32">
                  <PieChart width={128} height={128}>
                    <Pie
                      data={[{ value: healthScore }, { value: 100 - healthScore }]}
                      cx={60} cy={60}
                      innerRadius={46} outerRadius={60}
                      startAngle={90} endAngle={-270}
                      dataKey="value" strokeWidth={0}
                    >
                      <Cell fill={healthScore >= 60 ? '#00A86B' : healthScore >= 30 ? '#F59E0B' : '#E53E3E'} />
                      <Cell fill="#f3f4f6" />
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {healthScore}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-center font-medium mb-4" style={{ color: healthInfo.color }}>
                {healthInfo.msg}
              </p>
              <div className="space-y-2">
                {[
                  { label: 'הכנסות', score: totalIncome > 0 ? 100 : 0, color: '#00A86B' },
                  { label: 'חיסכון', score: Math.max(0, Math.min(100, savingsRate)), color: savingsRate >= 20 ? '#00A86B' : '#F59E0B' },
                  { label: 'מעקב', score: Math.min(100, movements.length * 10), color: '#1E56A0' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{item.label}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bar Chart — Income vs Expenses (6 months) */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
          <h3 className="font-bold text-gray-900 mb-4">הכנסות מול הוצאות</h3>
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#00A86B' }} />הכנסות
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#E53E3E' }} />הוצאות
            </span>
          </div>
          {barData.some(b => b.income > 0 || b.expenses > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barGap={4} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: number) => v > 0 ? `₪${Math.round(v / 1000)}K` : '0'} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(30,86,160,0.04)' }} />
                <Bar dataKey="income" fill="#00A86B" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="expenses" fill="#E53E3E" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-400 text-sm">אין מספיק נתונים להצגה</p>
            </div>
          )}
        </div>

        {/* Donut Chart — Expense breakdown */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">חלוקת הוצאות</h3>
            <Link to="/expenses-analysis" className="text-sm font-semibold hover:underline" style={{ color: '#1E56A0' }}>
              לניתוח מלא ←
            </Link>
          </div>
          {donutData.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-400 text-sm">אין הוצאות החודש</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-2">
                <div className="relative" style={{ width: 160, height: 160 }}>
                  <PieChart width={160} height={160}>
                    <Pie data={donutData} cx={76} cy={76} innerRadius={52} outerRadius={72} dataKey="value" strokeWidth={2} stroke="#fff">
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={(props) => <CustomDonutTooltip {...props} total={totalExpenses} />} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400">סה״כ</span>
                    <span className="text-base font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {donutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Budget Status Widget — always shown */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">סטטוס תקציב חודשי</h3>
          <Link to="/budget" className="text-sm font-semibold hover:underline" style={{ color: '#1E56A0' }}>
            לניהול תקציב ←
          </Link>
        </div>
        {budgets.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-gray-500 text-sm mb-3">לא הוגדר תקציב לחודש זה</p>
            <a
              href="/budget"
              className="inline-block px-4 py-2 rounded-[10px] text-sm font-semibold text-white"
              style={{ backgroundColor: '#1E56A0' }}
            >
              הגדר תקציב עכשיו
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map(b => {
              const meta     = getCategoryMeta(b.category);
              const spent    = categoryTotals[b.category] ?? 0;
              const pct      = b.amount > 0 ? Math.min(Math.round((spent / b.amount) * 100), 100) : 0;
              const overBudget = spent > b.amount;
              const barColor = pct >= 100 ? '#E53E3E' : pct >= 75 ? '#F59E0B' : '#00A86B';
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base flex-shrink-0">{meta.icon}</span>
                      <span className="text-sm font-medium text-gray-700 truncate">{meta.name}</span>
                    </div>
                    <span className="text-xs font-semibold mr-2 flex-shrink-0" style={{ color: overBudget ? '#E53E3E' : '#6B7280' }}>
                      {formatCurrency(spent)} / {formatCurrency(b.amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 text-left">{pct}%</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section label */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">פירוט</p>

      {/* Bottom row: top categories + recent movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top expense categories */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
          <h3 className="font-bold text-gray-900 mb-4">קטגוריות הוצאה מובילות</h3>
          {donutData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📊</p>
              <p className="text-gray-400 text-sm">אין הוצאות להצגה החודש</p>
            </div>
          ) : (
            <div className="space-y-3">
              {donutData.map((cat) => {
                const percent = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ backgroundColor: cat.color + '18' }}>
                          {cat.icon}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(cat.value)}
                        </span>
                        <span className="text-xs text-gray-400 mr-1.5">{percent}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent movements */}
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">תנועות אחרונות</h3>
            <Link to="/transactions" className="text-sm font-semibold hover:underline" style={{ color: '#1E56A0' }}>
              לכל התנועות ←
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-gray-400 text-sm mb-3">אין תנועות לחודש זה</p>
              <Link to="/transactions" className="text-sm font-semibold" style={{ color: '#1E56A0' }}>הוסף תנועה ראשונה ←</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentMovements.map((m, i) => {
                const meta = getCategoryMeta(m.category);
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base flex-shrink-0">
                        {meta.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{m.description}</p>
                        <p className="text-xs text-gray-400">{meta.name} · {formatDate(m.date)}</p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: m.type === 'income' ? '#00A86B' : m.type === 'transfer' ? '#6B7280' : '#E53E3E',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {m.type === 'income' ? '+' : m.type === 'transfer' ? '' : '−'}
                      {formatCurrency(m.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
