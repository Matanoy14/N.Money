import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../lib/formatters';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, getPaymentMethod } from '../lib/paymentMethods';

type LoanType = 'mortgage' | 'bank' | 'non_bank' | 'credit_line' | 'private' | 'leasing' | 'other';
type LoanStatus = 'active' | 'completed' | 'frozen';

interface Loan {
  id: string;
  name: string;
  type: LoanType;
  original_amount: number | null;
  balance: number;
  monthly_payment: number;
  interest_rate: number | null;
  total_months: number | null;
  months_remaining: number | null;
  start_date: string | null;
  end_date: string | null;
  status: LoanStatus;
  payment_method: string | null;
  notes: string | null;
}

// All types kept in display maps for backward compat with stored 'leasing' records
const TYPE_LABELS: Record<string, string> = {
  mortgage:    'משכנתא',
  bank:        'הלוואת בנק',
  non_bank:    'גוף חוץ בנקאי',
  credit_line: 'מסגרת אשראי',
  private:     'הלוואה פרטית',
  leasing:     'ליסינג',
  other:       'אחר',
};

const TYPE_COLORS: Record<string, string> = {
  mortgage:    '#1E56A0',
  bank:        '#0EA5E9',
  non_bank:    '#F59E0B',
  credit_line: '#8B5CF6',
  private:     '#EC4899',
  leasing:     '#00A86B',
  other:       '#6B7280',
};

const TYPE_ICONS: Record<string, string> = {
  mortgage:    '🏠',
  bank:        '🏦',
  non_bank:    '💰',
  credit_line: '💳',
  private:     '🤝',
  leasing:     '🚗',
  other:       '📋',
};

const STATUS_CONFIG: Record<LoanStatus, { label: string; bg: string; color: string }> = {
  active:    { label: 'פעיל',   bg: '#E8F0FB', color: '#1E56A0' },
  completed: { label: 'הסתיים', bg: '#E8F8F2', color: '#00A86B' },
  frozen:    { label: 'מוקפא',  bg: '#FEF3C7', color: '#B45309' },
};

// Leasing excluded from form picker — still shows on old stored records via TYPE_LABELS above
const LOAN_TYPES: LoanType[] = ['mortgage', 'bank', 'non_bank', 'credit_line', 'private', 'other'];

// ── Amortization helpers (Shpitzer / equal monthly payment) ──────────────────

function computeLoanDerived(P: number, annualRate: number, n: number, startDate: string) {
  const r = annualRate / 100 / 12;

  let M: number;
  if (r < 0.000001) {
    M = P / n;
  } else {
    const factor = Math.pow(1 + r, n);
    M = (P * r * factor) / (factor - 1);
  }

  const start = new Date(startDate);
  const now   = new Date();
  const elapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );
  const mRemaining = Math.max(0, n - elapsed);

  let B: number;
  if (r < 0.000001) {
    B = Math.max(0, P - M * elapsed);
  } else {
    const factorN = Math.pow(1 + r, n);
    const factorK = Math.pow(1 + r, elapsed);
    B = Math.max(0, P * (factorN - factorK) / (factorN - 1));
  }

  const endD = new Date(startDate);
  endD.setMonth(endD.getMonth() + n);

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const monthly      = round2(M);
  const balance      = round2(B);
  const totalRem     = round2(monthly * mRemaining);
  const remInterest  = round2(Math.max(0, totalRem - balance));
  const totalInterest = round2(Math.max(0, M * n - P));

  return {
    monthly_payment:    monthly,
    months_remaining:   mRemaining,
    balance,
    end_date:           endD.toISOString().split('T')[0],
    total_remaining:    totalRem,
    remaining_interest: remInterest,
    total_interest:     totalInterest,
    canCompute:         true as const,
  };
}

function getLoanDisplayValues(loan: Loan) {
  if (loan.original_amount != null && loan.total_months != null && loan.start_date) {
    return computeLoanDerived(
      loan.original_amount,
      loan.interest_rate ?? 0,
      loan.total_months,
      loan.start_date,
    );
  }
  // Fallback to stored values for old records
  const totalRem = loan.months_remaining != null
    ? Math.round(loan.monthly_payment * loan.months_remaining * 100) / 100
    : null;
  return {
    monthly_payment:    loan.monthly_payment,
    months_remaining:   loan.months_remaining,
    balance:            loan.balance,
    end_date:           loan.end_date,
    total_remaining:    totalRem,
    remaining_interest: totalRem != null ? Math.max(0, totalRem - loan.balance) : null,
    total_interest:     null,
    canCompute:         false as const,
  };
}

