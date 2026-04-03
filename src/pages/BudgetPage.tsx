import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '../lib/categories';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetRow {
  id: string;
  category: string;
  amount: number;
}

interface SpendingMap {
  [category: string]: number;
}

// ─── Category metadata ────────────────────────────────────────────────────────
// Imported from shared lib — EXPENSE_CATEGORIES and getCategoryMeta

// ─── Helpers ──────────────────────────────────────────────────────────────────

const usageColor = (pct: number): string => {
  if (pct >= 100) return '#E53E3E';
  if (pct >= 75)  return '#F59E0B';
  return '#00A86B';
};

// ─── Component ────────────────────────────────────────────────────────────────

const BudgetPage: React.FC = () => {
  const { user }         = useAuth();
  const { accountId }    = useAccount();
  const { currentMonth } = useMonth();

  // ── Data state ──────────────────────────────────────────────────────────
  const [budgets, setBudgets]     = useState<BudgetRow[]>([]);
  const [spending, setSpending]   = useState<SpendingMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [showPanel, setShowPanel]         = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [formCategory, setFormCategory]   = useState(EXPENSE_CATEGORIES[0].id);
  const [formAmount, setFormAmount]       = useState('');

  // ── Month string (YYYY-MM-01) ───────────────────────────────────────────
  const monthStart = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const startDate = monthStart;
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const [budgetRes, movRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('id, category, amount')
        .eq('month', monthStart),
      supabase
        .from('financial_movements')
        .select('category, amount')
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);

    if (budgetRes.error) {
      setError('שגיאה בטעינת התקציב.');
    } else {
      setBudgets((budgetRes.data ?? []) as BudgetRow[]);
    }

    if (movRes.data) {
      const map: SpendingMap = {};
      for (const m of movRes.data) {
        map[m.category] = (map[m.category] ?? 0) + m.amount;
      }
      setSpending(map);
    }

    setIsLoading(false);
  }, [user, monthStart, currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Reset form ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingBudget(null);
    setFormCategory(EXPENSE_CATEGORIES[0].id);
    setFormAmount('');
  };

  const openAdd = () => {
    resetForm();
    setShowPanel(true);
  };

  const openEdit = (b: BudgetRow) => {
    setEditingBudget(b);
    setFormCategory(b.category);
    setFormAmount(String(b.amount));
    setShowPanel(true);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(formAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) return;

    setIsSaving(true);

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
      // Check for duplicate (same category + month)
      const existing = budgets.find(b => b.category === formCategory);
      if (existing) {
        setError(`כבר קיים תקציב לקטגוריה "${getCategoryMeta(formCategory).name}" החודש. ערוך אותו ישירות.`);
        setIsSaving(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('budgets')
        .insert({
          account_id: accountId,
          user_id:    user.id,
          category:   formCategory,
          month:      monthStart,
          amount:     rawAmount,
        })
        .select('id, category, amount')
        .single();

      setIsSaving(false);
      if (err) { setError('שגיאה בשמירת התקציב.'); return; }
      setBudgets(prev => [...prev, data as BudgetRow]);
    }

    setShowPanel(false);
    resetForm();
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: err } = await supabase.from('budgets').delete().eq('id', id);
    setDeletingId(null);
    if (err) { setError('שגיאה במחיקת התקציב.'); return; }
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  // ── Computed ────────────────────────────────────────────────────────────
  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (spending[b.category] ?? 0), 0);
  const totalBalance  = totalBudgeted - totalSpent;

  // Categories available to add (not yet budgeted this month)
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !budgets.find(b => b.category === c.id));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">תקציב</h1>
          <MonthSelector />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף תקציב
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && budgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'מתוקצב',  value: totalBudgeted, color: '#1E56A0' },
            { label: 'בפועל',   value: totalSpent,    color: '#E53E3E' },
            { label: totalBalance >= 0 ? 'יתרה' : 'חריגה',
              value: Math.abs(totalBalance),
              color: totalBalance >= 0 ? '#00A86B' : '#E53E3E' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
              <p className="text-2xl font-extrabold" style={{ color: card.color, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(card.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען תקציב...</p>
        </div>

      /* Empty */
      ) : budgets.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 font-medium mb-2">אין תקציב מוגדר לחודש זה</p>
          <p className="text-gray-400 text-sm mb-6">הגדר תקציב לקטגוריה ועקוב אחר ההוצאות שלך</p>
          <button onClick={openAdd}
            className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
            style={{ backgroundColor: '#1E56A0' }}>
            הגדר תקציב ראשון
          </button>
        </div>

      /* Budget list */
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
          {budgets.map((b, i) => {
            const meta    = getCategoryMeta(b.category);
            const actual  = spending[b.category] ?? 0;
            const pct     = b.amount > 0 ? Math.min(Math.round((actual / b.amount) * 100), 999) : 0;
            const color   = usageColor(pct);
            const isOver  = actual > b.amount;
            const isDel   = deletingId === b.id;

            return (
              <div
                key={b.id}
                className="px-5 py-4 border-b border-gray-50 last:border-0 transition-colors"
                style={{ backgroundColor: isDel ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb', opacity: isDel ? 0.5 : 1 }}
              >
                {/* Row header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                      {meta.icon}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{meta.name}</span>
                    {isOver && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#FEF2F2', color: '#E53E3E' }}>
                        חריגה
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-sm font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(actual)}
                      </span>
                      <span className="text-xs text-gray-400 mr-1">/ {formatCurrency(b.amount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(b)}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs">
                        ✏️
                      </button>
                      <button onClick={() => handleDelete(b.id)} disabled={isDel}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">{pct}% שומש</span>
                  {!isOver && (
                    <span className="text-xs text-gray-400">
                      נותר {formatCurrency(b.amount - actual)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className="px-5 py-4 bg-gray-50 border-t-2 border-gray-200 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">סה״כ</span>
            <div className="text-left">
              <span className="text-sm font-bold" style={{ color: usageColor(totalBudgeted > 0 ? Math.round(totalSpent/totalBudgeted*100) : 0), fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalSpent)}
              </span>
              <span className="text-xs text-gray-400 mr-1">/ {formatCurrency(totalBudgeted)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Panel ──────────────────────────────────────────────── */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowPanel(false); resetForm(); }} />
          <div className="fixed top-0 left-0 bottom-0 w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingBudget ? 'עריכת תקציב' : 'תקציב חדש'}
                </h2>
                <button onClick={() => { setShowPanel(false); resetForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                {/* Category picker — hidden when editing */}
                {!editingBudget && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                    {availableCategories.length === 0 ? (
                      <p className="text-sm text-gray-500">כל הקטגוריות כבר מתוקצבות החודש.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                        {availableCategories.map(cat => (
                          <button key={cat.id} onClick={() => setFormCategory(cat.id)}
                            className="flex flex-col items-center gap-1 p-2.5 border-2 rounded-xl transition-all"
                            style={formCategory === cat.id
                              ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB' }
                              : { borderColor: '#e5e7eb' }}>
                            <span className="text-xl">{cat.icon}</span>
                            <span className="text-[10px] font-medium text-center leading-tight"
                              style={{ color: formCategory === cat.id ? '#1E56A0' : '#6b7280' }}>
                              {cat.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {editingBudget && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{getCategoryMeta(editingBudget.category).icon}</span>
                    <span className="font-semibold text-gray-900">{getCategoryMeta(editingBudget.category).name}</span>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום תקציב חודשי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving || !formAmount || availableCategories.length === 0 && !editingBudget}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
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
