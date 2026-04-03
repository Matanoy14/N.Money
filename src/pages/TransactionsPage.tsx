import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, SUBCATEGORIES } from '../lib/categories';
import { PAYMENT_METHODS, getPaymentMethod, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';
import { useSearchParams } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type MovementType = 'income' | 'expense' | 'transfer';

interface FinancialMovement {
  id: string;
  date: string;
  description: string;
  type: MovementType;
  category: string;
  sub_category: string | null;
  payment_method: string;
  payment_source_id: string | null;
  amount: number;  // always positive
  notes: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
}

// ─── Static lookup tables ─────────────────────────────────────────────────────

// Virtual categories for display of income/transfer rows (not shown in picker)
const categoryMeta: Record<string, { name: string; icon: string; color: string }> = {
  income:   { name: 'הכנסה', icon: '💰', color: '#00A86B' },
  transfer: { name: 'העברה', icon: '↔️', color: '#6B7280' },
  ...Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.id, c])),
};

const getCategoryInfo = (id: string) =>
  (categoryMeta as Record<string, { name: string; icon: string; color: string }>)[id]
  ?? { name: id, icon: '📦', color: '#6B7280' };

// ─── Attribution chip ──────────────────────────────────────────────────────────

interface MemberLike { id: string; name: string; avatarColor: string; }

const AttrChip = ({ attrType, memberId, members }: {
  attrType: string | null;
  memberId: string | null;
  members: MemberLike[];
}) => {
  if (!attrType) return null;
  if (attrType === 'shared') {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
        style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>
        משותף
      </span>
    );
  }
  if (attrType === 'member' && memberId) {
    const m = members.find(x => x.id === memberId);
    if (!m) return null;
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block"
        style={{ backgroundColor: m.avatarColor + '20', color: m.avatarColor }}>
        {m.name}
      </span>
    );
  }
  return null;
};

type FilterType = 'all' | 'expense' | 'income' | 'transfer';
type TxType     = 'expense' | 'income' | 'transfer';

// ─── Component ────────────────────────────────────────────────────────────────