// ── Form ──────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:            '',
  type:            'bank' as LoanType,
  original_amount: '',
  interest_rate:   '',
  total_months:    '',
  start_date:      '',
  payment_method:  'standing',
  notes:           '',
};

// ── Component ─────────────────────────────────────────────────────────────────

const LoansPage: React.FC = () => {
  const { accountId } = useAccount();
  const { user }      = useAuth();

  const [loans, setLoans]       = useState<Loan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('loans')
      .select('id, name, type, original_amount, balance, monthly_payment, interest_rate, total_months, months_remaining, start_date, end_date, status, payment_method, notes')
      .eq('account_id', accountId)
      .order('balance', { ascending: false });
    if (err) setError('שגיאה בטעינת הנתונים');
    else     setLoans((data ?? []) as Loan[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (l: Loan) => {
    setEditId(l.id);
    setForm({
      name:            l.name,
      type:            l.type,
      original_amount: l.original_amount != null ? String(l.original_amount) : '',
      interest_rate:   l.interest_rate   != null ? String(l.interest_rate)   : '',
      total_months:    l.total_months    != null ? String(l.total_months)    : '',
      start_date:      l.start_date ?? '',
      payment_method:  l.payment_method  ?? 'standing',
      notes:           l.notes ?? '',
    });
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setEditId(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !accountId || !user) return;

    const hasNewModel = form.original_amount && form.total_months && form.start_date;
    if (!editId && !hasNewModel) return; // new loans require the model fields

    setSaving(true);

    let extra: Record<string, unknown> = {};

    if (hasNewModel) {
      const origAmt = parseFloat(form.original_amount);
      const totalMo = parseInt(form.total_months);
      const intRate = form.interest_rate ? parseFloat(form.interest_rate) : 0;
      if (isNaN(origAmt) || origAmt <= 0 || isNaN(totalMo) || totalMo <= 0) {
        setSaving(false);
        return;
      }
      const derived = computeLoanDerived(origAmt, intRate, totalMo, form.start_date);
      extra = {
        original_amount:  origAmt,
        interest_rate:    form.interest_rate ? intRate : null,
        total_months:     totalMo,
        start_date:       form.start_date,
        // Derived stored for summary cards + backward compat
        balance:          derived.balance,
        monthly_payment:  derived.monthly_payment,
        months_remaining: derived.months_remaining,
        end_date:         derived.end_date,
      };
    }

    const payload = {
      name:           form.name.trim(),
      type:           form.type,
      payment_method: form.payment_method || null,
      notes:          form.notes.trim() || null,
      ...extra,
    };

    let err;
    if (editId) {
      ({ error: err } = await supabase.from('loans').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await supabase.from('loans').insert({
        ...payload,
        account_id: accountId,
        user_id:    user.id,
        status:     'active',
      }));
    }

    setSaving(false);
    if (!err) { closePanel(); await load(); }
    else       setError('שגיאה בשמירת הנתונים');
  };

  const handleStatusChange = async (id: string, status: LoanStatus) => {
    const { error: err } = await supabase.from('loans').update({ status }).eq('id', id);
    if (!err) setLoans(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    else      setError('שגיאה בעדכון הסטטוס');
  };

  const handleDelete = async (id: string) => {
    const { error: err } = await supabase.from('loans').delete().eq('id', id);
    if (!err) setLoans(prev => prev.filter(l => l.id !== id));
    else      setError('שגיאה במחיקת ההלוואה');
  };

  const activeLoans  = loans.filter(l => l.status === 'active');
  const totalBalance = activeLoans.reduce((s, l) => s + getLoanDisplayValues(l).balance, 0);
  const totalMonthly = activeLoans.reduce((s, l) => s + getLoanDisplayValues(l).monthly_payment, 0);

  const canSave = form.name.trim() && (editId || (form.original_amount && form.total_months && form.start_date));

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">הלוואות</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף הלוואה
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">סה״כ חוב פעיל</p>
          <p className="text-2xl font-extrabold" style={{ color: '#E53E3E', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">תשלום חודשי</p>
          <p className="text-2xl font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalMonthly)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">מספר הלוואות פעילות</p>
          <p className="text-2xl font-extrabold text-gray-900">{activeLoans.length}</p>
        </div>
      </div>

      {/* Loans list */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 flex items-center justify-center text-gray-400 text-sm">טוען...</div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-gray-400">
          <div className="text-4xl mb-3">💳</div>
          <p className="font-medium">אין הלוואות רשומות</p>
          <p className="text-sm mt-1">הוסף משכנתא, הלוואת בנק, מסגרת אשראי ועוד</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => {
            const color      = TYPE_COLORS[loan.type] ?? '#6B7280';
            const st         = STATUS_CONFIG[loan.status];
            const isExpanded = expandedId === loan.id;
            const display    = getLoanDisplayValues(loan);

            return (
              <div
                key={loan.id}
                className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden"
                style={{ borderRightWidth: 4, borderRightColor: color, borderRightStyle: 'solid' }}
              >
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : loan.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ backgroundColor: color + '15' }}>
                        {TYPE_ICONS[loan.type] ?? '📋'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{loan.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          <span className="text-xs text-gray-400">{TYPE_LABELS[loan.type] ?? loan.type}</span>
                          {loan.interest_rate != null && (
                            <span className="text-xs text-gray-400">{loan.interest_rate}% ריבית</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xl font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(display.balance)}
                      </p>
                      <p className="text-xs text-gray-400 text-left">יתרה</p>
                    </div>
                  </div>

                  {loan.status === 'active' && (
                    <div className="mt-3 flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">תשלום חודשי: </span>
                        <span className="font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(display.monthly_payment)}
                        </span>
                      </div>
                      {display.end_date && (
                        <>
                          <span className="text-gray-300">|</span>
                          <div>
                            <span className="text-gray-500">תאריך סיום: </span>
                            <span className="font-bold text-gray-900">{display.end_date}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    {/* Metadata row */}
                    {(loan.original_amount != null || loan.start_date || loan.payment_method || display.months_remaining != null) && (
                      <div className="flex flex-wrap gap-4 text-sm mb-4">
                        {loan.original_amount != null && (
                          <div>
                            <span className="text-gray-500">סכום מקורי: </span>
                            <span className="font-semibold text-gray-700">{formatCurrency(loan.original_amount)}</span>
                          </div>
                        )}
                        {loan.total_months != null && (
                          <div>
                            <span className="text-gray-500">תקופה: </span>
                            <span className="font-semibold text-gray-700">{loan.total_months} חודשים</span>
                          </div>
                        )}
                        {display.months_remaining != null && (
                          <div>
                            <span className="text-gray-500">נותרו: </span>
                            <span className="font-semibold text-gray-700">{display.months_remaining} חודשים</span>
                          </div>
                        )}
                        {loan.start_date && (
                          <div>
                            <span className="text-gray-500">התחלה: </span>
                            <span className="font-semibold text-gray-700">{loan.start_date}</span>
                          </div>
                        )}
                        {loan.payment_method && (
                          <div>
                            <span className="text-gray-500">אמצעי תשלום: </span>
                            <span className="font-semibold" style={{ color: getPaymentMethod(loan.payment_method).color }}>
                              {getPaymentMethod(loan.payment_method).name}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Computed summary row */}
                    {(display.total_remaining != null || display.remaining_interest != null || display.total_interest != null) && (
                      <div className="flex flex-wrap gap-4 text-sm mb-4 pt-3 border-t border-gray-200">
                        {display.total_remaining != null && (
                          <div>
                            <span className="text-gray-500">נותר לשלם סה״כ: </span>
                            <span className="font-semibold text-gray-700">{formatCurrency(display.total_remaining)}</span>
                          </div>
                        )}
                        {display.remaining_interest != null && (
                          <div>
                            <span className="text-gray-500">ריבית עתידית משוערת: </span>
                            <span className="font-semibold" style={{ color: display.remaining_interest > 0 ? '#E53E3E' : '#6B7280' }}>
                              {formatCurrency(display.remaining_interest)}
                            </span>
                          </div>
                        )}
                        {display.total_interest != null && (
                          <div>
                            <span className="text-gray-500">סה״כ ריבית על ההלוואה: </span>
                            <span className="font-semibold text-gray-700">{formatCurrency(display.total_interest)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {loan.notes && (
                      <p className="text-sm text-gray-600 mb-4">{loan.notes}</p>
                    )}

                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => openEdit(loan)}
                        className="px-4 py-2 rounded-[10px] border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-white transition"
                      >
                        ✏️ ערוך
                      </button>
                      {loan.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(loan.id, 'completed')}
                          className="px-4 py-2 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
                          style={{ backgroundColor: '#E8F8F2', color: '#00A86B' }}
                        >
                          ✓ סמן כנסגרה
                        </button>
                      )}
                      {loan.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(loan.id, 'frozen')}
                          className="px-4 py-2 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
                          style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
                        >
                          ❄️ הקפא
                        </button>
                      )}
                      {loan.status !== 'active' && (
                        <button
                          onClick={() => handleStatusChange(loan.id, 'active')}
                          className="px-4 py-2 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
                          style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
                        >
                          ↩ הפעל מחדש
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(loan.id)}
                        className="px-4 py-2 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
                        style={{ backgroundColor: '#FEF2F2', color: '#E53E3E' }}
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div
            className="fixed top-0 right-0 lg:right-[240px] h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease' }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'עריכת הלוואה' : 'הלוואה חדשה'}</h2>
              <button onClick={closePanel}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם ההלוואה</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="למשל: משכנתא בנק לאומי"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סוג הלוואה</label>
                <div className="grid grid-cols-2 gap-2">
                  {LOAN_TYPES.map(t => {
                    const active = form.type === t;
                    const color  = TYPE_COLORS[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className="py-2.5 rounded-[10px] border-2 text-sm font-semibold transition"
                        style={active
                          ? { borderColor: color, backgroundColor: color + '12', color }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Original amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום הלוואה מקורי</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                  <input type="number" value={form.original_amount}
                    onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))}
                    placeholder="סכום ההלוואה שנלקחה"
                    className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>
              </div>

              {/* Interest rate + Total months */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ריבית שנתית (%)</label>
                  <input type="number" step="0.1" value={form.interest_rate}
                    onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                    placeholder="למשל: 3.5"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תקופת הלוואה (חודשים)</label>
                  <input type="number" value={form.total_months}
                    onChange={e => setForm(f => ({ ...f, total_months: e.target.value }))}
                    placeholder="למשל: 240"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך תחילת הלוואה</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                />
              </div>

              {/* Live preview of derived values */}
              {form.original_amount && form.total_months && form.start_date && (() => {
                const prev = computeLoanDerived(
                  parseFloat(form.original_amount) || 0,
                  form.interest_rate ? parseFloat(form.interest_rate) : 0,
                  parseInt(form.total_months) || 1,
                  form.start_date,
                );
                return (
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm space-y-1.5">
                    <p className="text-xs font-semibold text-blue-700 mb-2">תחזית מחושבת</p>
                    <div className="flex justify-between">
                      <span className="text-gray-600">תשלום חודשי</span>
                      <span className="font-bold text-gray-900">{formatCurrency(prev.monthly_payment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">יתרה נוכחית</span>
                      <span className="font-bold text-gray-900">{formatCurrency(prev.balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">חודשים נותרו</span>
                      <span className="font-bold text-gray-900">{prev.months_remaining}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">סה״כ ריבית</span>
                      <span className="font-bold" style={{ color: '#E53E3E' }}>{formatCurrency(prev.total_interest)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">אמצעי תשלום</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map(pm => {
                    const active = form.payment_method === pm.id;
                    return (
                      <button
                        key={pm.id}
                        onClick={() => setForm(f => ({ ...f, payment_method: pm.id }))}
                        className="px-3 py-1.5 rounded-[8px] border-2 text-xs font-semibold transition"
                        style={active
                          ? { borderColor: pm.color, backgroundColor: pm.color + '18', color: pm.color }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        {pm.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות (אופציונלי)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button onClick={closePanel}
                className="flex-1 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex-1 py-3 rounded-[10px] text-white font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
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

export default LoansPage;
