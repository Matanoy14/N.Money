import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { getCategoryMeta } from '../lib/categories';
import VariableExpensesTab from '../components/expenses/VariableExpensesTab';
import FixedExpensesTab from '../components/expenses/FixedExpensesTab';
import { intervalToMonthly } from '../components/expenses/FixedExpensesTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'variable' | 'fixed';

interface OverviewMovement {
  category: string;
  amount: number;
}

interface OverviewRecurring {
  amount: number;
  interval_unit: string | null;
  interval_value: number | null;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'bimonthly';
}

interface OverviewConfirmation {
  recurring_id: string;
  status: 'confirmed' | 'skipped';
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'סקירה'    },
  { key: 'variable', label: 'משתנות'   },
  { key: 'fixed',    label: 'קבועות'   },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ExpensesPage: React.FC = () => {
  const { user }        = useAuth();
  const { accountId }   = useAccount();
  const { currentMonth } = useMonth();
  const navigate         = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state ────────────────────────────────────────────────────────────
  const rawTab = searchParams.get('tab') as Tab | null;
  const validTab = rawTab && ['overview', 'variable', 'fixed'].includes(rawTab) ? rawTab : 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(validTab);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    // preserve add=true if present
    setSearchParams(params, { replace: false });
  };

  // ── Overview data state ───────────────────────────────────────────────────
  const [varMovements,   setVarMovements]   = useState<OverviewMovement[]>([]);
  const [recurringExps,  setRecurringExps]  = useState<OverviewRecurring[]>([]);
  const [confirmations,  setConfirmations]  = useState<OverviewConfirmation[]>([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const fetchOverview = useCallback(async () => {
    if (!user || !accountId) return;
    setOverviewLoading(true);

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // Previous month range for trend
    const prevStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
      .toISOString().split('T')[0];
    const prevEnd   = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0)
      .toISOString().split('T')[0];

    const [varRes, recurringRes, confRes, prevRes] = await Promise.all([
      supabase
        .from('financial_movements')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('recurring_expenses')
        .select('amount, interval_unit, interval_value, frequency')
        .eq('account_id', accountId)
        .eq('is_active', true),
      supabase
        .from('recurring_confirmations')
        .select('recurring_id, status')
        .eq('account_id', accountId)
        .eq('month', monthStr),
      supabase
        .from('financial_movements')
        .select('amount')
        .eq('type', 'expense')
        .gte('date', prevStart)
        .lte('date', prevEnd),
    ]);

    setVarMovements((varRes.data ?? []) as OverviewMovement[]);
    setRecurringExps((recurringRes.data ?? []) as OverviewRecurring[]);
    setConfirmations((confRes.data ?? []) as OverviewConfirmation[]);
    const prev = (prevRes.data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
    setPrevMonthTotal(prev > 0 ? prev : null);
    setOverviewLoading(false);
  }, [user?.id, accountId, currentMonth]);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
  }, [activeTab, fetchOverview]);

  // ── Overview computed ─────────────────────────────────────────────────────
  const varTotal   = varMovements.reduce((s, m) => s + m.amount, 0);
  const fixedTotal = recurringExps.reduce(
    (s, e) => s + intervalToMonthly(e.amount, e.interval_unit, e.interval_value, e.frequency), 0
  );
  const confirmedFixed = confirmations.filter(c => c.status === 'confirmed').length;
  const totalFixed     = recurringExps.length;

  // Top categories from variable movements
  const catMap: Record<string, number> = {};
  varMovements.forEach(m => { catMap[m.category] = (catMap[m.category] ?? 0) + m.amount; });
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => {
      const meta = getCategoryMeta(id);
      return { id, name: meta.name, icon: meta.icon, color: meta.color, amount };
    });

  // Trend vs previous month
  const trendPct = prevMonthTotal && prevMonthTotal > 0 && varTotal > 0
    ? Math.round(((varTotal - prevMonthTotal) / prevMonthTotal) * 100)
    : null;

  // ── Style helpers ─────────────────────────────────────────────────────────
  const cardShadow = { boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header — shared across all tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">הוצאות</h1>
          <MonthSelector />
        </div>
      </div>

      {/* Tab navigation — segmented control */}
      <div className="flex gap-0 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className="px-6 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200 select-none"
            style={activeTab === tab.key
              ? { backgroundColor: '#1E56A0', color: '#fff', boxShadow: '0 1px 4px rgba(30,86,160,0.3)' }
              : { color: '#6b7280', backgroundColor: 'transparent' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          {overviewLoading ? (
            <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
              <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">טוען סקירה...</p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Summary strip */}
              <div className="bg-white rounded-2xl p-5" style={cardShadow}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Total */}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">סה״כ הוצאות החודש</p>
                    <p className="text-3xl font-extrabold" style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
                      −{formatCurrency(varTotal + fixedTotal)}
                    </p>
                    {trendPct !== null && (
                      <p className="text-xs mt-1 font-semibold"
                        style={{ color: trendPct > 0 ? '#E53E3E' : '#00A86B' }}>
                        {trendPct > 0 ? '↑' : '↓'} {Math.abs(trendPct)}% מהחודש הקודם (משתנות)
                      </p>
                    )}
                  </div>

                  {/* Variable / Fixed split */}
                  <div className="flex gap-5 sm:gap-6 flex-shrink-0">
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-gray-400 font-medium mb-0.5">משתנות</p>
                      <p className="text-lg font-extrabold" style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
                        −{formatCurrency(varTotal)}
                      </p>
                    </div>
                    <div className="w-px bg-gray-100 hidden sm:block" />
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-gray-400 font-medium mb-0.5">קבועות / חודש</p>
                      <p className="text-lg font-extrabold text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        −{formatCurrency(fixedTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top categories + analysis CTA */}
              <div className="bg-white rounded-2xl p-5" style={cardShadow}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">קטגוריות מובילות</h3>
                  <Link to="/expenses-analysis"
                    className="text-xs font-semibold hover:underline"
                    style={{ color: '#1E56A0' }}>
                    ניתוח מפורט ←
                  </Link>
                </div>

                {topCategories.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">אין הוצאות החודש</p>
                ) : (
                  <div className="space-y-3">
                    {topCategories.map(cat => {
                      const pct = varTotal > 0 ? Math.round((cat.amount / varTotal) * 100) : 0;
                      return (
                        <div key={cat.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{cat.icon}</span>
                              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{pct}%</span>
                              <span className="text-sm font-bold" style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
                                −{formatCurrency(cat.amount)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: cat.color, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Fixed obligations status */}
              {totalFixed > 0 && (
                <div className="bg-white rounded-2xl p-5" style={cardShadow}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">הוצאות קבועות</h3>
                    <button onClick={() => switchTab('fixed')}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: '#1E56A0' }}>
                      נהל ←
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">
                        אושרו החודש:{' '}
                        <span className="font-bold" style={{ color: confirmedFixed === totalFixed ? '#00A86B' : '#F59E0B' }}>
                          {confirmedFixed}/{totalFixed}
                        </span>
                      </p>
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: totalFixed > 0 ? `${Math.round((confirmedFixed / totalFixed) * 100)}%` : '0%',
                            backgroundColor: confirmedFixed === totalFixed ? '#00A86B' : '#1E56A0',
                          }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">חודשי</p>
                      <p className="text-base font-bold text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(fixedTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add expense CTA */}
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.set('tab', 'variable');
                  params.set('add', 'true');
                  setSearchParams(params);
                  setActiveTab('variable');
                }}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                + הוסף הוצאה
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── VARIABLE TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'variable' && <VariableExpensesTab />}

      {/* ── FIXED TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'fixed' && <FixedExpensesTab />}
    </div>
  );
};

export default ExpensesPage;
