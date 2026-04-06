import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../../lib/formatters';
import { useAccount } from '../../context/AccountContext';
import { useAuth } from '../../context/AuthContext';
import { useMonth } from '../../context/MonthContext';
import { supabase } from '../../lib/supabase';
import { EXPENSE_CATEGORIES, getCategoryMeta, SUBCATEGORIES } from '../../lib/categories';
import { PAYMENT_METHODS, SOURCE_TYPE_TO_PM } from '../../lib/paymentMethods';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  sub_category: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'bimonthly';
  interval_unit:   string | null;
  interval_value:  number | null;
  max_occurrences: number | null;
  billing_day: number | null;
  payment_method: string;
  payment_source_id: string | null;
  is_active: boolean;
}

type FrequencyKey = 'monthly' | 'weekly' | 'yearly' | 'bimonthly';
type Preset = 'weekly' | 'monthly' | 'bimonthly' | 'yearly' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  weekly: 'שבועי', monthly: 'חודשי', bimonthly: 'דו-חודשי', yearly: 'שנתי', custom: 'מותאם',
};

const PRESET_TO_INTERVAL: Record<Exclude<Preset, 'custom'>, { interval_unit: string; interval_value: number }> = {
  weekly:    { interval_unit: 'week',  interval_value: 1 },
  monthly:   { interval_unit: 'month', interval_value: 1 },
  bimonthly: { interval_unit: 'month', interval_value: 2 },
  yearly:    { interval_unit: 'year',  interval_value: 1 },
};

