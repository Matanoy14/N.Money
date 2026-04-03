import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../lib/formatters';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '../lib/categories';
import { PAYMENT_METHODS, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';
import MonthSelector from '../components/MonthSelector';

interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'bimonthly'; // legacy — kept for old rows
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
  weekly:    'שבועי',
  monthly:   'חודשי',
  bimonthly: 'דו-חודשי',
  yearly:    'שנתי',
  custom:    'התאמה אישית',
};

const PRESET_TO_INTERVAL: Record<Exclude<Preset, 'custom'>, { interval_unit: string; interval_value: number }> = {
  weekly:    { interval_unit: 'week',  interval_value: 1 },
  monthly:   { interval_unit: 'month', interval_value: 1 },
  bimonthly: { interval_unit: 'month', interval_value: 2 },
  yearly:    { interval_unit: 'year',  interval_value: 1 },
};

const INTERVAL_UNIT_LABELS: Record<string, string> = {
  week:  'שבועות',
  month: 'חודשים',
  year:  'שנים',
};

/** Derive preset from stored interval fields; falls back to legacy frequency for old rows */
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

/** Convert stored interval to monthly-equivalent for summary calculations */
function intervalToMonthly(amount: number, interval_unit: string | null, interval_value: number | null, legacyFrequency: FrequencyKey): number {
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

/** Format recurrence label for table display */
function formatRecurrence(interval_unit: string | null, interval_value: number | null, legacyFrequency: FrequencyKey): string {
  const preset = derivePreset(interval_unit, interval_value, legacyFrequency);
  if (preset !== 'custom') return PRESET_LABELS[preset];
  if (interval_unit && interval_value) {
    return `כל ${interval_value} ${INTERVAL_UNIT_LABELS[interval_unit] ?? interval_unit}`;
  }
  return PRESET_LABELS[preset];
}

const EMPTY_FORM = {
  description:       '',
  category:          EXPENSE_CATEGORIES[0].id,
  amount:            '',
  preset:            'monthly' as Preset,
  interval_unit:     'month',
  interval_value:    '1',
  billing_day:       '',
  payment_method:    'standing',
  payment_source_id: '' as string,
  limit_type:        'unlimited' as 'unlimited' | 'limited',
  max_occurrences:   '',
};

interface SavePayload {
  description:       string;
  category:          string;
  amount:            number;
  frequency:         FrequencyKey;
  interval_unit:     string;
  interval_value:    number;
  max_occurrences:   number | null;
  billing_day:       number | null;
  payment_method:    string;
  payment_source_id: string | null;
}

const FixedExpensesPage: React.FC = () => {
  const { accountId, paymentSources } = useAccount();
  const { user }                      = useAuth();
  const { currentMonth, isCurrentMonth } = useMonth();

  const [expenses, setExpenses]     = useState<RecurringExpense[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Panel state
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);

  // Edit scope modal state
  const [showScopeModal,    setShowScopeModal]    = useState(false);
  const [scopePayload,      setScopePayload]      = useState<SavePayload | null>(null);
  const [scopeMovIds,       setScopeMovIds]       = useState<string[]>([]);
  const [scopeRisky,        setScopeRisky]        = useState(false);
  const [scopeSaving,       setScopeSaving]       = useState(false);
  const [scopeCurrentMovId, setScopeCurrentMovId] = useState<string | null>(null);
  const [scopeError,        setScopeError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('recurring_expenses')
      .select('id, description, category, amount, frequency, interval_unit, interval_value, max_occurrences, billing_day, payment_method, payment_source_id, is_active')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('category');
    if (err) { setError('שגיאה בטעינת הנתונים'); }
    else      { setExpenses((data ?? []) as RecurringExpense[]); }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // ── Monthly confirmation ───────────────────────────────
  // YYYY-MM-01 string for the selected month
  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

  type ConfStatus = { status: 'confirmed' | 'skipped'; movement_id: string | null };
  const [confirmations,  setConfirmations]  = useState<Record<string, ConfStatus>>({});
  const [confirmedCounts, setConfirmedCounts] = useState<Record<string, number>>({});
  const [confirming,     setConfirming]     = useState<string | null>(null);
  const [confirmError,   setConfirmError]   = useState<string | null>(null);

  const loadConfirmations = useCallback(async () => {
    if (!accountId) return;
    const [{ data: monthData }, { data: allConfirmed }] = await Promise.all([
      supabase
        .from('recurring_confirmations')
        .select('recurring_id, status, movement_id')
        .eq('account_id', accountId)
        .eq('month', monthStr),
      supabase
        .from('recurring_confirmations')
        .select('recurring_id')
        .eq('account_id', accountId)
        .eq('status', 'confirmed'),
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
    if (existing?.status === 'confirmed') return; // already confirmed — no duplicate
    // Guard: do not confirm if max_occurrences already reached
    if (exp.max_occurrences != null && (confirmedCounts[exp.id] ?? 0) >= exp.max_occurrences) return;

    setConfirming(exp.id);
    setConfirmError(null);

    // Build movement date: billing_day clamped to actual days in month, else 1st
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const day = (exp.billing_day && exp.billing_day >= 1 && exp.billing_day <= 31)
      ? Math.min(exp.billing_day, daysInMonth)
      : 1;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const { data: movData, error: movErr } = await supabase
      .from('financial_movements')
      .insert({
        account_id:        accountId,
        user_id:           user.id,
        description:       exp.description,
        category:          exp.category,
        amount:            exp.amount,
        payment_method:    exp.payment_method,
        payment_source_id: exp.payment_source_id,
        type:              'expense',
        date:              dateStr,
        notes:             null,
      })
      .select('id')
      .single();

    if (movErr || !movData) {
      setConfirmError('שגיאה ביצירת התנועה — נסה שוב');
      setConfirming(null);
      return;
    }

    const movementId = movData.id;

    if (existing?.status === 'skipped') {
      // Override skipped → confirmed
      await supabase
        .from('recurring_confirmations')
        .update({ status: 'confirmed', movement_id: movementId })
        .eq('recurring_id', exp.id)
        .eq('month', monthStr);
    } else {
      await supabase
        .from('recurring_confirmations')
        .insert({
          account_id:   accountId,
          recurring_id: exp.id,
          month:        monthStr,
          status:       'confirmed',
          movement_id:  movementId,
        });
    }

    await loadConfirmations();
    setConfirming(null);
  };

  const handleSkip = async (exp: RecurringExpense) => {
    if (!accountId) return;
    if (confirmations[exp.id]) return; // already has a status — no override for skip

    setConfirming(exp.id);
    setConfirmError(null);

    await supabase
      .from('recurring_confirmations')
      .insert({
        account_id:   accountId,
        recurring_id: exp.id,
        month:        monthStr,
        status:       'skipped',
        movement_id:  null,
      });

    await loadConfirmations();
    setConfirming(null);
  };

  // ── panel helpers ──────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (exp: RecurringExpense) => {
    setEditId(exp.id);
    const preset = derivePreset(exp.interval_unit, exp.interval_value, exp.frequency);
    const iUnit  = exp.interval_unit  ?? (preset !== 'custom' ? PRESET_TO_INTERVAL[preset as Exclude<Preset,'custom'>].interval_unit  : 'month');
    const iValue = exp.interval_value ?? (preset !== 'custom' ? PRESET_TO_INTERVAL[preset as Exclude<Preset,'custom'>].interval_value : 1);
    setForm({
      description:       exp.description,
      category:          exp.category,
      amount:            String(exp.amount),
      preset,
      interval_unit:     iUnit,
      interval_value:    String(iValue),
      billing_day:       exp.billing_day != null ? String(exp.billing_day) : '',
      payment_method:    exp.payment_method,
      payment_source_id: exp.payment_source_id ?? '',
      limit_type:        exp.max_occurrences != null ? 'limited' : 'unlimited',
      max_occurrences:   exp.max_occurrences != null ? String(exp.max_occurrences) : '',
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
      description:       form.description.trim(),
      category:          form.category,
      amount,
      frequency:         legacyFreqMap[form.preset],
      interval_unit:     resolvedInterval.interval_unit,
      interval_value:    resolvedInterval.interval_value,
      max_occurrences:   form.limit_type === 'limited' && form.max_occurrences
                           ? Math.min(99, Math.max(1, parseInt(form.max_occurrences, 10)))
                           : null,
      billing_day:       form.billing_day ? parseInt(form.billing_day, 10) : null,
      payment_method:    form.payment_method,
      payment_source_id: form.payment_source_id || null,
    };

    // ── Add mode: commit directly ────────────────────────────
    if (!editId) {
      setSaving(true);
      const { error: err } = await supabase
        .from('recurring_expenses')
        .insert({ ...payload, account_id: accountId, user_id: user.id, start_date: new Date().toISOString().slice(0, 10) });
      setSaving(false);
      if (!err) { closePanel(); await load(); }
      else       { setError('שגיאה בשמירת הנתונים'); }
      return;
    }

    // ── Edit mode: fetch past confirmed count, then show scope modal ─
    setSaving(true);
    const { data: confirmedRows } = await supabase
      .from('recurring_confirmations')
      .select('movement_id')
      .eq('recurring_id', editId)
      .eq('status', 'confirmed')
      .not('movement_id', 'is', null);
    setSaving(false);

    const movIds = (confirmedRows ?? [])
      .map((c: { movement_id: string | null }) => c.movement_id)
      .filter((id): id is string => id != null);

    const originalExp  = expenses.find(e => e.id === editId);
    const formBillingDay = form.billing_day ? parseInt(form.billing_day, 10) : null;
    const isRisky = originalExp != null && (
      amount !== originalExp.amount ||
      formBillingDay !== originalExp.billing_day
    );

    // Capture current-month confirmed movement_id (if any) for "current-only" scope
    const currentMonthConf = confirmations[editId];
    const currentMovId = currentMonthConf?.status === 'confirmed' ? currentMonthConf.movement_id ?? null : null;

    setScopePayload(payload);
    setScopeMovIds(movIds);
    setScopeRisky(isRisky);
    setScopeCurrentMovId(currentMovId);
    setScopeError(null);
    setShowScopeModal(true);
  };

  const handleApplyScope = async (scope: 'future' | 'retroactive' | 'current-only') => {
    if (!scopePayload || !editId) return;
    setScopeError(null);

    // ── Current-only: update the single confirmed movement for this month only ──
    if (scope === 'current-only') {
      if (!scopeCurrentMovId) {
        setScopeError('לא קיימת תנועה מאושרת לחודש הנוכחי. בחר "עדכן להמשך בלבד" כדי לשנות את התבנית.');
        return;
      }
      setScopeSaving(true);
      await supabase
        .from('financial_movements')
        .update({
          description:       scopePayload.description,
          category:          scopePayload.category,
          payment_method:    scopePayload.payment_method,
          payment_source_id: scopePayload.payment_source_id,
        })
        .eq('id', scopeCurrentMovId);
      setScopeSaving(false);
      setShowScopeModal(false);
      setScopePayload(null);
      setScopeMovIds([]);
      setScopeRisky(false);
      setScopeCurrentMovId(null);
      setScopeError(null);
      closePanel();
      await loadConfirmations();
      return;
    }

    // ── Future / Retroactive: always update template ─────────────────────────
    setScopeSaving(true);
    const { error: templateErr } = await supabase
      .from('recurring_expenses')
      .update(scopePayload)
      .eq('id', editId);

    if (templateErr) {
      setError('שגיאה בשמירת הנתונים');
      setScopeSaving(false);
      setShowScopeModal(false);
      return;
    }

    // Retroactive: also patch all linked confirmed financial_movements — safe fields only
    if (scope === 'retroactive' && scopeMovIds.length > 0) {
      await supabase
        .from('financial_movements')
        .update({
          description:       scopePayload.description,
          category:          scopePayload.category,
          payment_method:    scopePayload.payment_method,
          payment_source_id: scopePayload.payment_source_id,
        })
        .in('id', scopeMovIds);
    }

    setScopeSaving(false);
    setShowScopeModal(false);
    setScopePayload(null);
    setScopeMovIds([]);
    setScopeRisky(false);
    setScopeCurrentMovId(null);
    setScopeError(null);
    closePanel();
    await load();
  };

  const handleDeactivate = async (id: string) => {
    const { error: err } = await supabase
      .from('recurring_expenses')
      .update({ is_active: false })
      .eq('id', id);
    if (!err) setExpenses(prev => prev.filter(e => e.id !== id));
    else setError('שגיאה בביטול ההוצאה');
  };

  // ── derived numbers ────────────────────────────────────
  const totalMonthly = expenses.reduce(
    (s, e) => s + intervalToMonthly(e.amount, e.interval_unit, e.interval_value, e.frequency), 0,
  );

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + intervalToMonthly(e.amount, e.interval_unit, e.interval_value, e.frequency);
    return acc;
  }, {});

  // ── render ─────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">הוצאות קבועות</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף הוצאה קבועה
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {/* ── Monthly confirmation section ─────────────────── */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900">אישור חודשי</h2>
              <p className="text-xs text-gray-400 mt-0.5">סמן אילו הוצאות קבועות שולמו החודש</p>
            </div>
            <MonthSelector />
          </div>

          {confirmError && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{confirmError}</div>
          )}

          <div className="divide-y divide-gray-50">
            {expenses.map(exp => {
              const conf            = confirmations[exp.id];
              const isConfirmed     = conf?.status === 'confirmed';
              const isSkipped       = conf?.status === 'skipped';
              const isPending       = !conf;
              const isBusy          = confirming === exp.id;
              const catMeta         = getCategoryMeta(exp.category);
              const confirmedCount  = confirmedCounts[exp.id] ?? 0;
              const isExhausted     = exp.max_occurrences != null && confirmedCount >= exp.max_occurrences;

              return (
                <div key={exp.id} className="flex items-center gap-3 px-6 py-4">
                  {/* Category dot */}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catMeta.color }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                    <p className="text-xs text-gray-400">{catMeta.name} · {formatCurrency(exp.amount)}</p>
                  </div>

                  {/* Status badge */}
                  {isExhausted && !isConfirmed && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                      הושלם ({confirmedCount}/{exp.max_occurrences})
                    </span>
                  )}
                  {isConfirmed && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 flex-shrink-0">
                      אושר ✓
                    </span>
                  )}
                  {isSkipped && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                      דולג
                    </span>
                  )}
                  {isPending && !isExhausted && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">
                      ממתין לאישור
                    </span>
                  )}

                  {/* Action buttons — only for pending/skipped items in the current real month, and not exhausted */}
                  {isPending && !isExhausted && isCurrentMonth && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleConfirm(exp)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-xs font-semibold rounded-[8px] text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: '#1E56A0' }}
                      >
                        {isBusy ? '...' : 'אשר תשלום'}
                      </button>
                      <button
                        onClick={() => handleSkip(exp)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-xs font-semibold rounded-[8px] border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        דלג
                      </button>
                    </div>
                  )}

                  {/* Skipped row: allow confirming in current month if not exhausted */}
                  {isSkipped && !isExhausted && isCurrentMonth && (
                    <button
                      onClick={() => handleConfirm(exp)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-semibold rounded-[8px] text-white transition hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                      style={{ backgroundColor: '#1E56A0' }}
                    >
                      {isBusy ? '...' : 'אשר תשלום'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">סה״כ חודשי</p>
          <p className="text-2xl font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalMonthly)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">מספר הוצאות קבועות</p>
          <p className="text-2xl font-extrabold text-gray-900">{expenses.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">סה״כ שנתי</p>
          <p className="text-2xl font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalMonthly * 12)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">טוען...</div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-medium">אין הוצאות קבועות עדיין</p>
              <p className="text-sm mt-1">הוסף הוצאה קבועה כמו שכירות, ביטוח, ליסינג, מנויים ועוד</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['שם', 'קטגוריה', 'תדירות', 'יום חיוב', 'סכום', ''].map(h => (
                    <th key={h} className="text-right text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => {
                  const catColor  = getCategoryMeta(exp.category).color;
                  const monthly   = intervalToMonthly(exp.amount, exp.interval_unit, exp.interval_value, exp.frequency);
                  const isMonthly = derivePreset(exp.interval_unit, exp.interval_value, exp.frequency) === 'monthly';
                  return (
                    <tr
                      key={exp.id}
                      className="border-b border-gray-50 group transition-colors hover:bg-blue-50/40"
                      style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}
                    >
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 text-right">
                        {exp.description}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: catColor + '18', color: catColor }}>
                          {getCategoryMeta(exp.category).name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 text-right">
                        {formatRecurrence(exp.interval_unit, exp.interval_value, exp.frequency)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 text-right">
                        {exp.billing_day != null ? `${exp.billing_day} לחודש` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div>
                          <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(exp.amount)}
                          </span>
                          {!isMonthly && (
                            <span className="block text-[10px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              ≈ {formatCurrency(monthly)} / חודש
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(exp)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm"
                            title="עריכה"
                          >✏️</button>
                          <button
                            onClick={() => handleDeactivate(exp.id)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-sm"
                            title="ביטול הוצאה קבועה"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Category breakdown */}
          {Object.keys(byCategory).length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h3 className="font-semibold text-gray-900 mb-4">חלוקה לפי קטגוריה</h3>
              <div className="space-y-3">
                {Object.entries(byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => {
                    const color = getCategoryMeta(cat).color;
                    const pct   = totalMonthly > 0 ? Math.round((amt / totalMonthly) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{getCategoryMeta(cat).name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{pct}%</span>
                            <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(amt)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Upcoming billing */}
          {expenses.filter(e => e.billing_day != null).length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h3 className="font-semibold text-gray-900 mb-4">ימי חיוב</h3>
              <div className="space-y-3">
                {expenses
                  .filter(e => e.billing_day != null)
                  .sort((a, b) => (a.billing_day ?? 0) - (b.billing_day ?? 0))
                  .slice(0, 5)
                  .map(exp => (
                    <div key={exp.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{exp.description}</p>
                        <p className="text-xs text-gray-400">{exp.billing_day} לחודש</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit slide-in panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div
            className="fixed top-0 right-0 lg:right-[240px] h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease' }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editId ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה'}
              </h2>
              <button onClick={closePanel}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם ההוצאה</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="למשל: שכירות"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                />
              </div>

              {/* Amount + Frequency preset */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תדירות</label>
                  <select
                    value={form.preset}
                    onChange={e => {
                      const p = e.target.value as Preset;
                      if (p !== 'custom') {
                        const iv = PRESET_TO_INTERVAL[p as Exclude<Preset, 'custom'>];
                        setForm(f => ({ ...f, preset: p, interval_unit: iv.interval_unit, interval_value: String(iv.interval_value) }));
                      } else {
                        setForm(f => ({ ...f, preset: p }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white"
                  >
                    {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom interval controls */}
              {form.preset === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הגדרת תדירות</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 flex-shrink-0">כל</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={form.interval_value}
                      onChange={e => setForm(f => ({ ...f, interval_value: e.target.value }))}
                      className="w-16 px-3 py-2.5 border border-gray-200 rounded-[10px] text-sm text-center focus:outline-none focus:border-[#1E56A0] transition"
                    />
                    <select
                      value={form.interval_unit}
                      onChange={e => setForm(f => ({ ...f, interval_unit: e.target.value }))}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white"
                    >
                      <option value="week">שבועות</option>
                      <option value="month">חודשים</option>
                      <option value="year">שנים</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                <div className="flex flex-wrap gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const active = form.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                        className="px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition"
                        style={active
                          ? { borderColor: cat.color, backgroundColor: cat.color + '15', color: cat.color }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Billing day + Payment method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">יום חיוב</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.billing_day}
                    onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))}
                    placeholder="1–31"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">אמצעי תשלום</label>
                  <select
                    value={form.payment_source_id || form.payment_method}
                    onChange={e => {
                      const val = e.target.value;
                      const src = paymentSources.find(s => s.id === val);
                      if (src) {
                        setForm(f => ({ ...f, payment_source_id: src.id, payment_method: SOURCE_TYPE_TO_PM[src.type] || 'credit' }));
                      } else {
                        setForm(f => ({ ...f, payment_source_id: '', payment_method: val }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition bg-white"
                  >
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

              {/* Charge-count limit */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">מספר חיובים</label>
                <div className="flex gap-2">
                  {(['unlimited', 'limited'] as const).map(lt => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, limit_type: lt, max_occurrences: lt === 'unlimited' ? '' : f.max_occurrences }))}
                      className="flex-1 py-2 rounded-[10px] border-2 text-xs font-semibold transition"
                      style={form.limit_type === lt
                        ? { borderColor: '#1E56A0', backgroundColor: '#1E56A010', color: '#1E56A0' }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      {lt === 'unlimited' ? 'ללא הגבלה' : 'מספר חיובים'}
                    </button>
                  ))}
                </div>
                {form.limit_type === 'limited' && (
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={form.max_occurrences}
                    onChange={e => setForm(f => ({ ...f, max_occurrences: e.target.value }))}
                    placeholder="1–99"
                    className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                )}
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={closePanel}
                className="flex-1 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.description.trim() || !form.amount}
                className="flex-1 py-3 rounded-[10px] text-white font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit scope modal */}
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
                {/* Current month only */}
                <div>
                  <button
                    onClick={() => handleApplyScope('current-only')}
                    disabled={scopeSaving || !scopeCurrentMovId}
                    className="w-full py-3 rounded-[10px] border-2 text-sm font-semibold transition disabled:opacity-40"
                    style={scopeCurrentMovId
                      ? { borderColor: '#1E56A0', color: '#1E56A0', backgroundColor: '#1E56A008' }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >
                    החודש הנוכחי בלבד
                  </button>
                  {!scopeCurrentMovId && (
                    <p className="text-[11px] text-gray-400 mt-1 text-center">
                      אין תנועה מאושרת לחודש הנוכחי
                    </p>
                  )}
                </div>

                {/* Future only */}
                <button
                  onClick={() => handleApplyScope('future')}
                  disabled={scopeSaving}
                  className="w-full py-3 rounded-[10px] border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  עדכן להמשך בלבד
                </button>

                {/* Retroactive */}
                <button
                  onClick={() => handleApplyScope('retroactive')}
                  disabled={scopeSaving}
                  className="w-full py-3 rounded-[10px] text-white text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
                >
                  {scopeSaving
                    ? 'שומר...'
                    : `עדכן גם את העבר${scopeMovIds.length > 0 ? ` (${scopeMovIds.length} תנועות)` : ''}`}
                </button>

                <button
                  onClick={() => {
                    setShowScopeModal(false);
                    setScopePayload(null);
                    setScopeMovIds([]);
                    setScopeRisky(false);
                    setScopeCurrentMovId(null);
                    setScopeError(null);
                  }}
                  disabled={scopeSaving}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default FixedExpensesPage;