const TransactionsPage: React.FC = () => {
  const { user }                                   = useAuth();
  const { accountId, paymentSources, isCouple, isFamily, members } = useAccount();
  const { currentMonth } = useMonth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Data state ───────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<FinancialMovement[]>([]);
  const [editingMovement, setEditingMovement] = useState<FinancialMovement | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeFilter,   setActiveFilter]   = useState<FilterType>('all');
  const [searchQuery,    setSearchQuery]     = useState('');
  const [showAddPanel,   setShowAddPanel]    = useState(false);
  const [showVoiceModal, setShowVoiceModal]  = useState(false);
  const [hoveredRow,     setHoveredRow]      = useState<string | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────
  const [txType,           setTxType]           = useState<TxType>('expense');
  const [txDescription,    setTxDescription]    = useState('');
  const [txAmount,         setTxAmount]         = useState('');
  const [txDate,           setTxDate]           = useState(new Date().toISOString().split('T')[0]);
  const [txCategory,       setTxCategory]       = useState('');
  const [txSubCategory,    setTxSubCategory]    = useState('');
  const [txPayment,        setTxPayment]        = useState('credit');
  const [txSourceId,       setTxSourceId]       = useState<string | null>(null);
  const [txNotes,          setTxNotes]          = useState('');
  const [txAttrType,       setTxAttrType]       = useState<'shared' | 'member'>('shared');
  const [txAttrMemberId,   setTxAttrMemberId]   = useState<string | null>(null);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [isRecording,    setIsRecording]    = useState(false);
  const [transcription,  setTranscription]  = useState('');
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch movements for current month ────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const { data, error: fetchError } = await supabase
      .from('financial_movements')
      .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (fetchError) {
      setError('שגיאה בטעינת התנועות. נסה שוב.');
    } else {
      setTransactions((data ?? []) as FinancialMovement[]);
    }
    setIsLoading(false);
  }, [user?.id, currentMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Handle ?add=true URL param (from FAB / deep link) ────────────────────
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      resetForm();
      setShowAddPanel(true);
      setSearchParams({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset form ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingMovement(null);
    setTxType('expense');
    setTxDescription('');
    setTxAmount('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxCategory('');
    setTxSubCategory('');
    setTxPayment('credit');
    setTxSourceId(null);
    setTxNotes('');
    setTxAttrType('shared');
    setTxAttrMemberId(null);
  };

  // ── Save (insert or update) movement ─────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(txAmount);
    if (!txDescription.trim() || isNaN(rawAmount) || rawAmount <= 0) return;

    const category = txType === 'income'   ? 'income'
                   : txType === 'transfer' ? 'transfer'
                   : txCategory || 'other';

    setIsSaving(true);

    if (editingMovement) {
      // Update existing
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update({
          date:           txDate,
          description:    txDescription.trim(),
          type:           txType,
          category,
          sub_category:           txType === 'expense' ? (txSubCategory || null) : null,
          payment_method:         txPayment,
          payment_source_id:      txSourceId,
          amount:                 Math.abs(rawAmount),
          notes:                  txNotes.trim() || null,
          attributed_to_type:     txType === 'expense' ? txAttrType : null,
          attributed_to_member_id: txType === 'expense' && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .eq('id', editingMovement.id)
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);

      if (updateError) {
        setError('שגיאה בעדכון התנועה. נסה שוב.');
        return;
      }

      setTransactions(prev => prev.map(m => m.id === editingMovement.id ? (data as FinancialMovement) : m));
      setEditingMovement(null);
      setShowAddPanel(false);
      resetForm();
    } else {
      // Insert new
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({
          user_id:        user.id,
          account_id:     accountId,
          date:           txDate,
          description:    txDescription.trim(),
          type:           txType,
          category,
          sub_category:           txType === 'expense' ? (txSubCategory || null) : null,
          payment_method:         txPayment,
          payment_source_id:      txSourceId,
          amount:                 Math.abs(rawAmount),
          status:                 'actual',
          source:                 'manual',
          notes:                  txNotes.trim() || null,
          attributed_to_type:     txType === 'expense' ? txAttrType : null,
          attributed_to_member_id: txType === 'expense' && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);

      if (insertError) {
        setError('שגיאה בשמירת התנועה. נסה שוב.');
        return;
      }

      setTransactions(prev => [data as FinancialMovement, ...prev]);
      setShowAddPanel(false);
      resetForm();
    }
  };

  // ── Delete movement ──────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: deleteError } = await supabase
      .from('financial_movements')
      .delete()
      .eq('id', id);

    setDeletingId(null);
    if (deleteError) {
      setError('שגיאה במחיקת התנועה. נסה שוב.');
      return;
    }
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  // ── Open edit panel ──────────────────────────────────────────────────────
  const handleEdit = (movement: FinancialMovement) => {
    setEditingMovement(movement);
    setTxType(movement.type);
    setTxDescription(movement.description);
    setTxAmount(String(movement.amount));
    setTxDate(movement.date);
    setTxCategory(movement.category);
    setTxSubCategory(movement.sub_category ?? '');
    setTxPayment(movement.payment_method);
    setTxSourceId(movement.payment_source_id);
    setTxNotes(movement.notes ?? '');
    setTxAttrType((movement.attributed_to_type as 'shared' | 'member') || 'shared');
    setTxAttrMemberId(movement.attributed_to_member_id);
    setShowAddPanel(true);
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const filteredTransactions = transactions.filter(tx => {
    const matchesFilter = activeFilter === 'all' || tx.type === activeFilter;
    const catInfo = getCategoryInfo(tx.category);
    const matchesSearch =
      !searchQuery ||
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      catInfo.name.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // transfer excluded from KPI totals
  const totalExpenses = transactions.filter(tx => tx.type === 'expense')
    .reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = transactions.filter(tx => tx.type === 'income')
    .reduce((s, tx) => s + tx.amount, 0);
  const balance = totalIncome - totalExpenses;


  // ── Voice handler ─────────────────────────────────────────────────────────
  const handleVoiceClick = () => {
    if (isRecording) {
      setIsRecording(false);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      return;
    }
    setIsRecording(true);
    setTranscription('');
    recordingTimer.current = setTimeout(() => {
      setIsRecording(false);
      setTranscription('פיצ׳ר בפיתוח — קלט קולי יהיה זמין בקרוב');
    }, 2500);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">עסקאות</h1>
          <MonthSelector />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVoiceModal(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
            title="הוסף בקול"
          >
            🎤
          </button>
          <button
            onClick={() => { resetForm(); setShowAddPanel(true); }}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
          >
            <span className="font-bold text-base">+</span> הוסף תנועה
          </button>
        </div>
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

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              ['all',      'כל הסוגים'],
              ['expense',  'הוצאות'],
              ['income',   'הכנסות'],
              ['transfer', 'העברות'],
            ] as [FilterType, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActiveFilter(val)}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200"
              style={
                activeFilter === val
                  ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חפש עסקאות..."
            className="w-full pr-9 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1E56A0] transition"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div
        className="flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-xl mb-5 text-sm font-semibold"
        style={{ backgroundColor: '#E8F0FB' }}
      >
        <span>
          סה״כ הוצאות:{' '}
          <span style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalExpenses)}
          </span>
        </span>
        <span className="text-gray-300">|</span>
        <span>
          הכנסות:{' '}
          <span style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalIncome)}
          </span>
        </span>
        <span className="text-gray-300">|</span>
        <span>
          מאזן:{' '}
          <span
            style={{
              color: balance >= 0 ? '#00A86B' : '#E53E3E',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {balance >= 0 ? '+' : ''}
            {formatCurrency(balance)}
          </span>
        </span>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div
          className="bg-white rounded-2xl p-16 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען עסקאות...</p>
        </div>

      /* Transactions table / empty state */
      ) : filteredTransactions.length === 0 ? (
        <div
          className="bg-white rounded-2xl p-16 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <div className="w-20 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex flex-col justify-center gap-1.5 items-center px-3">
            <div className="h-2 w-full bg-gray-200 rounded-full" />
            <div className="h-2 w-4/5 bg-gray-200 rounded-full" />
            <div className="h-2 w-3/5 bg-gray-200 rounded-full" />
          </div>
          <p className="text-gray-500 font-medium mb-4">אין עסקאות לתקופה זו</p>
          <button
            onClick={() => { resetForm(); setShowAddPanel(true); }}
            className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
            style={{ backgroundColor: '#1E56A0' }}
          >
            הוסף תנועה ראשונה
          </button>
        </div>
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
                  {['תאריך', 'תיאור', 'קטגוריה', 'אמצעי תשלום', 'סכום', ''].map(h => (
                    <th
                      key={h}
                      className="text-right text-xs font-semibold text-gray-500 px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, i) => {
                  const pm      = resolvePaymentDisplay(tx.payment_source_id, tx.payment_method, paymentSources);
                  const catInfo = getCategoryInfo(tx.category);
                  const isDeleting = deletingId === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-50 transition-colors"
                      style={{
                        backgroundColor:
                          isDeleting   ? '#fff5f5'
                          : hoveredRow === tx.id ? '#f0f6ff'
                          : i % 2 === 0 ? '#fff'
                          : '#f9fafb',
                        opacity: isDeleting ? 0.5 : 1,
                      }}
                      onMouseEnter={() => setHoveredRow(tx.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-5 py-3.5 text-sm text-gray-500 text-right whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                            {catInfo.icon}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-900">
                              {tx.description}
                            </span>
                            {(isCouple || isFamily) && tx.type === 'expense' && tx.attributed_to_type && (
                              <div className="mt-0.5">
                                <AttrChip attrType={tx.attributed_to_type} memberId={tx.attributed_to_member_id} members={members} />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-sm text-gray-700">{catInfo.name}</p>
                        {tx.sub_category && (
                          <p className="text-xs text-gray-400">{tx.sub_category}</p>
                        )}
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
                          style={{
                            color: tx.type === 'income' ? '#00A86B' : tx.type === 'transfer' ? '#6B7280' : '#E53E3E',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '−'}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div
                          className={`flex items-center gap-1 transition-opacity duration-150 ${
                            hoveredRow === tx.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <button
                            onClick={() => handleEdit(tx)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={isDeleting}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map(tx => {
              const pm      = resolvePaymentDisplay(tx.payment_source_id, tx.payment_method, paymentSources);
              const catInfo = getCategoryInfo(tx.category);
              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3"
                  style={{
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    opacity: deletingId === tx.id ? 0.5 : 1,
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: pm.color + '15', color: pm.color }}
                      >
                        {pm.name}
                      </span>
                      {(isCouple || isFamily) && tx.type === 'expense' && tx.attributed_to_type && (
                        <AttrChip attrType={tx.attributed_to_type} memberId={tx.attributed_to_member_id} members={members} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: tx.type === 'income' ? '#00A86B' : tx.type === 'transfer' ? '#6B7280' : '#E53E3E',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '−'}
                      {formatCurrency(tx.amount)}
                    </span>
                    <button
                      onClick={() => handleEdit(tx)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Add Transaction Panel ─────────────────────────────────────────── */}
      {showAddPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowAddPanel(false); resetForm(); }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[420px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}
          >
            <div className="p-6">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingMovement ? 'עריכת תנועה' : 'הוספת תנועה'}
                </h2>
                <button
                  onClick={() => { setShowAddPanel(false); resetForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                >
                  ✕
                </button>
              </div>

              {/* Type tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
                {(
                  [
                    ['expense',  'הוצאה'],
                    ['income',   'הכנסה'],
                    ['transfer', 'העברה'],
                  ] as [TxType, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setTxType(val)}
                    className="flex-1 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200"
                    style={
                      txType === val
                        ? { backgroundColor: '#1E56A0', color: '#fff' }
                        : { color: '#6b7280' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {/* Description with autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input
                    value={txDescription}
                    onChange={e => setTxDescription(e.target.value)}
                    placeholder="למשל: קניות בסופר"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">
                      ₪
                    </span>
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

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                {/* Category grid (only for expense — income/transfer derive category from type) */}
                {txType === 'expense' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                    <div className="grid grid-cols-4 gap-2">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setTxCategory(cat.id);
                            setTxSubCategory('');
                          }}
                          className="flex flex-col items-center gap-1 p-2.5 border-2 rounded-xl transition-all"
                          style={
                            txCategory === cat.id
                              ? { borderColor: cat.color, backgroundColor: cat.color + '12' }
                              : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                          }
                        >
                          <span className="text-xl">{cat.icon}</span>
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: txCategory === cat.id ? cat.color : '#6b7280' }}
                          >
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subcategory chips — shown only for expense with a selected category */}
                {txType === 'expense' && txCategory && SUBCATEGORIES[txCategory] && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">פירוט (אופציונלי)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBCATEGORIES[txCategory].map(sub => (
                        <button
                          key={sub}
                          onClick={() => setTxSubCategory(txSubCategory === sub ? '' : sub)}
                          className="px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                          style={
                            txSubCategory === sub
                              ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                              : { borderColor: '#e5e7eb', color: '#6b7280', backgroundColor: '#fff' }
                          }
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attribution — couple/family accounts, expense only */}
                {(isCouple || isFamily) && txType === 'expense' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך הוצאה</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setTxAttrType('shared'); setTxAttrMemberId(null); }}
                        className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txAttrType === 'shared'
                          ? { borderColor: '#6B7280', backgroundColor: '#6B728015', color: '#374151' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        משותף
                      </button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setTxAttrType('member'); setTxAttrMemberId(m.id); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txAttrType === 'member' && txAttrMemberId === m.id
                            ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '15', color: m.avatarColor }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment method / source chips */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">אמצעי תשלום</label>
                  <div className="flex flex-wrap gap-2">
                    {paymentSources.length > 0 ? (
                      paymentSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setTxSourceId(src.id); setTxPayment(SOURCE_TYPE_TO_PM[src.type] || 'credit'); }}
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

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות</label>
                  <textarea
                    value={txNotes}
                    onChange={e => setTxNotes(e.target.value)}
                    rows={2}
                    placeholder="הוסף הערה (אופציונלי)..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !txDescription.trim() || !txAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#1E56A0',
                    boxShadow: '0 2px 8px rgba(30,86,160,0.25)',
                  }}
                >
                  {isSaving ? 'שומר...' : editingMovement ? 'עדכן תנועה' : 'שמור תנועה'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Voice Recording Modal ─────────────────────────────────────────── */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">הוספה קולית</h2>
              <button
                onClick={() => {
                  setShowVoiceModal(false);
                  setIsRecording(false);
                  setTranscription('');
                  if (recordingTimer.current) clearTimeout(recordingTimer.current);
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                ✕
              </button>
            </div>

            <button
              onClick={handleVoiceClick}
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 transition-all duration-200"
              style={
                isRecording
                  ? {
                      backgroundColor: '#E53E3E',
                      animation: 'pulse 1s infinite',
                      boxShadow: '0 0 0 8px rgba(229,62,62,0.2)',
                    }
                  : { backgroundColor: '#E8F0FB' }
              }
            >
              🎤
            </button>

            <p className="text-sm font-semibold text-gray-700 mb-2">
              {isRecording ? 'מקליט...' : 'לחץ והתחל לדבר'}
            </p>

            {!isRecording && !transcription && (
              <p className="text-xs text-gray-400 mb-4">
                למשל: ״שילמתי 50 שקל על קפה מזומן״
              </p>
            )}

            {(isRecording || transcription) && (
              <div className="bg-gray-50 rounded-xl p-4 min-h-[60px] flex items-center justify-center mt-3">
                <p className="text-sm text-gray-700 text-center">
                  {transcription || (isRecording ? '...' : '')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