interface SavePayload {
  description: string; category: string; sub_category: string | null;
  attributed_to_type: string | null; attributed_to_member_id: string | null;
  amount: number; frequency: FrequencyKey;
  interval_unit: string; interval_value: number; max_occurrences: number | null;
  billing_day: number | null; payment_method: string; payment_source_id: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function derivePreset(interval_unit: string | null, interval_value: number | null, legacyFrequency?: FrequencyKey): Preset {
  if (interval_unit && interval_value) {
    if (interval_unit === 'week'  && interval_value === 1) return 'weekly';
    if (interval_unit === 'month' && interval_value === 1) return 'monthly';
    if (interval_unit === 'month' && interval_value === 2) return 'bimonthly';
    if (interval_unit === 'year'  && interval_value === 1) return 'yearly';
    return 'custom';
  }
  if (legacyFrequency === 'weekly')    return 'weekly';
  if (legacyFrequency === 'bimonthly') return 'bimonthly';
  if (legacyFrequency === 'yearly')    return 'yearly';
  return 'monthly';
}

export function intervalToMonthly(amount: number, interval_unit: string | null, interval_value: number | null, legacyFrequency: FrequencyKey): number {
  if (interval_unit && interval_value && interval_value > 0) {
    switch (interval_unit) {
      case 'week':  return (amount * 52) / (12 * interval_value);
      case 'month': return amount / interval_value;
      case 'year':  return amount / (12 * interval_value);
    }
  }
  switch (legacyFrequency) {
    case 'monthly':   return amount;
    case 'weekly':    return (amount * 52) / 12;
    case 'yearly':    return amount / 12;
    case 'bimonthly': return amount / 2;
  }
  return amount;
}

function formatRecurrence(interval_unit: string | null, interval_value: number | null, legacyFrequency: FrequencyKey): string {
  const preset = derivePreset(interval_unit, interval_value, legacyFrequency);
  if (preset !== 'custom') return PRESET_LABELS[preset];
  if (interval_unit && interval_value) {
    const unitLabel: Record<string, string> = { week: 'שבועות', month: 'חודשים', year: 'שנים' };
    return `כל ${interval_value} ${unitLabel[interval_unit] ?? interval_unit}`;
  }
  return PRESET_LABELS[preset];
}

const EMPTY_FORM = {
  description: '', category: EXPENSE_CATEGORIES[0].id, sub_category: '', amount: '',
  preset: 'monthly' as Preset, interval_unit: 'month', interval_value: '1',
  billing_day: '', payment_method: 'standing', payment_source_id: '' as string,
  limit_type: 'unlimited' as 'unlimited' | 'limited', max_occurrences: '',
  attributed_to_type: 'shared' as 'shared' | 'member',
  attributed_to_member_id: '' as string,
};

// ─── Component ────────────────────────────────────────────────────────────────

const FixedExpensesTab: React.FC = () => {
  const { accountId, paymentSources, isCouple, isFamily, members } = useAccount();
  const { user }                      = useAuth();
  const { currentMonth, isCurrentMonth } = useMonth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [expenses,  setExpenses]  = useState<RecurringExpense[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);

  const [showScopeModal,    setShowScopeModal]    = useState(false);
  const [scopePayload,      setScopePayload]      = useState<SavePayload | null>(null);
  const [scopeMovIds,       setScopeMovIds]       = useState<string[]>([]);
  const [scopeRisky,        setScopeRisky]        = useState(false);
  const [scopeSaving,       setScopeSaving]       = useState(false);
  const [scopeCurrentMovId, setScopeCurrentMovId] = useState<string | null>(null);
  const [scopeError,        setScopeError]        = useState<string | null>(null);

  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

  type ConfStatus = { status: 'confirmed' | 'skipped'; movement_id: string | null };
  const [confirmations,   setConfirmations]   = useState<Record<string, ConfStatus>>({});
  const [confirmedCounts, setConfirmedCounts] = useState<Record<string, number>>({});
  const [confirming,          setConfirming]          = useState<string | null>(null);
  const [confirmError,        setConfirmError]        = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('recurring_expenses')
      .select('id, description, category, sub_category, attributed_to_type, attributed_to_member_id, amount, frequency, interval_unit, interval_value, max_occurrences, billing_day, payment_method, payment_source_id, is_active')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('billing_day', { ascending: true, nullsFirst: false });
    if (err) setError('שגיאה בטעינת הנתונים');
    else     setExpenses((data ?? []) as RecurringExpense[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // ── Handle ?add=true URL param ───────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setEditId(null);
      setForm(EMPTY_FORM);
      setPanelOpen(true);
      const params = new URLSearchParams(searchParams);
      params.delete('add');
      setSearchParams(params, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadConfirmations = useCallback(async () => {
    if (!accountId) return;
    const [{ data: monthData }, { data: allConfirmed }] = await Promise.all([
      supabase.from('recurring_confirmations').select('recurring_id, status, movement_id')
        .eq('account_id', accountId).eq('month', monthStr),
      supabase.from('recurring_confirmations').select('recurring_id')
        .eq('account_id', accountId).eq('status', 'confirmed'),
    ]);
    const map: Record<string, ConfStatus> = {};
    (monthData ?? []).forEach((c: { recurring_id: string; status: 'confirmed' | 'skipped'; movement_id: string | null }) => {
      map[c.recurring_id] = { status: c.status, movement_id: c.movement_id };
    });
    setConfirmations(map);
    const counts: Record<string, number> = {};
    (allConfirmed ?? []).forEach((c: { recurring_id: string }) => {
      counts[c.recurring_id] = (counts[c.recurring_id] ?? 0) + 1;
    });
    setConfirmedCounts(counts);
  }, [accountId, monthStr]);

  useEffect(() => { loadConfirmations(); }, [loadConfirmations]);

  const handleConfirm = async (exp: RecurringExpense) => {
    if (!accountId || !user) return;
    const existing = confirmations[exp.id];
    if (existing?.status === 'confirmed') return;
    if (exp.max_occurrences != null && (confirmedCounts[exp.id] ?? 0) >= exp.max_occurrences) return;
    setConfirming(exp.id);
    setConfirmError(null);
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const day = (exp.billing_day && exp.billing_day >= 1 && exp.billing_day <= 31)
      ? Math.min(exp.billing_day, daysInMonth) : 1;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const { data: movData, error: movErr } = await supabase
      .from('financial_movements')
      .insert({ account_id: accountId, user_id: user.id, description: exp.description,
        category: exp.category, sub_category: exp.sub_category ?? null,
        attributed_to_type: exp.attributed_to_type ?? null,
        attributed_to_member_id: exp.attributed_to_member_id ?? null,
        amount: exp.amount, payment_method: exp.payment_method,
        payment_source_id: exp.payment_source_id,
        type: 'expense', date: dateStr, source: 'recurring', status: 'actual', notes: null })
      .select('id').single();
    if (movErr || !movData) { setConfirmError('שגיאה ביצירת התנועה — נסה שוב'); setConfirming(null); return; }
    const movementId = movData.id;
    if (existing?.status === 'skipped') {
      await supabase.from('recurring_confirmations')
        .update({ status: 'confirmed', movement_id: movementId })
        .eq('recurring_id', exp.id).eq('month', monthStr);
    } else {
      await supabase.from('recurring_confirmations')
        .insert({ account_id: accountId, recurring_id: exp.id, month: monthStr, status: 'confirmed', movement_id: movementId });
    }
    await loadConfirmations();
    setConfirming(null);
  };

  const handleSkip = async (exp: RecurringExpense) => {
    if (!accountId) return;
    if (confirmations[exp.id]) return;
    setConfirming(exp.id);
    setConfirmError(null);
    await supabase.from('recurring_confirmations')
      .insert({ account_id: accountId, recurring_id: exp.id, month: monthStr, status: 'skipped', movement_id: null });
    await loadConfirmations();
    setConfirming(null);
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setPanelOpen(true); };

  const openEdit = (exp: RecurringExpense) => {
    setEditId(exp.id);
    const preset = derivePreset(exp.interval_unit, exp.interval_value, exp.frequency);
    const iUnit  = exp.interval_unit  ?? (preset !== 'custom' ? PRESET_TO_INTERVAL[preset as Exclude<Preset,'custom'>].interval_unit  : 'month');
    const iValue = exp.interval_value ?? (preset !== 'custom' ? PRESET_TO_INTERVAL[preset as Exclude<Preset,'custom'>].interval_value : 1);
    setForm({
      description: exp.description, category: exp.category, sub_category: exp.sub_category ?? '', amount: String(exp.amount),
      preset, interval_unit: iUnit, interval_value: String(iValue),
      billing_day: exp.billing_day != null ? String(exp.billing_day) : '',
      payment_method: exp.payment_method, payment_source_id: exp.payment_source_id ?? '',
      limit_type: exp.max_occurrences != null ? 'limited' : 'unlimited',
      max_occurrences: exp.max_occurrences != null ? String(exp.max_occurrences) : '',
      attributed_to_type: (exp.attributed_to_type as 'shared' | 'member') ?? 'shared',
      attributed_to_member_id: exp.attributed_to_member_id ?? '',
    });
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setEditId(null); };

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount || !accountId || !user) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    const resolvedInterval = form.preset !== 'custom'
      ? PRESET_TO_INTERVAL[form.preset as Exclude<Preset, 'custom'>]
      : { interval_unit: form.interval_unit, interval_value: parseInt(form.interval_value, 10) || 1 };
    const legacyFreqMap: Record<Preset, FrequencyKey> = {
      weekly: 'weekly', monthly: 'monthly', bimonthly: 'bimonthly', yearly: 'yearly', custom: 'monthly',
    };
    const payload: SavePayload = {
      description: form.description.trim(), category: form.category, sub_category: form.sub_category || null,
      attributed_to_type: (isCouple || isFamily) ? form.attributed_to_type : null,
      attributed_to_member_id: (isCouple || isFamily) && form.attributed_to_type === 'member'
        ? form.attributed_to_member_id || null : null,
      amount, frequency: legacyFreqMap[form.preset],
      interval_unit: resolvedInterval.interval_unit, interval_value: resolvedInterval.interval_value,
      max_occurrences: form.limit_type === 'limited' && form.max_occurrences
        ? Math.min(99, Math.max(1, parseInt(form.max_occurrences, 10))) : null,
      billing_day: form.billing_day ? parseInt(form.billing_day, 10) : null,
      payment_method: form.payment_method, payment_source_id: form.payment_source_id || null,
    };
    if (!editId) {
      setSaving(true);
      const { error: err } = await supabase.from('recurring_expenses')
        .insert({ ...payload, account_id: accountId, user_id: user.id, start_date: new Date().toISOString().slice(0, 10) });
      setSaving(false);
      if (!err) { closePanel(); await load(); }
      else       setError('שגיאה בשמירת הנתונים');
      return;
    }
    setSaving(true);
    const { data: confirmedRows } = await supabase.from('recurring_confirmations')
      .select('movement_id').eq('recurring_id', editId).eq('status', 'confirmed')
      .not('movement_id', 'is', null);
    setSaving(false);
    const movIds = (confirmedRows ?? [])
      .map((c: { movement_id: string | null }) => c.movement_id)
      .filter((id): id is string => id != null);
    const originalExp = expenses.find(e => e.id === editId);
    const formBillingDay = form.billing_day ? parseInt(form.billing_day, 10) : null;
    const isRisky = originalExp != null && (amount !== originalExp.amount || formBillingDay !== originalExp.billing_day);
    const currentMonthConf = confirmations[editId];
    const currentMovId = currentMonthConf?.status === 'confirmed' ? currentMonthConf.movement_id ?? null : null;
    setScopePayload(payload); setScopeMovIds(movIds); setScopeRisky(isRisky);
    setScopeCurrentMovId(currentMovId); setScopeError(null); setShowScopeModal(true);
  };

  const handleApplyScope = async (scope: 'future' | 'retroactive' | 'current-only') => {
    if (!scopePayload || !editId) return;
    setScopeError(null);
    if (scope === 'current-only') {
      if (!scopeCurrentMovId) { setScopeError('לא קיימת תנועה מאושרת לחודש הנוכחי.'); return; }
      setScopeSaving(true);
      await supabase.from('financial_movements').update({
        description: scopePayload.description, category: scopePayload.category,
        sub_category: scopePayload.sub_category,
        attributed_to_type: scopePayload.attributed_to_type,
        attributed_to_member_id: scopePayload.attributed_to_member_id,
        payment_method: scopePayload.payment_method, payment_source_id: scopePayload.payment_source_id,
      }).eq('id', scopeCurrentMovId);
      setScopeSaving(false);
      setShowScopeModal(false); setScopePayload(null); setScopeMovIds([]); setScopeRisky(false); setScopeCurrentMovId(null); setScopeError(null);
      closePanel(); await loadConfirmations(); return;
    }
    setScopeSaving(true);
    const { error: templateErr } = await supabase.from('recurring_expenses').update(scopePayload).eq('id', editId);
    if (templateErr) { setError('שגיאה בשמירת הנתונים'); setScopeSaving(false); setShowScopeModal(false); return; }
    if (scope === 'retroactive' && scopeMovIds.length > 0) {
      await supabase.from('financial_movements').update({
        description: scopePayload.description, category: scopePayload.category,
        sub_category: scopePayload.sub_category,
        attributed_to_type: scopePayload.attributed_to_type,
        attributed_to_member_id: scopePayload.attributed_to_member_id,
        payment_method: scopePayload.payment_method, payment_source_id: scopePayload.payment_source_id,
      }).in('id', scopeMovIds);
    }
    setScopeSaving(false);
    setShowScopeModal(false); setScopePayload(null); setScopeMovIds([]); setScopeRisky(false); setScopeCurrentMovId(null); setScopeError(null);
    closePanel(); await load();
  };

  const handleDeactivate = async (id: string) => {
    if (confirmDeactivateId !== id) {
      setConfirmDeactivateId(id);
      setTimeout(() => setConfirmDeactivateId(curr => curr === id ? null : curr), 3000);
      return;
    }
    setConfirmDeactivateId(null);
    const { error: err } = await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id);
    if (!err) setExpenses(prev => prev.filter(e => e.id !== id));
    else setError('שגיאה בביטול ההוצאה');
  };

  const totalMonthly = expenses.reduce(
    (s, e) => s + intervalToMonthly(e.amount, e.interval_unit, e.interval_value, e.frequency), 0,
  );

  const confirmedCount  = Object.values(confirmations).filter(c => c.status === 'confirmed').length;
  const pendingCount    = expenses.filter(e => !confirmations[e.id]).length;
  const allConfirmed    = expenses.length > 0 && pendingCount === 0;
  const cardShadow      = { boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' };

  return (
    <div>
      {/* Action row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-gray-700">
            סה״כ חודשי:{' '}
            <span className="font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(totalMonthly)}
            </span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{expenses.length} הוצאות קבועות</span>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
          <span className="font-bold text-base">+</span> הוספה
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">טוען הוצאות קבועות...</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center" style={cardShadow}>
          <div className="text-4xl mb-3">🔄</div>
          <p className="font-semibold text-gray-700 mb-1">אין הוצאות קבועות עדיין</p>
          <p className="text-sm text-gray-400 mb-5">הוסף שכירות, ביטוח, ליסינג, מנויים ועוד</p>
          <button onClick={openAdd}
            className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm transition hover:opacity-90"
            style={{ backgroundColor: '#1E56A0' }}>
            הוסף הוצאה קבועה
          </button>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Monthly confirmation section */}
          <div className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">אישור חודשי</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {allConfirmed
                    ? 'כל ההוצאות אושרו החודש ✓'
                    : `${confirmedCount} מתוך ${expenses.length} אושרו`}
                </p>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1">
                {expenses.slice(0, 8).map(exp => {
                  const conf = confirmations[exp.id];
                  return (
                    <span key={exp.id}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: conf?.status === 'confirmed' ? '#00A86B'
                          : conf?.status === 'skipped' ? '#d1d5db'
                          : '#F59E0B',
                      }} />
                  );
                })}
                {expenses.length > 8 && (
                  <span className="text-xs text-gray-400">+{expenses.length - 8}</span>
                )}
              </div>
            </div>

