import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, SUBCATEGORIES } from '../lib/categories';
import { PAYMENT_METHODS, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';

// ─── Types ────────────────────────────────────────────────────────────────────

type MovementType = 'income' | 'expense' | 'transfer';
type FilterType   = 'all' | 'expense' | 'income' | 'transfer';
// Income is managed in IncomesPage — Transactions drawer only handles expense/transfer
type TxType       = 'expense' | 'transfer';

interface FinancialMovement {
  id: string;
  date: string;
  description: string;
  type: MovementType;
  category: string;
  sub_category: string | null;
  payment_method: string;
  payment_source_id: string | null;
  amount: number;
  notes: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
}

interface CategoryGroup {
  catId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  rows: FinancialMovement[];
}

interface SectionData {
  type: MovementType;
  label: string;
  accentColor: string;
  total: number;
  groups: CategoryGroup[];
}

// ─── Category lookup ──────────────────────────────────────────────────────────

const categoryMeta: Record<string, { name: string; icon: string; color: string }> = {
  income:   { name: 'הכנסה',  icon: '💰', color: '#00A86B' },
  transfer: { name: 'העברה',  icon: '↔️', color: '#6B7280' },
  ...Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.id, c])),
};

const getCategoryInfo = (id: string) =>
  (categoryMeta as Record<string, { name: string; icon: string; color: string }>)[id]
  ?? { name: id, icon: '📦', color: '#6B7280' };

// ─── Group builder ────────────────────────────────────────────────────────────

function buildGroupedSections(txs: FinancialMovement[], filter: FilterType): SectionData[] {
  const typeOrder: MovementType[] = ['income', 'transfer', 'expense'];
  const visible = filter === 'all' ? typeOrder : [filter as MovementType];

  return visible.flatMap(type => {
    const typeTxs = txs.filter(tx => tx.type === type);
    if (typeTxs.length === 0) return [];

    const groupMap = new Map<string, FinancialMovement[]>();
    typeTxs.forEach(tx => {
      const key = type === 'expense' ? (tx.category || 'other') : type;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(tx);
    });

    const groups: CategoryGroup[] = Array.from(groupMap.entries()).map(([catId, rows]) => {
      const info = getCategoryInfo(catId);
      return {
        catId,
        name: info.name,
        icon: info.icon,
        color: info.color,
        total: rows.reduce((s, r) => s + r.amount, 0),
        rows: [...rows].sort((a, b) => b.date.localeCompare(a.date)),
      };
    });

    if (type === 'expense') {
      groups.sort((a, b) => b.total - a.total);
    }

    return [{
      type,
      label: type === 'income' ? 'הכנסות' : type === 'transfer' ? 'העברות' : 'הוצאות',
      accentColor: type === 'income' ? '#00A86B' : type === 'transfer' ? '#6B7280' : '#E53E3E',
      total: typeTxs.reduce((s, tx) => s + tx.amount, 0),
      groups,
    }];
  });
}

// ─── Attribution chip ─────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

