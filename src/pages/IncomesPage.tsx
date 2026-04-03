import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, getPaymentMethod, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomeMovement {
  id: string;
  date: string;
  description: string;
  payment_method: string;
  payment_source_id: string | null;
  amount: number;
  notes: string | null;
}


// ─── Component ────────────────────────────────────────────────────────────────

const IncomesPage: React.FC = () => {
  const { user }                        = useAuth();
  const { accountId, paymentSources }   = useAccount();
  const { currentMonth } = useMonth();

  // ── Data state ──────────────────────────────────────────────────────────
  const [incomes, setIncomes]     = useState<IncomeMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [showPanel, setShowPanel]       = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeMovement | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount]           = useState('');
  const [txDate, setTxDate]               = useState(new Date().toISOString().split('T')[0]);
  const [txPayment,   setTxPayment]   = useState('transfer');
  const [txSourceId,  setTxSourceId]  = useState<string | null>(null);
  const [txNotes,     setTxNotes]     = useState('');

  // ── Fetch income movements ──────────────────────────────────────────────
  const fetchIncomes = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const { data, error: fetchError } = await supabase
      .from('financial_movements')
      .select('id, date, description, payment_method, payment_source_id, amount, notes')
      .eq('type', 'income')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (fetchError) {
      setError('שגיאה בטעינת הכנסות. נסה שוב.');
    } else {
      setIncomes((data ?? []) as IncomeMovement[]);
    }
    setIsLoading(false);
  }, [user?.id, currentMonth]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  // ── Reset form ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingIncome(null);
    setTxDescription('');
    setTxAmount('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxPayment('transfer');
    setTxSourceId(null);
    setTxNotes('');
  };

  // ── Open edit panel ─────────────────────────────────────────────────────
  const handleEdit = (income: IncomeMovement) => {
    setEditingIncome(income);
    setTxDescription(income.description);
    setTxAmount(String(income.amount));
    setTxDate(income.date);
    setTxPayment(income.payment_method);
    setTxSourceId(income.payment_source_id);
    setTxNotes(income.notes ?? '');
    setShowPanel(true);
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(txAmount);
    if (!txDescription.trim() || isNaN(rawAmount) || rawAmount <= 0) return;

    setIsSaving(true);

    if (editingIncome) {
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update({
          date:              txDate,
          description:       txDescription.trim(),
          payment_method:    txPayment,
          payment_source_id: txSourceId,
          amount:            Math.abs(rawAmount),
          notes:             txNotes.trim() || null,
        })
        .eq('id', editingIncome.id)
        .select('id, date, description, payment_method, payment_source_id, amount, notes')
        .single();

      setIsSaving(false);

      if (updateError) {
        setError('שגיאה בעדכון ההכנסה. נסה שוב.');
        return;
      }

      setIncomes(prev => prev.map(m => m.id === editingIncome.id ? (data as IncomeMovement) : m));
    } else {
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({
          user_id:        user.id,
          account_id:     accountId,
          date:           txDate,
          description:    txDescription.trim(),
          type:           'income',
          category:       'income',
          sub_category:      null,
          payment_method:    txPayment,
          payment_source_id: txSourceId,
          amount:            Math.abs(rawAmount),
          status:            'actual',
          source:            'manual',
          notes:             txNotes.trim() || null,
        })
        .select('id, date, description, payment_method, payment_source_id, amount, notes')
        .single();

      setIsSaving(false);

      if (insertError) {
        setError('שגיאה בשמירת ההכנסה. נסה שוב.');
        return;
      }

      setIncomes(prev => [data as IncomeMovement, ...prev]);
    }

    setShowPanel(false);
    resetForm();
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: deleteError } = await supabase
      .from('financial_movements')
      .delete()
      .eq('id', id);

    setDeletingId(null);
    if (deleteError) {
      setError('שגיאה במחיקת ההכנסה. נסה שוב.');
      return;
    }
    setIncomes(prev => prev.filter(m => m.id !== id));
  };

  // ── Computed ────────────────────────────────────────────────────────────
  const totalActual = incomes.reduce((s, m) => s + m.amount, 0);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">הכנסות</h1>
          <MonthSelector />
        </div>
        <button
          onClick={() => { resetForm(); setShowPanel(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף הכנסה
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
        >
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">סה״כ הכנסות החודש</p>
          <p className="text-2xl font-extrabold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalActual)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">מספר תנועות</p>
          <p className="text-2xl font-extrabold text-gray-900">{incomes.length}</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען הכנסות...</p>
        </div>

      /* Empty state */
      ) : incomes.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <p className="text-4xl mb-3">💰</p>
          <p className="text-gray-500 font-medium mb-4">אין הכנסות לחודש זה</p>
          <button
            onClick={() => { resetForm(); setShowPanel(true); }}
            className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
            style={{ backgroundColor: '#1E56A0' }}
          >
            הוסף הכנסה ראשונה
          </button>
        </div>

      /* Table */
      ) : (
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['תאריך', 'תיאור', 'אמצעי תשלום', 'סכום', ''].map(h => (
                    <th key={h} className="text-right text-xs font-semibold text-gray-500 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomes.map((income, i) => {
                  const pm = resolvePaymentDisplay(income.payment_source_id, income.payment_method, paymentSources);
                  const isDeleting = deletingId === income.id;
                  return (
                    <tr
                      key={income.id}
                      className="border-b border-gray-50 transition-colors"
                      style={{
                        backgroundColor:
                          isDeleting        ? '#fff5f5'
                          : hoveredRow === income.id ? '#f0f6ff'
                          : i % 2 === 0    ? '#fff'
                          : '#f9fafb',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                      onMouseEnter={() => setHoveredRow(income.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-5 py-3.5 text-sm text-gray-500 text-right whitespace-nowrap">
                        {formatDate(income.date)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-sm flex-shrink-0">
                            💰
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{income.description}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: pm.color + '15', color: pm.color }}
                        >
                          {pm.name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className="text-sm font-bold"
                          style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}
                        >
                          +{formatCurrency(income.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div
                          className={`flex items-center gap-1 transition-opacity duration-150 ${
                            hoveredRow === income.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <button
                            onClick={() => handleEdit(income)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                          >✏️</button>
                          <button
                            onClick={() => handleDelete(income.id)}
                            disabled={isDeleting}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-5 py-3.5 text-sm text-gray-900 text-right" colSpan={3}>סה״כ</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#00A86B' }}>
                    +{formatCurrency(totalActual)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {incomes.map(income => {
              const pm = resolvePaymentDisplay(income.payment_source_id, income.payment_method, paymentSources);
              return (
                <div
                  key={income.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: deletingId === income.id ? 0.5 : 1 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg flex-shrink-0">💰</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{income.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{formatDate(income.date)}</span>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: pm.color + '15', color: pm.color }}>{pm.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
                      +{formatCurrency(income.amount)}
                    </span>
                    <button
                      onClick={() => handleEdit(income)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(income.id)}
                      disabled={deletingId === income.id}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                    >🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Add / Edit Panel ──────────────────────────────────────────────── */}
      {showPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowPanel(false); resetForm(); }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingIncome ? 'עריכת הכנסה' : 'הוספת הכנסה'}
                </h2>
                <button
                  onClick={() => { setShowPanel(false); resetForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                >✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input
                    value={txDescription}
                    onChange={e => setTxDescription(e.target.value)}
                    placeholder="למשל: משכורת חודשית"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אמצעי קבלה</label>
                  <div className="flex flex-wrap gap-2">
                    {paymentSources.length > 0 ? (
                      paymentSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setTxSourceId(src.id); setTxPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txSourceId === src.id
                            ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >
                          {src.name}
                        </button>
                      ))
                    ) : (
                      PAYMENT_METHODS.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => { setTxPayment(pm.id); setTxSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txPayment === pm.id && !txSourceId
                            ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >
                          {pm.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות (אופציונלי)</label>
                  <textarea
                    value={txNotes}
                    onChange={e => setTxNotes(e.target.value)}
                    rows={2}
                    placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving || !txDescription.trim() || !txAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
                >
                  {isSaving ? 'שומר...' : editingIncome ? 'עדכן הכנסה' : 'שמור הכנסה'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IncomesPage;