            {confirmError && (
              <div className="mx-5 mt-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                <span>⚠️ {confirmError}</span>
                <button onClick={() => setConfirmError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none flex-shrink-0">✕</button>
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {expenses.map(exp => {
                const conf           = confirmations[exp.id];
                const isConfirmed    = conf?.status === 'confirmed';
                const isSkipped      = conf?.status === 'skipped';
                const isPending      = !conf;
                const isBusy         = confirming === exp.id;
                const catMeta        = getCategoryMeta(exp.category);
                const confirmedCnt   = confirmedCounts[exp.id] ?? 0;
                const isExhausted    = exp.max_occurrences != null && confirmedCnt >= exp.max_occurrences;

                return (
                  <div key={exp.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catMeta.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                      <p className="text-xs text-gray-400">{catMeta.name} · {formatCurrency(exp.amount)}</p>
                    </div>

                    {isExhausted && !isConfirmed && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                        הושלם
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#F0FDF4', color: '#00A86B' }}>
                        אושר ✓
                      </span>
                    )}
                    {isSkipped && !isExhausted && !isCurrentMonth && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                        דולג
                      </span>
                    )}
                    {isPending && !isExhausted && isCurrentMonth && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleConfirm(exp)} disabled={isBusy}
                          className="px-3 py-1.5 text-xs font-semibold rounded-[8px] text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: '#1E56A0' }}>
                          {isBusy ? '...' : 'אשר'}
                        </button>
                        <button onClick={() => handleSkip(exp)} disabled={isBusy}
                          className="px-3 py-1.5 text-xs font-semibold rounded-[8px] border border-gray-200 text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
                          דלג
                        </button>
                      </div>
                    )}
                    {isSkipped && !isExhausted && isCurrentMonth && (
                      <button onClick={() => handleConfirm(exp)} disabled={isBusy}
                        className="px-3 py-1.5 text-xs font-semibold rounded-[8px] text-white transition hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                        style={{ backgroundColor: '#1E56A0' }}>
                        {isBusy ? '...' : 'אשר'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Obligations list — cards */}
          <div className="bg-white rounded-2xl overflow-hidden" style={cardShadow}>
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">ניהול הוצאות קבועות</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {expenses.map(exp => {
                const catMeta  = getCategoryMeta(exp.category);
                const monthly  = intervalToMonthly(exp.amount, exp.interval_unit, exp.interval_value, exp.frequency);
                const preset   = derivePreset(exp.interval_unit, exp.interval_value, exp.frequency);
                const isMonthly = preset === 'monthly';

                return (
                  <div key={exp.id} className="flex items-center gap-3 px-5 py-4 group hover:bg-gray-50/60 transition-colors">
                    {/* Category icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ backgroundColor: catMeta.color + '15' }}>
                      {catMeta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{exp.description}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: catMeta.color + '15', color: catMeta.color }}>
                          {PRESET_LABELS[preset]}
                        </span>
                        {exp.billing_day != null && (
                          <span className="text-[10px] text-gray-400">יום {exp.billing_day}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-gray-400">{catMeta.name}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-left flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(exp.amount)}
                      </p>
                      {!isMonthly && (
                        <p className="text-[10px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          ≈ {formatCurrency(monthly)}/חודש
                        </p>
                      )}
                    </div>

                    {/* Actions — always visible on mobile, hover-reveal on desktop */}
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => openEdit(exp)}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm" title="ערוך"
                        aria-label="ערוך הוצאה קבועה">
                        ✏️
                      </button>
                      {confirmDeactivateId === exp.id ? (
                        <button onClick={() => handleDeactivate(exp.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
                          aria-label="אשר ביטול">
                          בטל?
                        </button>
                      ) : (
                        <button onClick={() => handleDeactivate(exp.id)}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-sm" title="בטל"
                          aria-label="בטל הוצאה קבועה">
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Panel ──────────────────────────────────────────────── */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div className="fixed top-0 right-0 lg:right-[240px] h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease' }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editId ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה'}
              </h2>
              <button onClick={closePanel}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם ההוצאה</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="למשל: שכירות"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input type="number" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תדירות</label>
                  <select value={form.preset}
                    onChange={e => {
                      const p = e.target.value as Preset;
                      if (p !== 'custom') {
                        const iv = PRESET_TO_INTERVAL[p as Exclude<Preset, 'custom'>];
                        setForm(f => ({ ...f, preset: p, interval_unit: iv.interval_unit, interval_value: String(iv.interval_value) }));
                      } else {
                        setForm(f => ({ ...f, preset: p }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white">
                    {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.preset === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הגדרת תדירות</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 flex-shrink-0">כל</span>
                    <input type="number" min="1" max="99" value={form.interval_value}
                      onChange={e => setForm(f => ({ ...f, interval_value: e.target.value }))}
                      className="w-16 px-3 py-2.5 border border-gray-200 rounded-[10px] text-sm text-center focus:outline-none focus:border-[#1E56A0] transition" />
                    <select value={form.interval_unit}
                      onChange={e => setForm(f => ({ ...f, interval_unit: e.target.value }))}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white">
                      <option value="week">שבועות</option>
                      <option value="month">חודשים</option>
                      <option value="year">שנים</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                <div className="flex flex-wrap gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const active = form.category === cat.id;
                    return (
                      <button key={cat.id}
                        onClick={() => setForm(f => ({ ...f, category: cat.id, sub_category: '' }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition"
                        style={active
                          ? { borderColor: cat.color, backgroundColor: cat.color + '15', color: cat.color }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                        <span>{cat.icon}</span>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {/* Subcategory chips — shown when category has subcategories */}
                {SUBCATEGORIES[form.category] && SUBCATEGORIES[form.category].length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">פירוט (אופציונלי)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBCATEGORIES[form.category].map(sub => {
                        const active = form.sub_category === sub;
                        return (
                          <button key={sub}
                            onClick={() => setForm(f => ({ ...f, sub_category: active ? '' : sub }))}
                            className="px-2.5 py-1 rounded-full border text-xs font-medium transition"
                            style={active
                              ? { borderColor: '#1E56A0', backgroundColor: '#1E56A010', color: '#1E56A0' }
                              : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {(isCouple || isFamily) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך הוצאה</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, attributed_to_type: 'shared', attributed_to_member_id: '' }))}
                      className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                      style={form.attributed_to_type === 'shared'
                        ? { borderColor: '#6B7280', backgroundColor: '#6B728015', color: '#374151' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                      משותף
                    </button>
                    {members.map(m => (
                      <button key={m.id}
                        onClick={() => setForm(f => ({ ...f, attributed_to_type: 'member', attributed_to_member_id: m.id }))}
                        className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                        style={form.attributed_to_type === 'member' && form.attributed_to_member_id === m.id
                          ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '15', color: m.avatarColor }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">יום חיוב</label>
                  <input type="number" min="1" max="31" value={form.billing_day}
                    onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))}
                    placeholder="1–31"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">אמצעי תשלום</label>
                  <select value={form.payment_source_id || form.payment_method}
                    onChange={e => {
                      const val = e.target.value;
                      const src = paymentSources.find(s => s.id === val);
                      if (src) setForm(f => ({ ...f, payment_source_id: src.id, payment_method: SOURCE_TYPE_TO_PM[src.type] || 'credit' }));
                      else     setForm(f => ({ ...f, payment_source_id: '', payment_method: val }));
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white">
                    {paymentSources.length > 0 && (
                      <optgroup label="החשבונות שלי">
                        {paymentSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </optgroup>
                    )}
                    <optgroup label={paymentSources.length > 0 ? 'סוג כללי' : 'אמצעי תשלום'}>
                      {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">מספר חיובים</label>
                <div className="flex gap-2">
                  {(['unlimited', 'limited'] as const).map(lt => (
                    <button key={lt} type="button"
                      onClick={() => setForm(f => ({ ...f, limit_type: lt, max_occurrences: lt === 'unlimited' ? '' : f.max_occurrences }))}
                      className="flex-1 py-2 rounded-[10px] border-2 text-xs font-semibold transition"
                      style={form.limit_type === lt
                        ? { borderColor: '#1E56A0', backgroundColor: '#1E56A010', color: '#1E56A0' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                      {lt === 'unlimited' ? 'ללא הגבלה' : 'מספר חיובים'}
                    </button>
                  ))}
                </div>
                {form.limit_type === 'limited' && (
                  <input type="number" min="1" max="99" value={form.max_occurrences}
                    onChange={e => setForm(f => ({ ...f, max_occurrences: e.target.value }))}
                    placeholder="1–99"
                    className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                )}
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button onClick={closePanel}
                className="flex-1 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">
                ביטול
              </button>
              <button onClick={handleSave} disabled={saving || !form.description.trim() || !form.amount}
                className="flex-1 py-3 rounded-[10px] text-white font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit scope modal ──────────────────────────────────────────────── */}
      {showScopeModal && scopePayload && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">על אילו חודשים להחיל?</h3>
              <p className="text-sm text-gray-500 mb-4">בחר את טווח השינוי עבור הוצאה זו</p>
              {scopeMovIds.length > 0 && (
                <p className="text-xs font-medium text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5 mb-3">
                  יעודכנו {scopeMovIds.length} תנועות עבר
                </p>
              )}
              {scopeRisky && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm mb-3">
                  שינוי סכום / תאריך לא יעודכן בתנועות קיימות
                </div>
              )}
              {scopeError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
                  {scopeError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <button onClick={() => handleApplyScope('current-only')}
                    disabled={scopeSaving || !scopeCurrentMovId}
                    className="w-full py-3 rounded-[10px] border-2 text-sm font-semibold transition disabled:opacity-40"
                    style={scopeCurrentMovId
                      ? { borderColor: '#1E56A0', color: '#1E56A0', backgroundColor: '#1E56A008' }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}>
                    החודש הנוכחי בלבד
                  </button>
                  {!scopeCurrentMovId && (
                    <p className="text-[11px] text-gray-400 mt-1 text-center">אין תנועה מאושרת לחודש הנוכחי</p>
                  )}
                </div>
                <button onClick={() => handleApplyScope('future')} disabled={scopeSaving}
                  className="w-full py-3 rounded-[10px] border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                  עדכן להמשך בלבד
                </button>
                <button onClick={() => handleApplyScope('retroactive')} disabled={scopeSaving}
                  className="w-full py-3 rounded-[10px] text-white text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                  {scopeSaving ? 'שומר...' : `עדכן גם את העבר${scopeMovIds.length > 0 ? ` (${scopeMovIds.length})` : ''}`}
                </button>
                <button onClick={() => { setShowScopeModal(false); setScopePayload(null); setScopeMovIds([]); setScopeRisky(false); setScopeCurrentMovId(null); setScopeError(null); }}
                  disabled={scopeSaving}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition disabled:opacity-50">
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default FixedExpensesTab;