const TransactionsPage: React.FC = () => {
  const { user }                                                    = useAuth();
  const { accountId, paymentSources, isCouple, isFamily, members } = useAccount();
  const { currentMonth }                                            = useMonth();
  const [searchParams, setSearchParams]                             = useSearchParams();

  // ── Data state ───────────────────────────────────────────────────────────
  const [transactions,    setTransactions]    = useState<FinancialMovement[]>([]);
  const [editingMovement, setEditingMovement] = useState<FinancialMovement | null>(null);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeFilter,   setActiveFilter]   = useState<FilterType>('all');
  const [searchQuery,    setSearchQuery]     = useState('');
  const [showAddPanel,   setShowAddPanel]    = useState(false);
  const [showVoiceModal, setShowVoiceModal]  = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────
  const [txType,         setTxType]         = useState<TxType>('expense');
  const [txDescription,  setTxDescription]  = useState('');
  const [txAmount,       setTxAmount]       = useState('');
  const [txDate,         setTxDate]         = useState(new Date().toISOString().split('T')[0]);
  const [txCategory,     setTxCategory]     = useState('');
  const [txSubCategory,  setTxSubCategory]  = useState('');
  const [txPayment,      setTxPayment]      = useState('credit');
  const [txSourceId,     setTxSourceId]     = useState<string | null>(null);
  const [txNotes,        setTxNotes]        = useState('');
  const [txAttrType,     setTxAttrType]     = useState<'shared' | 'member'>('shared');
  const [txAttrMemberId, setTxAttrMemberId] = useState<string | null>(null);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [isRecording,   setIsRecording]   = useState(false);
  const [transcription, setTranscription] = useState('');
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
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

  // ── Handle ?add=true URL param ───────────────────────────────────────────
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

  // ── Save (insert or update) ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(txAmount);
    if (!txDescription.trim() || isNaN(rawAmount) || rawAmount <= 0) return;

    // txType is 'expense' | 'transfer' only — no income path
    const category = txType === 'transfer' ? 'transfer' : txCategory || 'other';

    setIsSaving(true);

    if (editingMovement) {
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update({
          date:                    txDate,
          description:             txDescription.trim(),
          type:                    txType,
          category,
          sub_category:            txType === 'expense' ? (txSubCategory || null) : null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  Math.abs(rawAmount),
          notes:                   txNotes.trim() || null,
          attributed_to_type:      txType === 'expense' ? txAttrType : null,
          attributed_to_member_id: txType === 'expense' && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .eq('id', editingMovement.id)
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);
      if (updateError) { setError('שגיאה בעדכון התנועה. נסה שוב.'); return; }
      setTransactions(prev => prev.map(m => m.id === editingMovement.id ? (data as FinancialMovement) : m));
    } else {
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({
          user_id:                 user.id,
          account_id:              accountId,
          date:                    txDate,
          description:             txDescription.trim(),
          type:                    txType,
          category,
          sub_category:            txType === 'expense' ? (txSubCategory || null) : null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  Math.abs(rawAmount),
          status:                  'actual',
          source:                  'manual',
          notes:                   txNotes.trim() || null,
          attributed_to_type:      txType === 'expense' ? txAttrType : null,
          attributed_to_member_id: txType === 'expense' && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);
      if (insertError) { setError('שגיאה בשמירת התנועה. נסה שוב.'); return; }
      setTransactions(prev => [data as FinancialMovement, ...prev]);
    }

    setShowAddPanel(false);
    resetForm();
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: deleteError } = await supabase
      .from('financial_movements').delete().eq('id', id);
    setDeletingId(null);
    if (deleteError) { setError('שגיאה במחיקת התנועה. נסה שוב.'); return; }
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  // ── Open edit panel (expense/transfer only) ───────────────────────────────
  const handleEdit = (movement: FinancialMovement) => {
    if (movement.type === 'income') return; // income is managed in IncomesPage
    setEditingMovement(movement);
    setTxType(movement.type as TxType);
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

  // ── Voice stub ───────────────────────────────────────────────────────────
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

  // ── Computed ─────────────────────────────────────────────────────────────
  const searchFiltered = transactions.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.description.toLowerCase().includes(q) ||
      getCategoryInfo(tx.category).name.includes(searchQuery)
    );
  });

  const filteredTransactions = searchFiltered.filter(tx =>
    activeFilter === 'all' || tx.type === activeFilter
  );

  const sections = buildGroupedSections(filteredTransactions, activeFilter);

  // KPI totals from full month data (not filtered)
  const totalExpenses = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
  const totalIncome   = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
  const balance       = totalIncome - totalExpenses;

  // ── Shared style constants ────────────────────────────────────────────────
  const cardShadow = { boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' };
  const inputCls   = 'w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition';
  const labelCls   = 'block text-sm font-semibold text-gray-700 mb-1.5';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">תנועות</h1>
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
            <span className="font-bold text-base">+</span> הוסף הוצאה
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {([
            ['all',      'כל הסוגים'],
            ['expense',  'הוצאות'],
            ['income',   'הכנסות'],
            ['transfer', 'העברות'],
          ] as [FilterType, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setActiveFilter(val)}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200"
              style={activeFilter === val
                ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש תנועות..."
            className="w-full pr-9 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1E56A0] transition" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-xl mb-5 text-sm font-semibold"
        style={{ backgroundColor: '#E8F0FB' }}>
        <span>הוצאות: <span style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalExpenses)}</span></span>
        <span className="text-gray-300">|</span>
        <span>הכנסות: <span style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalIncome)}</span></span>
        <span className="text-gray-300">|</span>
        <span>מאזן: <span style={{ color: balance >= 0 ? '#00A86B' : '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
          {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
        </span></span>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען תנועות...</p>
        </div>

      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="text-4xl mb-4">{searchQuery ? '🔍' : '📋'}</div>
          <p className="text-gray-500 font-semibold mb-2">
            {searchQuery ? 'אין תוצאות לחיפוש זה' : 'אין תנועות לחודש זה'}
          </p>
          {!searchQuery && (
            <>
              <p className="text-sm text-gray-400 mb-5">
                {activeFilter === 'income'
                  ? 'הכנסות מנוהלות בדף הכנסות'
                  : 'הוסף הוצאה או העברה כדי להתחיל'}
              </p>
              {activeFilter === 'income' ? (
                <Link to="/incomes"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: '#00A86B' }}>
                  עבור להכנסות
                </Link>
              ) : (
                <button onClick={() => { resetForm(); setShowAddPanel(true); }}
                  className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: '#1E56A0' }}>
                  הוסף הוצאה
                </button>
              )}
            </>
          )}
        </div>

      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.type}>
              {/* Section header — shown when viewing all types */}
              {(activeFilter === 'all' || sections.length > 0) && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: section.accentColor }}>
                    {section.label}
                  </span>
                  <span className="text-xs font-bold tabular-nums"
                    style={{ color: section.accentColor }}>
                    {section.type === 'income' ? '+' : section.type === 'expense' ? '−' : ''}
                    {formatCurrency(section.total)}
                  </span>
                </div>
              )}

              {/* Category groups */}
              <div className="space-y-3">
                {section.groups.map(group => (
                  <div key={group.catId} className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>

                    {/* Category group header (expense only — income/transfer are single groups) */}
                    {section.type === 'expense' && (
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ backgroundColor: group.color + '0D', borderBottom: `1px solid ${group.color}25` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{group.icon}</span>
                          <span className="text-sm font-bold text-gray-800">{group.name}</span>
                          <span className="text-xs text-gray-400">{group.rows.length}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#E53E3E' }}>
                          −{formatCurrency(group.total)}
                        </span>
                      </div>
                    )}

                    {/* Rows */}
                    <div className="divide-y divide-gray-50">
                      {group.rows.map(tx => {
                        const pm         = resolvePaymentDisplay(tx.payment_source_id, tx.payment_method, paymentSources);
                        const isDeleting = deletingId === tx.id;
                        return (
                          <div key={tx.id}
                            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/70 transition-colors"
                            style={{ opacity: isDeleting ? 0.4 : 1 }}
                          >
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
                                  {tx.description}
                                </span>
                                {tx.sub_category && (
                                  <span className="text-xs text-gray-400 truncate">{tx.sub_category}</span>
                                )}
                                {(isCouple || isFamily) && tx.type === 'expense' && tx.attributed_to_type && (
                                  <AttrChip attrType={tx.attributed_to_type} memberId={tx.attributed_to_member_id} members={members} />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: pm.color + '15', color: pm.color }}>
                                  {pm.name}
                                </span>
                              </div>
                            </div>

                            {/* Amount + actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-bold tabular-nums"
                                style={{ color: tx.type === 'income' ? '#00A86B' : tx.type === 'transfer' ? '#6B7280' : '#E53E3E' }}>
                                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                                {formatCurrency(tx.amount)}
                              </span>

                              {tx.type === 'income' ? (
                                /* Income: link to IncomesPage for editing */
                                <Link to="/incomes"
                                  className="text-[10px] text-[#1E56A0] font-semibold hover:underline whitespace-nowrap leading-none">
                                  ↗ הכנסות
                                </Link>
                              ) : (
                                /* Expense / transfer: edit + delete */
                                <>
                                  <button onClick={() => handleEdit(tx)}
                                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                                    title="ערוך">
                                    ✏️
                                  </button>
                                  <button onClick={() => handleDelete(tx.id)} disabled={isDeleting}
                                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                                    title="מחק">
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Income section footer — directs to IncomesPage */}
              {section.type === 'income' && (
                <div className="flex justify-end mt-1 px-1">
                  <Link to="/incomes"
                    className="text-xs text-[#00A86B] font-semibold hover:underline">
                    ניהול הכנסות ←
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Drawer ─────────────────────────────────────────────── */}
      {showAddPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowAddPanel(false); resetForm(); }} />
          <div className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[420px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}>
            <div className="p-6">

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingMovement ? 'עריכת תנועה' : 'הוספת תנועה'}
                </h2>
                <button onClick={() => { setShowAddPanel(false); resetForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  ✕
                </button>
              </div>

              {/* Type tabs — expense and transfer only */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                {([['expense', 'הוצאה'], ['transfer', 'העברה']] as [TxType, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => { setTxType(val); setTxCategory(''); setTxSubCategory(''); }}
                    className="flex-1 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200"
                    style={txType === val
                      ? { backgroundColor: '#1E56A0', color: '#fff' }
                      : { color: '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Income redirect hint */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-5 text-xs"
                style={{ backgroundColor: '#F0F9F4', border: '1px solid #00A86B25' }}>
                <span className="text-gray-500">להוספת הכנסה:</span>
                <Link to="/incomes" onClick={() => { setShowAddPanel(false); resetForm(); }}
                  className="text-[#00A86B] font-semibold hover:underline">
                  עבור לדף הכנסות ←
                </Link>
              </div>

              <div className="space-y-4">
                {/* Description */}
                <div>
                  <label className={labelCls}>
                    {txType === 'transfer' ? 'תיאור ההעברה' : 'תיאור'}
                  </label>
                  <input value={txDescription} onChange={e => setTxDescription(e.target.value)}
                    placeholder={txType === 'transfer' ? 'למשל: העברה לחשבון חיסכון' : 'למשל: קניות בסופר'}
                    className={inputCls} />
                </div>

                {/* Amount */}
                <div>
                  <label className={labelCls}>סכום</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className={labelCls}>תאריך</label>
                  <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                    className={inputCls} />
                </div>

                {/* Category grid — expense only */}
                {txType === 'expense' && (
                  <div>
                    <label className={labelCls}>קטגוריה</label>
                    <div className="grid grid-cols-4 gap-2">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <button key={cat.id}
                          onClick={() => { setTxCategory(cat.id); setTxSubCategory(''); }}
                          className="flex flex-col items-center gap-1 p-2.5 border-2 rounded-xl transition-all"
                          style={txCategory === cat.id
                            ? { borderColor: cat.color, backgroundColor: cat.color + '12' }
                            : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-[10px] font-medium leading-tight text-center"
                            style={{ color: txCategory === cat.id ? cat.color : '#6b7280' }}>
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subcategory chips */}
                {txType === 'expense' && txCategory && SUBCATEGORIES[txCategory] && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">פירוט (אופציונלי)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBCATEGORIES[txCategory].map(sub => (
                        <button key={sub}
                          onClick={() => setTxSubCategory(txSubCategory === sub ? '' : sub)}
                          className="px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                          style={txSubCategory === sub
                            ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                            : { borderColor: '#e5e7eb', color: '#6b7280', backgroundColor: '#fff' }}>
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attribution — couple/family, expense only */}
                {(isCouple || isFamily) && txType === 'expense' && (
                  <div>
                    <label className={labelCls}>שיוך הוצאה</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setTxAttrType('shared'); setTxAttrMemberId(null); }}
                        className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txAttrType === 'shared'
                          ? { borderColor: '#6B7280', backgroundColor: '#6B728015', color: '#374151' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                        משותף
                      </button>
                      {members.map(m => (
                        <button key={m.id}
                          onClick={() => { setTxAttrType('member'); setTxAttrMemberId(m.id); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txAttrType === 'member' && txAttrMemberId === m.id
                            ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '15', color: m.avatarColor }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment source */}
                <div>
                  <label className={labelCls}>
                    {txType === 'transfer' ? 'חשבון מקור' : 'אמצעי תשלום'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {paymentSources.length > 0 ? (
                      paymentSources.map(src => (
                        <button key={src.id}
                          onClick={() => { setTxSourceId(src.id); setTxPayment(SOURCE_TYPE_TO_PM[src.type] || 'credit'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txSourceId === src.id
                            ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {src.name}
                        </button>
                      ))
                    ) : (
                      PAYMENT_METHODS.map(pm => (
                        <button key={pm.id}
                          onClick={() => { setTxPayment(pm.id); setTxSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txPayment === pm.id && !txSourceId
                            ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                          {pm.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>הערות</label>
                  <textarea value={txNotes} onChange={e => setTxNotes(e.target.value)}
                    rows={2} placeholder="הוסף הערה (אופציונלי)..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                {/* Submit */}
                <button onClick={handleSave}
                  disabled={isSaving || !txDescription.trim() || !txAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                  {isSaving ? 'שומר...' : editingMovement ? 'עדכן תנועה' : 'שמור תנועה'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Voice modal (stub) ────────────────────────────────────────────── */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">הוספה קולית</h2>
              <button
                onClick={() => { setShowVoiceModal(false); setIsRecording(false); setTranscription(''); if (recordingTimer.current) clearTimeout(recordingTimer.current); }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                ✕
              </button>
            </div>
            <button onClick={handleVoiceClick}
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 transition-all duration-200"
              style={isRecording
                ? { backgroundColor: '#E53E3E', animation: 'pulse 1s infinite', boxShadow: '0 0 0 8px rgba(229,62,62,0.2)' }
                : { backgroundColor: '#E8F0FB' }}>
              🎤
            </button>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              {isRecording ? 'מקליט...' : 'לחץ והתחל לדבר'}
            </p>
            {!isRecording && !transcription && (
              <p className="text-xs text-gray-400 mb-4">למשל: ״שילמתי 50 שקל על קפה מזומן״</p>
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
