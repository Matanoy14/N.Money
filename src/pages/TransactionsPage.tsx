import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, SUBCATEGORIES } from '../lib/categories';
import { PAYMENT_METHODS, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialMovement {
  id: string;
  date: string;
  description: string;
  type: 'expense';
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

// ─── Category lookup ──────────────────────────────────────────────────────────

const categoryMeta: Record<string, { name: string; icon: string; color: string }> =
  Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.id, c]));

const getCategoryInfo = (id: string) =>
  categoryMeta[id] ?? { name: id, icon: '📦', color: '#6B7280' };

// ─── Group builder ────────────────────────────────────────────────────────────

function buildCategoryGroups(txs: FinancialMovement[]): CategoryGroup[] {
  const groupMap = new Map<string, FinancialMovement[]>();
  txs.forEach(tx => {
    const key = tx.category || 'other';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(tx);
  });

  return Array.from(groupMap.entries())
    .map(([catId, rows]) => {
      const info = getCategoryInfo(catId);
      return {
        catId,
        name: info.name,
        icon: info.icon,
        color: info.color,
        total: rows.reduce((s, r) => s + r.amount, 0),
        rows: [...rows].sort((a, b) => b.date.localeCompare(a.date)),
      };
    })
    .sort((a, b) => b.total - a.total);
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
  const [expenses,        setExpenses]        = useState<FinancialMovement[]>([]);
  const [editingMovement, setEditingMovement] = useState<FinancialMovement | null>(null);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────
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

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
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
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (fetchError) {
      setError('שגיאה בטעינת ההוצאות. נסה שוב.');
    } else {
      setExpenses((data ?? []) as FinancialMovement[]);
    }
    setIsLoading(false);
  }, [user?.id, currentMonth]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

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

    setIsSaving(true);

    if (editingMovement) {
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update({
          date:                    txDate,
          description:             txDescription.trim(),
          type:                    'expense',
          category:                txCategory || 'other',
          sub_category:            txSubCategory || null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  Math.abs(rawAmount),
          notes:                   txNotes.trim() || null,
          attributed_to_type:      (isCouple || isFamily) ? txAttrType : null,
          attributed_to_member_id: (isCouple || isFamily) && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .eq('id', editingMovement.id)
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);
      if (updateError) { setError('שגיאה בעדכון ההוצאה. נסה שוב.'); return; }
      setExpenses(prev => prev.map(m => m.id === editingMovement.id ? (data as FinancialMovement) : m));
    } else {
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({
          user_id:                 user.id,
          account_id:              accountId,
          date:                    txDate,
          description:             txDescription.trim(),
          type:                    'expense',
          category:                txCategory || 'other',
          sub_category:            txSubCategory || null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  Math.abs(rawAmount),
          status:                  'actual',
          source:                  'manual',
          notes:                   txNotes.trim() || null,
          attributed_to_type:      (isCouple || isFamily) ? txAttrType : null,
          attributed_to_member_id: (isCouple || isFamily) && txAttrType === 'member' ? txAttrMemberId : null,
        })
        .select('id, date, description, type, category, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
        .single();

      setIsSaving(false);
      if (insertError) { setError('שגיאה בשמירת ההוצאה. נסה שוב.'); return; }
      setExpenses(prev => [data as FinancialMovement, ...prev]);
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
    if (deleteError) { setError('שגיאה במחיקת ההוצאה. נסה שוב.'); return; }
    setExpenses(prev => prev.filter(tx => tx.id !== id));
  };

  // ── Open edit panel ──────────────────────────────────────────────────────
  const handleEdit = (movement: FinancialMovement) => {
    setEditingMovement(movement);
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
  const filtered = expenses.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tx.description.toLowerCase().includes(q) ||
      getCategoryInfo(tx.category).name.toLowerCase().includes(q)
    );
  });

  const groups        = buildCategoryGroups(filtered);
  const totalExpenses = expenses.reduce((s, tx) => s + tx.amount, 0);

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
          <h1 className="text-2xl font-extrabold text-gray-900">הוצאות</h1>
          <MonthSelector />
        </div>
        <button
          onClick={() => { resetForm(); setShowAddPanel(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold text-base">+</span> הוסף הוצאה
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-5 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Search + total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש הוצאות..."
            className="w-full pr-9 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1E56A0] transition" />
        </div>
        <div className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#FEF2F2' }}>
          סה״כ החודש:{' '}
          <span style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
            −{formatCurrency(totalExpenses)}
          </span>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען הוצאות...</p>
        </div>

      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="text-4xl mb-4">{searchQuery ? '🔍' : '📋'}</div>
          <p className="text-gray-500 font-semibold mb-2">
            {searchQuery ? 'אין תוצאות לחיפוש זה' : 'אין הוצאות לחודש זה'}
          </p>
          {!searchQuery && (
            <button onClick={() => { resetForm(); setShowAddPanel(true); }}
              className="mt-4 px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
              style={{ backgroundColor: '#1E56A0' }}>
              הוסף הוצאה
            </button>
          )}
        </div>

      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.catId} className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>

              {/* Category group header */}
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
                          {(isCouple || isFamily) && tx.attributed_to_type && (
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
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#E53E3E' }}>
                          −{formatCurrency(tx.amount)}
                        </span>
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
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  {editingMovement ? 'עריכת הוצאה' : 'הוספת הוצאה'}
                </h2>
                <button onClick={() => { setShowAddPanel(false); resetForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Description */}
                <div>
                  <label className={labelCls}>תיאור</label>
                  <input value={txDescription} onChange={e => setTxDescription(e.target.value)}
                    placeholder="למשל: קניות בסופר"
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

                {/* Category grid */}
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

                {/* Subcategory chips */}
                {txCategory && SUBCATEGORIES[txCategory] && (
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

                {/* Attribution — couple/family only */}
                {(isCouple || isFamily) && (
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
                  <label className={labelCls}>אמצעי תשלום</label>
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
                  {isSaving ? 'שומר...' : editingMovement ? 'עדכן הוצאה' : 'שמור הוצאה'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsPage;
