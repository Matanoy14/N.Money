import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { getCategoryMeta, SUBCATEGORIES } from '../lib/categories';
import { PAYMENT_METHODS, resolvePaymentDisplay } from '../lib/paymentMethods';

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

// ─── Tooltip ───────────────────────────────────────────────────────────────────

const DonutTooltip = ({ active, payload, total }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
  total: number;
}) => {
  if (!active || !payload?.length) return null;
  const pct = total > 0 ? Math.round((payload[0].value / total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-100 text-right" style={{ direction: 'rtl' }}>
      <p className="text-sm font-bold text-gray-900">{payload[0].name}</p>
      <p className="text-sm" style={{ color: payload[0].payload.color }}>{formatCurrency(payload[0].value)}</p>
      <p className="text-xs text-gray-400">{pct}%</p>
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

const ExpenseAnalysisPage: React.FC = () => {
  const { user }                     = useAuth();
  const { paymentSources, isCouple, isFamily, members } = useAccount();
  const { currentMonth }             = useMonth();
  const navigate         = useNavigate();

  const [movements,        setMovements]        = useState<Movement[]>([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [selectedCat,      setSelectedCat]      = useState<string | null>(null);
  const [paymentFilter,    setPaymentFilter]    = useState<string>('all');
  const [attributionFilter, setAttributionFilter] = useState<string>('all');
  // 'all' | 'shared' | 'unattributed' | member user_id

  // ── Fetch expense movements for current month ─────────────────────────────
  const fetchMovements = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const { data, error: fetchError } = await supabase
      .from('financial_movements')
      .select('id, date, description, category, sub_category, payment_method, payment_source_id, amount, attributed_to_type, attributed_to_member_id')
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (fetchError) {
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } else {
      setMovements((data ?? []) as Movement[]);
    }
    setIsLoading(false);
  }, [user?.id, currentMonth]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const paymentFiltered = paymentFilter === 'all'
    ? movements
    : paymentSources.length > 0
      ? movements.filter(m => m.payment_source_id === paymentFilter)
      : movements.filter(m => m.payment_method === paymentFilter);

  const filtered = (() => {
    if (!isCouple && !isFamily) return paymentFiltered;
    if (attributionFilter === 'all') return paymentFiltered;
    if (attributionFilter === 'shared') return paymentFiltered.filter(m => m.attributed_to_type === 'shared');
    if (attributionFilter === 'unattributed') return paymentFiltered.filter(m => !m.attributed_to_type);
    return paymentFiltered.filter(m => m.attributed_to_type === 'member' && m.attributed_to_member_id === attributionFilter);
  })();

  const hasUnattributed = (isCouple || isFamily) && paymentFiltered.some(m => !m.attributed_to_type);

  // Attribution totals (from paymentFiltered, not filtered — shows full household split)
  const attrTotals: Record<string, number> = {};
  if (isCouple || isFamily) {
    for (const m of paymentFiltered) {
      const key = m.attributed_to_type === 'member' && m.attributed_to_member_id
        ? m.attributed_to_member_id
        : m.attributed_to_type === 'shared'
          ? '__shared__'
          : '__unattributed__';
      attrTotals[key] = (attrTotals[key] ?? 0) + m.amount;
    }
  }
  const paymentFilteredTotal = paymentFiltered.reduce((s, m) => s + m.amount, 0);

  const totalExpenses = filtered.reduce((s, m) => s + m.amount, 0);

  // Category totals — all categories (not capped at 5 like dashboard)
  const categoryTotals: Record<string, number> = {};
  for (const m of filtered) {
    categoryTotals[m.category] = (categoryTotals[m.category] ?? 0) + m.amount;
  }
  const categoryList = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => {
      const meta = getCategoryMeta(id);
      return { id, name: meta.name, icon: meta.icon, color: meta.chartColor, amount };
    });

  // Subcategory breakdown for selected category
  const selectedMeta = selectedCat ? getCategoryMeta(selectedCat) : null;
  const catMovements = selectedCat
    ? filtered.filter(m => m.category === selectedCat)
    : [];
  const subTotals: Record<string, number> = {};
  for (const m of catMovements) {
    const key = m.sub_category || 'ללא פירוט';
    subTotals[key] = (subTotals[key] ?? 0) + m.amount;
  }
  const subList = Object.entries(subTotals).sort((a, b) => b[1] - a[1]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-xl"
            title="חזרה לדשבורד"
          >
            ‹
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900">ניתוח הוצאות</h1>
          <MonthSelector />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Attribution filter — couple/family only */}
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
                onClick={() => setAttributionFilter(opt.key)}
                className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
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

      {/* Payment filter */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <span className="text-xs font-semibold text-gray-400 flex-shrink-0 pr-1">לפי תשלום:</span>
        <button
          onClick={() => setPaymentFilter('all')}
          className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
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
                className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
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
                className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                style={paymentFilter === pm.id
                  ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {pm.name}
              </button>
            ))
        }
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען נתונים...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 font-medium">אין הוצאות לתקופה זו</p>
          {(paymentFilter !== 'all' || attributionFilter !== 'all') && (
            <p className="text-sm text-gray-400 mt-1">נסה לשנות את הסינון</p>
          )}
        </div>
      ) : (
        <>
          {/* Summary + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* Total KPI + compact mini category bars */}
            <div className="bg-white rounded-2xl p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold text-gray-500 mb-0.5">סה״כ הוצאות החודש</p>
              <p className="text-3xl font-extrabold text-gray-900 mb-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalExpenses)}
              </p>
              <p className="text-sm text-gray-400 mb-2">{filtered.length} תנועות</p>

              <div className="border-t border-gray-100 mt-2 mb-3" />

              {/* Compact category bars — top 5, rest → אחר */}
              {categoryList.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">אין נתונים לחודש זה</p>
              ) : (
              <div className="space-y-2.5">
                {(() => {
                  const top5 = categoryList.slice(0, 5);
                  const rest = categoryList.slice(5);
                  const otherAmt = rest.reduce((s, c) => s + c.amount, 0);
                  const display: typeof categoryList = otherAmt > 0
                    ? [...top5, { id: '__other__', name: 'אחר', icon: '📦', color: '#A8A29E', amount: otherAmt }]
                    : top5;
                  const maxAmt = display[0]?.amount ?? 1;
                  return display.map(cat => {
                    const pct = totalExpenses > 0 ? Math.round((cat.amount / totalExpenses) * 100) : 0;
                    const barW = maxAmt > 0 ? (cat.amount / maxAmt) * 100 : 0;
                    const isSelected = selectedCat === cat.id;
                    const isOther = cat.id === '__other__';
                    const dimmed = !!selectedCat && !isSelected;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => !isOther && setSelectedCat(isSelected ? null : cat.id)}
                        className="w-full text-right block"
                        style={{ cursor: isOther ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
                              style={{ backgroundColor: cat.color, opacity: dimmed ? 0.3 : 1 }} />
                            <span className="text-xs text-gray-700 truncate transition-opacity"
                              style={{ opacity: dimmed ? 0.45 : 1 }}>
                              {cat.name}
                            </span>
                          </div>
                          <span className="text-xs font-semibold flex-shrink-0 transition-opacity"
                            style={{ color: cat.color, opacity: dimmed ? 0.35 : 1, fontVariantNumeric: 'tabular-nums' }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${barW}%`, backgroundColor: cat.color, opacity: dimmed ? 0.25 : 1 }} />
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
              )}
            </div>

            {/* Donut chart */}
            <div className="bg-white rounded-2xl p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
              <p className="text-sm font-semibold text-gray-700 mb-3">חלוקה לפי קטגוריה</p>
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={categoryList}
                        cx={65}
                        cy={65}
                        innerRadius={42}
                        outerRadius={62}
                        dataKey="amount"
                        nameKey="name"
                        strokeWidth={2}
                        stroke="#fff"
                        onClick={(entry) => setSelectedCat(selectedCat === entry.id ? null : entry.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {categoryList.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            opacity={selectedCat && selectedCat !== entry.id ? 0.35 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={(props) => <DonutTooltip {...props} total={totalExpenses} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-gray-400">סה״כ</span>
                    <span className="text-sm font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(totalExpenses)}
                    </span>
                  </div>
                </div>
                {/* Legend — top 5 */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  {categoryList.slice(0, 5).map(cat => {
                    const pct = Math.round((cat.amount / totalExpenses) * 100);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                        className="w-full flex items-center justify-between text-xs rounded-lg px-2 py-1 transition-colors"
                        style={{
                          backgroundColor: selectedCat === cat.id ? cat.color + '18' : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-gray-600 truncate">{cat.name}</span>
                        </div>
                        <span className="font-semibold text-gray-700 mr-2 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(cat.amount)}<span className="text-gray-400 text-[10px] mr-1">· {pct}%</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Attribution breakdown — couple/family only */}
          {(isCouple || isFamily) && paymentFilteredTotal > 0 && (
            <div className="bg-white rounded-2xl p-6 mb-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
              <p className="font-bold text-gray-900 mb-4">חלוקה לפי שיוך</p>
              <div className="space-y-2.5">
                {members.map(m => {
                  const amt = attrTotals[m.id] ?? 0;
                  const pct = paymentFilteredTotal > 0 ? Math.round((amt / paymentFilteredTotal) * 100) : 0;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: m.avatarColor }}>
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                          <span className="text-sm font-bold text-gray-900 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(amt)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: m.avatarColor }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-center">{pct}%</span>
                    </div>
                  );
                })}
                {/* Shared row */}
                {(attrTotals['__shared__'] ?? 0) > 0 && (() => {
                  const amt = attrTotals['__shared__'];
                  const pct = Math.round((amt / paymentFilteredTotal) * 100);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>
                        מ
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800">משותף</span>
                          <span className="text-sm font-bold text-gray-900 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(amt)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: '#9CA3AF' }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-center">{pct}%</span>
                    </div>
                  );
                })()}
                {/* Unattributed row */}
                {(attrTotals['__unattributed__'] ?? 0) > 0 && (() => {
                  const amt = attrTotals['__unattributed__'];
                  const pct = Math.round((amt / paymentFilteredTotal) * 100);
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
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#D1D5DB' }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-center">{pct}%</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Full category ranking */}
          <div className="bg-white rounded-2xl p-6 mb-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">קטגוריות לפי סכום</h3>
              {selectedCat && (
                <button
                  onClick={() => setSelectedCat(null)}
                  className="text-sm font-semibold px-4 py-1.5 rounded-full border border-[#1E56A0]/20"
                  style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
                >
                  נקה סינון ✕
                </button>
              )}
            </div>
            <div className="space-y-2">
              {categoryList.map((cat, i) => {
                const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
                const isSelected = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCat(isSelected ? null : cat.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-right"
                    style={isSelected
                      ? { borderColor: cat.color, backgroundColor: cat.color + '0D' }
                      : { borderColor: 'transparent', backgroundColor: '#f9fafb' }}
                  >
                    <span className="text-gray-400 text-xs font-bold w-5 text-center flex-shrink-0">{i + 1}</span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: cat.color + '18' }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                        <span className="text-sm font-bold text-gray-900 mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
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

          {/* Drill-down: selected category detail */}
          {selectedCat && selectedMeta && (
            <div className="bg-white rounded-2xl p-6 mb-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: selectedMeta.chartColor + '18' }}>
                    {selectedMeta.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedMeta.name}</h3>
                    <p className="text-sm text-gray-400">
                      {formatCurrency(categoryTotals[selectedCat] ?? 0)} • {catMovements.length} תנועות
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCat(null)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm flex-shrink-0"
                  title="סגור"
                >
                  ✕
                </button>
              </div>

              {/* Subcategory breakdown */}
              {SUBCATEGORIES[selectedCat] && subList.length > 1 && (
                <div className="mb-5">
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

              {/* Transaction list for selected category */}
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">תנועות</p>
              <div className="space-y-2">
                {catMovements.map(m => {
                  const pm = resolvePaymentDisplay(m.payment_source_id, m.payment_method, paymentSources);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
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
                      <span className="text-sm font-bold text-gray-900 flex-shrink-0"
                        style={{ fontVariantNumeric: 'tabular-nums' }}>
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
    </div>
  );
};

export default ExpenseAnalysisPage;
