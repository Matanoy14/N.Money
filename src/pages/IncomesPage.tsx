import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency, formatDate } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_TYPES = ['משכורת', 'עצמאי', 'מתנה', 'שכירות', 'מילואים', 'בונוס', 'אחר'] as const;

/** Fallback payment methods for deposit field when no bank sources exist */
const DEPOSIT_FALLBACK_PM = PAYMENT_METHODS.filter(pm => pm.id === 'transfer' || pm.id === 'cash');

const MONTH_NAMES_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

const ANALYTICS_PERIOD_OPTIONS = [
  { id: '3m',  label: '3 חודשים' },
  { id: '6m',  label: '6 חודשים' },
  { id: '12m', label: '12 חודשים' },
  { id: 'ytd', label: 'מתחילת השנה' },
] as const;

type AnalyticsPeriod = '3m' | '6m' | '12m' | 'ytd';

interface PeriodBounds {
  startDate: string;
  endDate: string;
  periodMonths: { key: string; label: string }[];
}

/** Compute analytics period bounds anchored to the given currentMonth. */
function getAnalyticsPeriodBounds(currentMonth: Date, period: AnalyticsPeriod): PeriodBounds {
  const cy = currentMonth.getFullYear();
  const cm = currentMonth.getMonth(); // 0-indexed

  const months: { year: number; m: number }[] = [];

  if (period === 'ytd') {
    for (let mi = 0; mi <= cm; mi++) months.push({ year: cy, m: mi });
  } else {
    const count = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    for (let i = count - 1; i >= 0; i--) {
      let y = cy;
      let m = cm - i;
      while (m < 0) { m += 12; y--; }
      months.push({ year: y, m });
    }
  }

  const first = months[0];
  const last  = months[months.length - 1];
  const startDate = new Date(Date.UTC(first.year, first.m, 1)).toISOString().split('T')[0];
  const endDate   = new Date(Date.UTC(last.year,  last.m + 1, 0)).toISOString().split('T')[0];
  const periodMonths = months.map(({ year, m }) => ({
    key:   `${year}-${String(m + 1).padStart(2, '0')}`,
    label: `${MONTH_NAMES_HE[m]} ${String(year).slice(2)}`,
  }));

  return { startDate, endDate, periodMonths };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomeMovement {
  id: string;
  date: string;
  description: string;
  sub_category: string | null;
  payment_method: string;
  payment_source_id: string | null;
  amount: number;
  notes: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
  expected_amount: number | null;
  recurring_income_id?: string | null;
}

interface RecurringIncome {
  id: string;
  description: string;
  income_type: string | null;
  amount: number;
  expected_day_of_month: number | null;
  payment_method: string;
  payment_source_id: string | null;
  attributed_to_type: string | null;
  attributed_to_member_id: string | null;
  notes: string | null;
  is_active: boolean;
}

/** One row per (recurring_id, month) — from recurring_income_confirmations table (Phase 1 schema) */
interface RecurringIncomeConfirmation {
  id: string;
  recurring_id: string;
  month: string;         // YYYY-MM-DD (always first of month)
  status: 'confirmed' | 'skipped';
  movement_id: string | null;
}

/** Per-template monthly status derived for the selected month */
type TemplateMonthStatus = 'מצופה' | 'התקבל' | 'לא התקבל';

const RECURRING_SELECT =
  'id, description, income_type, amount, expected_day_of_month, payment_method, payment_source_id, attributed_to_type, attributed_to_member_id, notes, is_active';

// ─── Filter helper ────────────────────────────────────────────────────────────

function toggleFilter(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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

const IncomesPage: React.FC = () => {
  const { user }                                                    = useAuth();
  const { accountId, paymentSources, isCouple, isFamily, members } = useAccount();
  const { currentMonth }                                            = useMonth();

  // ── Data state ──────────────────────────────────────────────────────────
  const [incomes, setIncomes]       = useState<IncomeMovement[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [isSaving, setIsSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // ── Panel state ─────────────────────────────────────────────────────────
  const [showPanel, setShowPanel]         = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeMovement | null>(null);

  // ── Form state (actual income) ──────────────────────────────────────────
  const [txDescription,    setTxDescription]    = useState('');
  const [txAmount,         setTxAmount]         = useState('');
  const [txExpectedAmount, setTxExpectedAmount] = useState('');
  const [txDate,           setTxDate]           = useState(new Date().toISOString().split('T')[0]);
  const [txIncomeType,     setTxIncomeType]     = useState<string>('משכורת');
  const [txAttrType,       setTxAttrType]       = useState<string | null>(null);
  const [txAttrMemberId,   setTxAttrMemberId]   = useState<string | null>(null);
  const [txPayment,        setTxPayment]        = useState('transfer');
  const [txSourceId,       setTxSourceId]       = useState<string | null>(null);
  const [txNotes,          setTxNotes]          = useState('');

  // ── Recurring income state ──────────────────────────────────────────────
  const [recurringIncomes,  setRecurringIncomes]  = useState<RecurringIncome[]>([]);
  const [recurringLoading,  setRecurringLoading]  = useState(true);
  const [recurringError,    setRecurringError]    = useState<string | null>(null);
  const [recurringIsSaving,   setRecurringIsSaving]   = useState(false);
  const [deactivatingId,      setDeactivatingId]      = useState<string | null>(null);
  const [deletingTemplateId,  setDeletingTemplateId]  = useState<string | null>(null);

  // ── Recurring panel state ───────────────────────────────────────────────
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [editingTemplate,    setEditingTemplate]    = useState<RecurringIncome | null>(null);

  // ── Recurring form state ────────────────────────────────────────────────
  const [rtDescription,  setRtDescription]  = useState('');
  const [rtIncomeType,   setRtIncomeType]   = useState<string>('משכורת');
  const [rtAmount,       setRtAmount]       = useState('');
  const [rtExpectedDay,  setRtExpectedDay]  = useState('');
  const [rtPayment,      setRtPayment]      = useState('transfer');
  const [rtSourceId,     setRtSourceId]     = useState<string | null>(null);
  const [rtAttrType,     setRtAttrType]     = useState<string | null>(null);
  const [rtAttrMemberId, setRtAttrMemberId] = useState<string | null>(null);
  const [rtNotes,        setRtNotes]        = useState('');

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterSearch,      setFilterSearch]      = useState('');
  const [filterRowTypes,    setFilterRowTypes]    = useState<Set<string>>(new Set());
  const [filterIncomeTypes, setFilterIncomeTypes] = useState<Set<string>>(new Set());
  const [filterAttribution, setFilterAttribution] = useState<Set<string>>(new Set());
  const [filterDeposit,     setFilterDeposit]     = useState<Set<string>>(new Set());
  const [filterStatus,      setFilterStatus]      = useState<Set<string>>(new Set());

  // ── Recurring month confirmations state ─────────────────────────────────
  const [recurringMonthConfirmations,        setRecurringMonthConfirmations]        = useState<RecurringIncomeConfirmation[]>([]);
  const [_recurringMonthConfirmationsLoading, setRecurringMonthConfirmationsLoading] = useState(false);
  const [recurringMonthConfirmationsError,   setRecurringMonthConfirmationsError]   = useState<string | null>(null);

  // ── Arrival panel state (Phase 3 write path) ─────────────────────────────
  const [showArrivalPanel,        setShowArrivalPanel]        = useState(false);
  const [arrivalTemplate,         setArrivalTemplate]         = useState<RecurringIncome | null>(null);
  const [arrivalEditingMovementId, setArrivalEditingMovementId] = useState<string | null>(null);
  const [arrivalDescription,      setArrivalDescription]      = useState('');
  const [arrivalAmount,           setArrivalAmount]           = useState('');
  const [arrivalDate,             setArrivalDate]             = useState('');
  const [arrivalPayment,          setArrivalPayment]          = useState('transfer');
  const [arrivalSourceId,         setArrivalSourceId]         = useState<string | null>(null);
  const [arrivalAttrType,         setArrivalAttrType]         = useState<string | null>(null);
  const [arrivalAttrMemberId,     setArrivalAttrMemberId]     = useState<string | null>(null);
  const [arrivalNotes,            setArrivalNotes]            = useState('');
  const [arrivalIsSaving,         setArrivalIsSaving]         = useState(false);
  const [arrivalError,            setArrivalError]            = useState<string | null>(null);
  const [markingSkippedId,        setMarkingSkippedId]        = useState<string | null>(null);

  // ── Analytics state ───────────────────────────────────────────────────────
  const [analyticsPeriod,  setAnalyticsPeriod]  = useState<AnalyticsPeriod>('6m');
  const [analyticsData,    setAnalyticsData]    = useState<IncomeMovement[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError,   setAnalyticsError]   = useState<string | null>(null);

  // ── Deposit sources (bank only) — for drawers ────────────────────────────
  const depositSources = useMemo(
    () => paymentSources.filter(s => s.type === 'bank'),
    [paymentSources]
  );

  // ── Fetch income movements ────────────────────────────────────────────────
  const fetchIncomes = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    // UTC-safe month boundaries — avoids off-by-one at Israel UTC+2/+3
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const startDate = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0];
    const endDate   = new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0];

    const baseFilter = supabase
      .from('financial_movements')
      .eq('type', 'income')
      .eq('account_id', accountId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const { data, error: fetchError } = await baseFilter
      .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id');

    if (fetchError) {
      if (fetchError.code === '42703') {
        // expected_amount / recurring_income_id columns not yet added — migrations pending.
        // Fall back to base columns; UI degrades gracefully (no expected/recurring features).
        const { data: fallback, error: fallbackError } = await baseFilter
          .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id');
        if (!fallbackError) setIncomes((fallback ?? []) as IncomeMovement[]);
        else setError('שגיאה בטעינת הכנסות. נסה שוב.');
      } else {
        setError('שגיאה בטעינת הכנסות. נסה שוב.');
      }
    } else {
      setIncomes((data ?? []) as IncomeMovement[]);
    }
    setIsLoading(false);
  }, [user?.id, accountId, currentMonth]);

  useEffect(() => { fetchIncomes(); }, [fetchIncomes]);

  // ── Fetch recurring income templates (not month-scoped) ──────────────────
  const fetchRecurringIncomes = useCallback(async () => {
    if (!user || !accountId) return;
    setRecurringLoading(true);
    setRecurringError(null);
    const { data, error: fetchError } = await supabase
      .from('recurring_incomes')
      .select(RECURRING_SELECT)
      .eq('account_id', accountId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true });
    if (fetchError) {
      if (fetchError.code === '42P01') {
        // recurring_incomes table not yet created — migration pending. Degrade silently.
        setRecurringIncomes([]);
      } else {
        setRecurringError('שגיאה בטעינת הכנסות קבועות.');
      }
    } else {
      setRecurringIncomes((data ?? []) as RecurringIncome[]);
    }
    setRecurringLoading(false);
  }, [user?.id, accountId]);

  useEffect(() => { fetchRecurringIncomes(); }, [fetchRecurringIncomes]);

  // ── Fetch analytics incomes (multi-month range, independent of table query) ──
  const fetchAnalyticsIncomes = useCallback(async () => {
    if (!user || !accountId) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const { startDate, endDate } = getAnalyticsPeriodBounds(currentMonth, analyticsPeriod);
    const { data, error: fetchError } = await supabase
      .from('financial_movements')
      .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount')
      .eq('type', 'income')
      .eq('account_id', accountId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (fetchError) {
      if (fetchError.code === '42703') {
        // expected_amount column not yet added — migrations pending. Analytics degrades silently.
        setAnalyticsData([]);
      } else {
        setAnalyticsError('שגיאה בטעינת נתוני ניתוח.');
      }
    } else {
      setAnalyticsData((data ?? []) as IncomeMovement[]);
    }
    setAnalyticsLoading(false);
  }, [user?.id, accountId, currentMonth, analyticsPeriod]);

  useEffect(() => { fetchAnalyticsIncomes(); }, [fetchAnalyticsIncomes]);

  // ── Fetch recurring month confirmations for the selected month ────────────
  const fetchRecurringMonthConfirmations = useCallback(async () => {
    if (!user || !accountId) return;
    setRecurringMonthConfirmationsLoading(true);
    setRecurringMonthConfirmationsError(null);
    const y = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const monthStr = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    const { data, error: fetchError } = await supabase
      .from('recurring_income_confirmations')
      .select('id, recurring_id, month, status, movement_id')
      .eq('account_id', accountId)
      .eq('month', monthStr);
    if (fetchError) {
      if (fetchError.code === '42P01') {
        // recurring_income_confirmations table not yet created — migration pending. Degrade silently.
        setRecurringMonthConfirmations([]);
      } else {
        setRecurringMonthConfirmationsError('שגיאה בטעינת אישורי הכנסות קבועות.');
      }
    } else {
      setRecurringMonthConfirmations((data ?? []) as RecurringIncomeConfirmation[]);
    }
    setRecurringMonthConfirmationsLoading(false);
  }, [user?.id, accountId, currentMonth]);

  useEffect(() => { fetchRecurringMonthConfirmations(); }, [fetchRecurringMonthConfirmations]);

  // ── Reset form ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingIncome(null);
    setTxDescription('');
    setTxAmount('');
    setTxExpectedAmount('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxIncomeType('משכורת');
    setTxAttrType(null);
    setTxAttrMemberId(null);
    setTxPayment('transfer');
    setTxSourceId(null);
    setTxNotes('');
  };

  // ── Reset recurring form ──────────────────────────────────────────────────
  const resetRecurringForm = () => {
    setEditingTemplate(null);
    setRtDescription('');
    setRtIncomeType('משכורת');
    setRtAmount('');
    setRtExpectedDay('');
    setRtPayment('transfer');
    setRtSourceId(null);
    setRtAttrType(null);
    setRtAttrMemberId(null);
    setRtNotes('');
    setRecurringError(null);
  };

  // ── Open edit panel ───────────────────────────────────────────────────────
  const handleEdit = (income: IncomeMovement) => {
    setEditingIncome(income);
    setTxDescription(income.description);
    // סכום צפוי (primary) = expected_amount if tracked, else amount
    // סכום בפועל (optional) = amount only when expected is separately tracked
    setTxExpectedAmount(income.expected_amount != null ? String(income.expected_amount) : String(income.amount));
    setTxAmount(income.expected_amount != null ? String(income.amount) : '');
    setTxDate(income.date);
    setTxIncomeType(income.sub_category || 'משכורת');
    setTxAttrType(income.attributed_to_type || null);
    setTxAttrMemberId(income.attributed_to_member_id || null);
    setTxPayment(income.payment_method);
    setTxSourceId(income.payment_source_id);
    setTxNotes(income.notes ?? '');
    setShowPanel(true);
  };

  // ── Save income movement ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !accountId) return;
    const expectedRaw = parseFloat(txExpectedAmount);
    if (!txDescription.trim() || isNaN(expectedRaw) || expectedRaw <= 0) return;
    const actualRaw  = parseFloat(txAmount);
    const hasActual  = !isNaN(actualRaw) && actualRaw > 0;
    const amountToSave         = hasActual ? Math.abs(actualRaw) : Math.abs(expectedRaw);
    const expectedAmountToSave = hasActual ? expectedRaw : null;

    setIsSaving(true);
    const showAttrOnSave = isCouple || isFamily;

    if (editingIncome) {
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update({
          date:                    txDate,
          description:             txDescription.trim(),
          sub_category:            txIncomeType || null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  amountToSave,
          notes:                   txNotes.trim() || null,
          attributed_to_type:      showAttrOnSave ? txAttrType : null,
          attributed_to_member_id: showAttrOnSave && txAttrType === 'member' ? txAttrMemberId : null,
          expected_amount:         expectedAmountToSave,
        })
        .eq('id', editingIncome.id)
        .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
        .single();

      setIsSaving(false);
      if (updateError) { setError('שגיאה בעדכון ההכנסה. נסה שוב.'); return; }
      setIncomes(prev => prev.map(m => m.id === editingIncome.id ? (data as IncomeMovement) : m));
    } else {
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({
          user_id:                 user.id,
          account_id:              accountId,
          date:                    txDate,
          description:             txDescription.trim(),
          type:                    'income',
          category:                'income',
          sub_category:            txIncomeType || null,
          payment_method:          txPayment,
          payment_source_id:       txSourceId,
          amount:                  amountToSave,
          status:                  'actual',
          source:                  'manual',
          notes:                   txNotes.trim() || null,
          attributed_to_type:      showAttrOnSave ? txAttrType : null,
          attributed_to_member_id: showAttrOnSave && txAttrType === 'member' ? txAttrMemberId : null,
          expected_amount:         expectedAmountToSave,
        })
        .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
        .single();

      setIsSaving(false);
      if (insertError) { setError('שגיאה בשמירת ההכנסה. נסה שוב.'); return; }
      setIncomes(prev => [data as IncomeMovement, ...prev]);
    }

    setShowPanel(false);
    resetForm();
  };

  // ── Delete income movement ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error: deleteError } = await supabase
      .from('financial_movements')
      .delete()
      .eq('id', id);
    setDeletingId(null);
    if (deleteError) { setError('שגיאה במחיקת ההכנסה. נסה שוב.'); return; }
    setIncomes(prev => prev.filter(m => m.id !== id));
  };

  // ── Edit recurring template ───────────────────────────────────────────────
  const handleEditTemplate = (t: RecurringIncome) => {
    setRecurringError(null);
    setEditingTemplate(t);
    setRtDescription(t.description);
    setRtIncomeType(t.income_type || 'משכורת');
    setRtAmount(String(t.amount));
    setRtExpectedDay(t.expected_day_of_month != null ? String(t.expected_day_of_month) : '');
    setRtPayment(t.payment_method);
    setRtSourceId(t.payment_source_id);
    setRtAttrType(t.attributed_to_type);
    setRtAttrMemberId(t.attributed_to_member_id);
    setRtNotes(t.notes ?? '');
    setShowRecurringPanel(true);
  };

  // ── Save recurring template ───────────────────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!user || !accountId) return;
    const rawAmount = parseFloat(rtAmount);
    if (!rtDescription.trim() || isNaN(rawAmount) || rawAmount <= 0) return;

    setRecurringIsSaving(true);
    const showAttr = isCouple || isFamily;
    const payload = {
      description:             rtDescription.trim(),
      income_type:             rtIncomeType || null,
      amount:                  Math.abs(rawAmount),
      expected_day_of_month:   rtExpectedDay ? parseInt(rtExpectedDay, 10) : null,
      payment_method:          rtPayment,
      payment_source_id:       rtSourceId,
      attributed_to_type:      showAttr ? rtAttrType : null,
      attributed_to_member_id: showAttr && rtAttrType === 'member' ? rtAttrMemberId : null,
      notes:                   rtNotes.trim() || null,
    };

    if (editingTemplate) {
      const { data, error: updateError } = await supabase
        .from('recurring_incomes')
        .update(payload)
        .eq('id', editingTemplate.id)
        .select(RECURRING_SELECT)
        .single();
      setRecurringIsSaving(false);
      if (updateError) { setRecurringError('שגיאה בעדכון הכנסה קבועה.'); return; }
      setRecurringIncomes(prev => prev.map(t => t.id === editingTemplate.id ? (data as RecurringIncome) : t));
    } else {
      const { data, error: insertError } = await supabase
        .from('recurring_incomes')
        .insert({ ...payload, account_id: accountId, user_id: user.id })
        .select(RECURRING_SELECT)
        .single();
      setRecurringIsSaving(false);
      if (insertError) { setRecurringError('שגיאה בשמירת הכנסה קבועה.'); return; }
      setRecurringIncomes(prev => [...prev, data as RecurringIncome]);
    }

    setShowRecurringPanel(false);
    resetRecurringForm();
  };

  // ── Delete recurring template ─────────────────────────────────────────────
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('למחוק את ההכנסה הקבועה? הפעולה לא ניתנת לביטול.')) return;
    setDeletingTemplateId(id);
    const { error: deleteError } = await supabase
      .from('recurring_incomes')
      .delete()
      .eq('id', id);
    setDeletingTemplateId(null);
    if (deleteError) { setRecurringError('שגיאה במחיקת ההכנסה הקבועה. נסה שוב.'); return; }
    setRecurringIncomes(prev => prev.filter(t => t.id !== id));
  };

  // ── Toggle template active/inactive ──────────────────────────────────────
  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    setDeactivatingId(id);
    const { error: toggleError } = await supabase
      .from('recurring_incomes')
      .update({ is_active: !currentlyActive })
      .eq('id', id);
    setDeactivatingId(null);
    if (toggleError) { setRecurringError('שגיאה בעדכון הסטטוס.'); return; }
    setRecurringIncomes(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentlyActive } : t));
  };

  // ── Arrival panel helpers ─────────────────────────────────────────────────

  const resetArrivalForm = () => {
    setArrivalTemplate(null);
    setArrivalEditingMovementId(null);
    setArrivalDescription('');
    setArrivalAmount('');
    setArrivalDate('');
    setArrivalPayment('transfer');
    setArrivalSourceId(null);
    setArrivalAttrType(null);
    setArrivalAttrMemberId(null);
    setArrivalNotes('');
    setArrivalError(null);
  };

  /** Default arrival date: today when selected month is current month, else expected day or first. */
  const getDefaultArrivalDate = (t: RecurringIncome): string => {
    const today = new Date();
    const y = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    if (today.getFullYear() === y && today.getMonth() === mo) {
      return today.toISOString().split('T')[0];
    }
    if (t.expected_day_of_month != null) {
      const day = Math.min(t.expected_day_of_month, new Date(y, mo + 1, 0).getDate());
      return `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  };

  /** Open arrival drawer: edit-mode if already confirmed, new-mode otherwise. */
  const handleOpenArrival = (t: RecurringIncome) => {
    const conf = recurringMonthConfirmations.find(c => c.recurring_id === t.id);
    const existingMovement = conf?.movement_id ? incomes.find(m => m.id === conf.movement_id) : null;

    setArrivalTemplate(t);
    if (existingMovement) {
      setArrivalEditingMovementId(existingMovement.id);
      setArrivalDescription(existingMovement.description);
      setArrivalAmount(String(existingMovement.amount));
      setArrivalDate(existingMovement.date);
      setArrivalPayment(existingMovement.payment_method);
      setArrivalSourceId(existingMovement.payment_source_id);
      setArrivalAttrType(existingMovement.attributed_to_type);
      setArrivalAttrMemberId(existingMovement.attributed_to_member_id);
      setArrivalNotes(existingMovement.notes ?? '');
    } else {
      setArrivalEditingMovementId(null);
      setArrivalDescription(t.description);
      setArrivalAmount(String(t.amount));
      setArrivalDate(getDefaultArrivalDate(t));
      setArrivalPayment(t.payment_method);
      setArrivalSourceId(t.payment_source_id);
      setArrivalAttrType(t.attributed_to_type);
      setArrivalAttrMemberId(t.attributed_to_member_id);
      setArrivalNotes('');
    }
    setArrivalError(null);
    setShowArrivalPanel(true);
  };

  /** Mark a template as "לא הגיע" for the selected month.
   *  If there was a previously confirmed movement, it is deleted from DB + local state. */
  const handleMarkSkipped = async (t: RecurringIncome) => {
    if (!user || !accountId) return;
    setMarkingSkippedId(t.id);

    const y  = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const monthStr = `${y}-${String(mo + 1).padStart(2, '0')}-01`;

    // Delete previously linked movement if one exists
    const existingConf = recurringMonthConfirmations.find(c => c.recurring_id === t.id);
    if (existingConf?.movement_id) {
      const { error: deleteError } = await supabase
        .from('financial_movements')
        .delete()
        .eq('id', existingConf.movement_id);
      if (deleteError) {
        setRecurringMonthConfirmationsError('שגיאה במחיקת ההכנסה הקיימת.');
        setMarkingSkippedId(null);
        return;
      }
      setIncomes(prev => prev.filter(m => m.id !== existingConf.movement_id));
    }

    const { data, error: upsertError } = await supabase
      .from('recurring_income_confirmations')
      .upsert(
        { account_id: accountId, recurring_id: t.id, month: monthStr, status: 'skipped', movement_id: null },
        { onConflict: 'recurring_id,month' }
      )
      .select('id, recurring_id, month, status, movement_id')
      .maybeSingle();

    setMarkingSkippedId(null);
    if (upsertError) { setRecurringMonthConfirmationsError('שגיאה בסימון "לא התקבל".'); return; }
    if (!data) return;

    setRecurringMonthConfirmations(prev => {
      const idx = prev.findIndex(c => c.recurring_id === t.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = data as RecurringIncomeConfirmation; return next; }
      return [...prev, data as RecurringIncomeConfirmation];
    });
  };

  /** Save a recurring arrival (insert or update movement + upsert confirmation). */
  const handleSaveRecurringArrival = async () => {
    if (!user || !accountId || !arrivalTemplate) return;
    const rawAmount = parseFloat(arrivalAmount);
    if (!arrivalDescription.trim() || isNaN(rawAmount) || rawAmount <= 0 || !arrivalDate) return;

    setArrivalIsSaving(true);
    setArrivalError(null);

    const y  = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const monthStr = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    const showAttr = isCouple || isFamily;
    const movementPayload = {
      date:                    arrivalDate,
      description:             arrivalDescription.trim(),
      type:                    'income' as const,
      category:                'income',
      sub_category:            arrivalTemplate.income_type || null,
      payment_method:          arrivalPayment,
      payment_source_id:       arrivalSourceId,
      amount:                  Math.abs(rawAmount),
      status:                  'actual' as const,
      source:                  'recurring' as const,
      notes:                   arrivalNotes.trim() || null,
      attributed_to_type:      showAttr ? arrivalAttrType : null,
      attributed_to_member_id: showAttr && arrivalAttrType === 'member' ? arrivalAttrMemberId : null,
      expected_amount:         null,
      recurring_income_id:     arrivalTemplate.id,
    };

    let movementId: string;

    if (arrivalEditingMovementId) {
      // Update existing linked movement
      const { data, error: updateError } = await supabase
        .from('financial_movements')
        .update(movementPayload)
        .eq('id', arrivalEditingMovementId)
        .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
        .single();
      if (updateError) { setArrivalError('שגיאה בעדכון ההכנסה.'); setArrivalIsSaving(false); return; }
      movementId = data.id;
      setIncomes(prev => prev.map(m => m.id === arrivalEditingMovementId ? (data as IncomeMovement) : m));
    } else {
      // Insert new movement
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({ ...movementPayload, user_id: user.id, account_id: accountId })
        .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
        .single();
      if (insertError) { setArrivalError('שגיאה בשמירת ההכנסה.'); setArrivalIsSaving(false); return; }
      movementId = data.id;
      // Set editing ID now so any retry (e.g. after confirmation upsert failure) updates instead of inserting a duplicate
      setArrivalEditingMovementId(data.id);
      setIncomes(prev => [data as IncomeMovement, ...prev]);
    }

    // Upsert confirmation: confirmed + linked movement
    const { data: confData, error: confError } = await supabase
      .from('recurring_income_confirmations')
      .upsert(
        { account_id: accountId, recurring_id: arrivalTemplate.id, month: monthStr, status: 'confirmed', movement_id: movementId },
        { onConflict: 'recurring_id,month' }
      )
      .select('id, recurring_id, month, status, movement_id')
      .maybeSingle();

    setArrivalIsSaving(false);
    if (confError) { setArrivalError('ההכנסה נשמרה אבל לא ניתן לעדכן את סטטוס האישור.'); return; }
    if (confData) {
      setRecurringMonthConfirmations(prev => {
        const idx = prev.findIndex(c => c.recurring_id === arrivalTemplate.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = confData as RecurringIncomeConfirmation; return next; }
        return [...prev, confData as RecurringIncomeConfirmation];
      });
    }

    setShowArrivalPanel(false);
    resetArrivalForm();
  };

  // ── Summary strip computed — always from unfiltered arrays ────────────────
  const totalActual            = incomes.reduce((s, m) => s + m.amount, 0);
  const showAttribution        = isCouple || isFamily;
  const hasAnyExpected         = incomes.some(i => i.expected_amount !== null);
  const totalExpected          = incomes.reduce((s, m) => s + (m.expected_amount ?? 0), 0);
  const hasActiveTemplates     = recurringIncomes.some(t => t.is_active);
  const totalRecurringBaseline = recurringIncomes
    .filter(t => t.is_active)
    .reduce((s, t) => s + t.amount, 0);

  // ── Filter option lists ───────────────────────────────────────────────────
  const attributionFilterOptions = useMemo(() => [
    ...members.map(m => ({ id: m.id, label: m.name, color: m.avatarColor })),
    { id: 'shared', label: 'משותף', color: '#6B7280' },
    { id: '_none_', label: 'ללא שיוך', color: '#9CA3AF' },
  ], [members]);

  const depositFilterOptions = useMemo(() => {
    if (depositSources.length > 0) {
      return depositSources.map(s => ({ id: s.id, label: s.name, color: s.color }));
    }
    return DEPOSIT_FALLBACK_PM.map(pm => ({ id: pm.id, label: pm.name, color: pm.color }));
  }, [depositSources]);

  // ── Section visibility ────────────────────────────────────────────────────
  const showTemplateSection  = filterRowTypes.size === 0 || filterRowTypes.has('קבוע');
  const showMovementsSection = filterRowTypes.size === 0 || filterRowTypes.has('חד-פעמי');
  const monthSelectorDimmed  = filterRowTypes.size === 1 && filterRowTypes.has('קבוע');
  const statusFilterDimmed   = filterRowTypes.size === 1 && filterRowTypes.has('חד-פעמי');

  // ── Filtered arrays (client-side, no re-fetch) ────────────────────────────
  const filteredTemplates = useMemo(() => recurringIncomes.filter(t => {
    if (filterSearch && !t.description.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterIncomeTypes.size > 0 && !filterIncomeTypes.has(t.income_type ?? '_none_')) return false;
    if (filterAttribution.size > 0) {
      const key = t.attributed_to_type === 'shared' ? 'shared'
        : t.attributed_to_type === 'member' && t.attributed_to_member_id ? t.attributed_to_member_id
        : '_none_';
      if (!filterAttribution.has(key)) return false;
    }
    if (filterDeposit.size > 0) {
      const okSrc = t.payment_source_id != null && filterDeposit.has(t.payment_source_id);
      const okMth = filterDeposit.has(t.payment_method);
      if (!okSrc && !okMth) return false;
    }
    if (filterStatus.size > 0 && !filterStatus.has(t.is_active ? 'פעיל' : 'לא פעיל')) return false;
    return true;
  }), [recurringIncomes, filterSearch, filterIncomeTypes, filterAttribution, filterDeposit, filterStatus]);

  const filteredIncomes = useMemo(() => incomes.filter(i => {
    // Recurring-linked arrivals belong to the recurring section only
    // Use loose != null so undefined (column missing pre-migration) is treated same as null
    if (i.recurring_income_id != null) return false;
    if (filterSearch && !i.description.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterIncomeTypes.size > 0 && !filterIncomeTypes.has(i.sub_category ?? '_none_')) return false;
    if (filterAttribution.size > 0) {
      const key = i.attributed_to_type === 'shared' ? 'shared'
        : i.attributed_to_type === 'member' && i.attributed_to_member_id ? i.attributed_to_member_id
        : '_none_';
      if (!filterAttribution.has(key)) return false;
    }
    if (filterDeposit.size > 0) {
      const okSrc = i.payment_source_id != null && filterDeposit.has(i.payment_source_id);
      const okMth = filterDeposit.has(i.payment_method);
      if (!okSrc && !okMth) return false;
    }
    // status filter does NOT apply to actual income rows
    return true;
  }), [incomes, filterSearch, filterIncomeTypes, filterAttribution, filterDeposit]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  const anyFilterActive =
    filterSearch.length > 0 || filterRowTypes.size > 0 || filterIncomeTypes.size > 0 ||
    filterAttribution.size > 0 || filterDeposit.size > 0 || filterStatus.size > 0;

  const clearAllFilters = () => {
    setFilterSearch('');
    setFilterRowTypes(new Set());
    setFilterIncomeTypes(new Set());
    setFilterAttribution(new Set());
    setFilterDeposit(new Set());
    setFilterStatus(new Set());
  };

  // Chip is "active" (highlighted) when set is empty (= show all) OR when value is in set
  const chipActive = (set: Set<string>, value: string) => set.size === 0 || set.has(value);

  // ── Table totals (filtered — for total row only) ──────────────────────────
  const filteredTotalActual   = filteredIncomes.reduce((s, i) => s + i.amount, 0);
  const filteredTotalExpected = filteredIncomes.reduce((s, i) => s + (i.expected_amount ?? i.amount), 0);

  // Columns: תאריך | תיאור | [שיוך] | הופקד | סכום צפוי | סכום בפועל | סטטוס | פעולות
  const COL_COUNT = showAttribution ? 8 : 7;

  // ── Analytics derived computations ───────────────────────────────────────
  const { periodMonths } = useMemo(
    () => getAnalyticsPeriodBounds(currentMonth, analyticsPeriod),
    [currentMonth, analyticsPeriod]
  );

  const analyticsByMonth = useMemo(() =>
    periodMonths.map(({ key, label }) => {
      const rows         = analyticsData.filter(r => r.date.startsWith(key));
      const actual       = rows.reduce((s, r) => s + r.amount, 0);
      const expRows      = rows.filter(r => r.expected_amount !== null);
      const expected     = expRows.reduce((s, r) => s + (r.expected_amount ?? 0), 0);
      return { key, label, actual, expected, hasExpected: expRows.length > 0 };
    }),
  [analyticsData, periodMonths]);

  const analyticsHasData         = analyticsData.length > 0;
  const analyticsHasExpectedData = useMemo(
    () => analyticsData.some(r => r.expected_amount !== null),
    [analyticsData]
  );

  const analyticsAvg = useMemo(() => {
    if (analyticsByMonth.length === 0) return 0;
    return analyticsByMonth.reduce((s, m) => s + m.actual, 0) / analyticsByMonth.length;
  }, [analyticsByMonth]);

  const analyticsPeakMonth = useMemo(() =>
    analyticsByMonth.length === 0 ? null
      : analyticsByMonth.reduce((best, m) => m.actual > best.actual ? m : best),
  [analyticsByMonth]);

  const analyticsLowMonth = useMemo(() =>
    analyticsByMonth.length === 0 ? null
      : analyticsByMonth.reduce((low, m) => m.actual < low.actual ? m : low),
  [analyticsByMonth]);

  const analyticsStabilityPct = useMemo(() => {
    if (!hasActiveTemplates || analyticsAvg === 0) return null;
    return Math.round((totalRecurringBaseline / analyticsAvg) * 100);
  }, [hasActiveTemplates, totalRecurringBaseline, analyticsAvg]);

  const analyticsTypeBreakdown = useMemo(() => {
    if (!analyticsHasData) return [];
    const map = new Map<string, number>();
    analyticsData.forEach(r => {
      const k = r.sub_category ?? 'לא מסווג';
      map.set(k, (map.get(k) ?? 0) + r.amount);
    });
    const total = analyticsData.reduce((s, r) => s + r.amount, 0);
    return Array.from(map.entries())
      .map(([type, amount]) => ({ type, amount, pct: total > 0 ? Math.round(amount / total * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [analyticsData, analyticsHasData]);

  const analyticsAttributionBreakdown = useMemo(() => {
    if (!showAttribution || !analyticsHasData) return [];
    const map = new Map<string, { label: string; color: string; amount: number }>();
    analyticsData.forEach(r => {
      let key: string; let label: string; let color: string;
      if (r.attributed_to_type === 'shared') {
        key = 'shared'; label = 'משותף'; color = '#6B7280';
      } else if (r.attributed_to_type === 'member' && r.attributed_to_member_id) {
        const m = members.find(x => x.id === r.attributed_to_member_id);
        if (m) { key = m.id; label = m.name; color = m.avatarColor; }
        else    { key = '_none_'; label = 'לא שויך'; color = '#9CA3AF'; }
      } else {
        key = '_none_'; label = 'לא שויך'; color = '#9CA3AF';
      }
      const cur = map.get(key);
      if (cur) { cur.amount += r.amount; }
      else { map.set(key, { label, color, amount: r.amount }); }
    });
    const total = analyticsData.reduce((s, r) => s + r.amount, 0);
    return Array.from(map.values())
      .map(v => ({ ...v, pct: total > 0 ? Math.round(v.amount / total * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [analyticsData, analyticsHasData, showAttribution, members]);

  // ── Per-template monthly status for selected month ───────────────────────
  const templateMonthStatuses = useMemo(() => {
    const map = new Map<string, { status: TemplateMonthStatus; confirmedAmount: number | null }>();
    for (const t of recurringIncomes) {
      if (!t.is_active) continue;
      const conf = recurringMonthConfirmations.find(c => c.recurring_id === t.id);
      if (!conf) {
        map.set(t.id, { status: 'מצופה', confirmedAmount: null });
      } else if (conf.status === 'skipped') {
        map.set(t.id, { status: 'לא התקבל', confirmedAmount: null });
      } else {
        const movement = conf.movement_id ? incomes.find(m => m.id === conf.movement_id) : null;
        map.set(t.id, { status: 'התקבל', confirmedAmount: movement?.amount ?? null });
      }
    }
    return map;
  }, [recurringIncomes, recurringMonthConfirmations, incomes]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">הכנסות</h1>
          <div
            className={`relative transition-opacity ${monthSelectorDimmed ? 'opacity-40 pointer-events-none' : ''}`}
            title={monthSelectorDimmed ? 'בחירת חודש לא רלוונטית בתצוגת הכנסות קבועות בלבד' : undefined}
          >
            <MonthSelector />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetRecurringForm(); setShowRecurringPanel(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] border"
            style={{ borderColor: '#1E56A0', color: '#1E56A0' }}
          >
            <span className="font-bold">+</span> הוסף קבועה
          </button>
          <button
            onClick={() => { resetForm(); setShowPanel(true); }}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
          >
            <span className="font-bold">+</span> הוסף הכנסה
          </button>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 mb-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Search + clear */}
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="חיפוש לפי תיאור..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
          />
          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-[10px] transition whitespace-nowrap"
            >
              נקה סינון
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {/* סוג שורה */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 min-w-[56px] shrink-0">סוג שורה</span>
            {(['חד-פעמי', 'קבוע'] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterRowTypes(prev => toggleFilter(prev, v))}
                className="px-3 py-1 rounded-full border text-xs font-semibold transition-all"
                style={chipActive(filterRowTypes, v)
                  ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                  : { borderColor: '#e5e7eb', color: '#9ca3af' }}
              >{v}</button>
            ))}
          </div>

          {/* סוג הכנסה */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 min-w-[56px] shrink-0">סוג הכנסה</span>
            {INCOME_TYPES.map(v => (
              <button
                key={v}
                onClick={() => setFilterIncomeTypes(prev => toggleFilter(prev, v))}
                className="px-3 py-1 rounded-full border text-xs font-semibold transition-all"
                style={chipActive(filterIncomeTypes, v)
                  ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                  : { borderColor: '#e5e7eb', color: '#9ca3af' }}
              >{v}</button>
            ))}
          </div>

          {/* שיוך — couple/family only */}
          {showAttribution && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 min-w-[56px] shrink-0">שיוך</span>
              {attributionFilterOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilterAttribution(prev => toggleFilter(prev, opt.id))}
                  className="px-3 py-1 rounded-full border text-xs font-semibold transition-all"
                  style={chipActive(filterAttribution, opt.id)
                    ? { borderColor: opt.color, backgroundColor: opt.color + '18', color: opt.color }
                    : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                >{opt.label}</button>
              ))}
            </div>
          )}

          {/* הופקד לחשבון */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 min-w-[56px] shrink-0">הופקד</span>
            {depositFilterOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterDeposit(prev => toggleFilter(prev, opt.id))}
                className="px-3 py-1 rounded-full border text-xs font-semibold transition-all"
                style={chipActive(filterDeposit, opt.id)
                  ? { borderColor: opt.color, backgroundColor: opt.color + '18', color: opt.color }
                  : { borderColor: '#e5e7eb', color: '#9ca3af' }}
              >{opt.label}</button>
            ))}
          </div>

          {/* סטטוס — dimmed when movements-only mode */}
          <div className={`flex items-center gap-2 flex-wrap transition-opacity ${statusFilterDimmed ? 'opacity-30 pointer-events-none' : ''}`}>
            <span className="text-[11px] font-semibold text-gray-400 min-w-[56px] shrink-0">סטטוס</span>
            {(['פעיל', 'לא פעיל'] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterStatus(prev => toggleFilter(prev, v))}
                className="px-3 py-1 rounded-full border text-xs font-semibold transition-all"
                style={chipActive(filterStatus, v)
                  ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                  : { borderColor: '#e5e7eb', color: '#9ca3af' }}
              >{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
        >
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}
      {recurringError && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
        >
          <span>⚠️ {recurringError}</span>
          <button onClick={() => setRecurringError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}
      {recurringMonthConfirmationsError && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}
        >
          <span>⚠️ {recurringMonthConfirmationsError}</span>
          <button onClick={() => setRecurringMonthConfirmationsError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* ── Summary strip — always unfiltered ────────────────────────────── */}
      <div className={`grid gap-4 mb-6 ${
        hasAnyExpected && hasActiveTemplates ? 'grid-cols-2 sm:grid-cols-4'
        : (hasAnyExpected || hasActiveTemplates) ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'
      }`}>
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
        {hasAnyExpected && (
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">צפוי vs התקבל</p>
            <p className="text-base font-bold" style={{ color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
              צפוי {formatCurrency(totalExpected)}
            </p>
            <p className="text-base font-bold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
              התקבל {formatCurrency(totalActual)}
            </p>
          </div>
        )}
        {hasActiveTemplates && (
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">בסיס הכנסה קבועה</p>
            <p className="text-2xl font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(totalRecurringBaseline)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">לחודש</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* UNIFIED TABLE — desktop                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden md:block bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[100px]">תאריך / יום</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">תיאור</th>
              {showAttribution && (
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[88px]">שיוך</th>
              )}
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[110px]">הופקד לחשבון</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[100px]">סכום צפוי</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[100px]">סכום בפועל</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 w-[76px]">סטטוס</th>
              <th className="px-4 py-3 w-[160px]" />
            </tr>
          </thead>

          {/* ── Templates tbody ─────────────────────────────────────────── */}
          {showTemplateSection && (
            <tbody>
              <tr>
                <td colSpan={COL_COUNT} className="px-5 py-2 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800">🔁 הכנסות קבועות</span>
                    <button
                      onClick={() => { resetRecurringForm(); setShowRecurringPanel(true); }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition"
                    >
                      + הוסף תבנית
                    </button>
                  </div>
                </td>
              </tr>

              {recurringLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-5 py-6 text-center">
                    <div className="w-5 h-5 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-5 py-6 text-center text-sm text-gray-400">
                    {anyFilterActive
                      ? 'אין תבניות קבועות התואמות את הסינון'
                      : 'אין הכנסות קבועות עדיין — הוסף תבנית ראשונה'}
                  </td>
                </tr>
              ) : (
                filteredTemplates.map(t => {
                  const pm = resolvePaymentDisplay(t.payment_source_id, t.payment_method, paymentSources);
                  const isDeactivating = deactivatingId === t.id;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-gray-50 transition-colors hover:bg-blue-50/30"
                      style={{ opacity: isDeactivating ? 0.5 : t.is_active ? 1 : 0.55 }}
                      onMouseEnter={() => setHoveredRow(t.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* תאריך / יום */}
                      <td className="px-4 py-3.5 text-sm text-gray-400 text-right whitespace-nowrap">
                        {t.expected_day_of_month != null ? `יום ${t.expected_day_of_month}` : '—'}
                      </td>

                      {/* תיאור */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${t.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                            🔁
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${t.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                                {t.description}
                              </span>
                              {t.income_type && (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                  style={{
                                    backgroundColor: t.is_active ? '#E8F0FB' : '#F3F4F6',
                                    color: t.is_active ? '#1E56A0' : '#9CA3AF',
                                  }}
                                >
                                  {t.income_type}
                                </span>
                              )}
                            </div>
                            {t.notes && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{t.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* שיוך */}
                      {showAttribution && (
                        <td className="px-4 py-3.5 text-right">
                          <AttrChip attrType={t.attributed_to_type} memberId={t.attributed_to_member_id} members={members} />
                        </td>
                      )}

                      {/* הופקד לחשבון */}
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: pm.color + '15', color: pm.color }}
                        >
                          {pm.name}
                        </span>
                      </td>

                      {/* סכום צפוי — template: amount / חודש */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span
                          className="text-sm font-bold"
                          style={{ color: t.is_active ? '#1E56A0' : '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatCurrency(t.amount)}
                        </span>
                        <span className="text-[11px] text-gray-400 mr-1">/ חודש</span>
                      </td>

                      {/* סכום בפועל — confirmed arrival amount if exists */}
                      <td className="px-4 py-3.5 text-right">
                        {(() => {
                          const tms = templateMonthStatuses.get(t.id);
                          if (tms?.confirmedAmount != null) {
                            return (
                              <span className="text-sm font-bold" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(tms.confirmedAmount)}
                              </span>
                            );
                          }
                          return <span className="text-sm text-gray-400">—</span>;
                        })()}
                      </td>

                      {/* סטטוס — TemplateMonthStatus for active, לא פעיל for inactive */}
                      <td className="px-4 py-3.5 text-right">
                        {t.is_active ? (() => {
                          const tms = templateMonthStatuses.get(t.id);
                          const status: TemplateMonthStatus = tms?.status ?? 'מצופה';
                          const styleMap: Record<TemplateMonthStatus, React.CSSProperties> = {
                            'מצופה':     { backgroundColor: '#FEF3C7', color: '#D97706' },
                            'התקבל':     { backgroundColor: '#D1FAE5', color: '#059669' },
                            'לא התקבל': { backgroundColor: '#FEE2E2', color: '#DC2626' },
                          };
                          return (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={styleMap[status]}>
                              {status}
                            </span>
                          );
                        })() : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>
                            לא פעיל
                          </span>
                        )}
                      </td>

                      {/* פעולות */}
                      <td className="px-4 py-3.5">
                        <div className={`flex items-center gap-1 flex-wrap transition-opacity duration-150 ${hoveredRow === t.id ? 'opacity-100' : 'opacity-0'}`}>
                          <button
                            onClick={() => handleEditTemplate(t)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                            title="עריכת תבנית"
                          >✏️</button>
                          {t.is_active && (() => {
                            const tms = templateMonthStatuses.get(t.id);
                            const status: TemplateMonthStatus = tms?.status ?? 'מצופה';
                            if (status === 'התקבל') {
                              return (
                                <button
                                  onClick={() => handleOpenArrival(t)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                                  style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                                  title="ערוך"
                                >ערוך</button>
                              );
                            }
                            return (
                              <>
                                <button
                                  onClick={() => handleOpenArrival(t)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                                  style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                                  title="התקבל"
                                >התקבל</button>
                                {status !== 'לא התקבל' && (
                                  <button
                                    onClick={() => handleMarkSkipped(t)}
                                    disabled={markingSkippedId === t.id}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                                    title="לא התקבל החודש"
                                  >לא התקבל</button>
                                )}
                              </>
                            );
                          })()}
                          <button
                            onClick={() => handleToggleActive(t.id, t.is_active)}
                            disabled={isDeactivating}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                            title={t.is_active ? 'השהה' : 'הפעל'}
                          >
                            {t.is_active ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            disabled={deletingTemplateId === t.id}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            title="מחק תבנית"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          )}

          {/* ── Actuals tbody ────────────────────────────────────────────── */}
          {showMovementsSection && (
            <tbody>
              {/* Section header — only when both sections are visible */}
              {showTemplateSection && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-5 py-2 bg-green-50 border-b border-green-100">
                    <span className="text-xs font-semibold text-green-800">💰 הכנסות בפועל</span>
                  </td>
                </tr>
              )}

              {isLoading ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-5 py-10 text-center">
                    <div className="w-8 h-8 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">טוען הכנסות...</p>
                  </td>
                </tr>
              ) : filteredIncomes.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-5 py-10 text-center">
                    <p className="text-gray-400 text-sm mb-3">
                      {anyFilterActive ? 'לא נמצאו הכנסות התואמות את הסינון' : 'אין הכנסות לחודש זה'}
                    </p>
                    {!anyFilterActive && (
                      <button
                        onClick={() => { resetForm(); setShowPanel(true); }}
                        className="px-5 py-2 text-white rounded-[10px] font-semibold text-sm hover:opacity-90"
                        style={{ backgroundColor: '#1E56A0' }}
                      >
                        הוסף הכנסה ראשונה
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredIncomes.map((income, i) => {
                    const pm = resolvePaymentDisplay(income.payment_source_id, income.payment_method, paymentSources);
                    const isDeleting = deletingId === income.id;
                    // Two-column amount model (locked):
                    // expected_amount = null  → both cols = amount
                    // expected_amount ≠ null  → צפוי = expected_amount, בפועל = amount
                    const expectedCol = income.expected_amount ?? income.amount;
                    const actualCol   = income.amount;
                    return (
                      <tr
                        key={income.id}
                        className="border-b border-gray-50 transition-colors"
                        style={{
                          backgroundColor: isDeleting ? '#fff5f5'
                            : hoveredRow === income.id ? '#f0f6ff'
                            : i % 2 === 0 ? '#fff' : '#f9fafb',
                          opacity: isDeleting ? 0.5 : 1,
                        }}
                        onMouseEnter={() => setHoveredRow(income.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        {/* תאריך */}
                        <td className="px-4 py-3.5 text-sm text-gray-500 text-right whitespace-nowrap">
                          {formatDate(income.date)}
                        </td>

                        {/* תיאור */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                              💰
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{income.description}</span>
                                {income.sub_category && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                    style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
                                  >
                                    {income.sub_category}
                                  </span>
                                )}
                              </div>
                              {income.notes && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{income.notes}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* שיוך */}
                        {showAttribution && (
                          <td className="px-4 py-3.5 text-right">
                            <AttrChip
                              attrType={income.attributed_to_type}
                              memberId={income.attributed_to_member_id}
                              members={members}
                            />
                          </td>
                        )}

                        {/* הופקד לחשבון */}
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: pm.color + '15', color: pm.color }}
                          >
                            {pm.name}
                          </span>
                        </td>

                        {/* סכום צפוי */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span
                            className="text-sm font-bold"
                            style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatCurrency(expectedCol)}
                          </span>
                        </td>

                        {/* סכום בפועל */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span
                            className="text-sm font-bold"
                            style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}
                          >
                            +{formatCurrency(actualCol)}
                          </span>
                        </td>

                        {/* סטטוס — not applicable for actual rows */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm text-gray-300">—</span>
                        </td>

                        {/* פעולות */}
                        <td className="px-4 py-3.5">
                          <div className={`flex items-center gap-1 transition-opacity duration-150 ${hoveredRow === income.id ? 'opacity-100' : 'opacity-0'}`}>
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
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td
                      className="px-4 py-3.5 text-sm font-bold text-gray-700 text-right"
                      colSpan={showAttribution ? 4 : 3}
                    >
                      סה״כ ({filteredIncomes.length} תנועות)
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-right whitespace-nowrap"
                      style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(filteredTotalExpected)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-right whitespace-nowrap"
                      style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
                      +{formatCurrency(filteredTotalActual)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          )}
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE SECTIONS                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden space-y-5">

        {/* ── Templates section ──────────────────────────────────────────── */}
        {showTemplateSection && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <span>🔁</span> הכנסות קבועות
              </h3>
              <button
                onClick={() => { resetRecurringForm(); setShowRecurringPanel(true); }}
                className="text-xs font-semibold hover:opacity-80 transition"
                style={{ color: '#1E56A0' }}
              >
                + הוסף תבנית
              </button>
            </div>

            {recurringLoading ? (
              <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="w-5 h-5 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-3xl mb-2">🔁</p>
                <p className="text-gray-500 font-medium mb-3 text-sm">
                  {anyFilterActive ? 'אין תבניות התואמות את הסינון' : 'אין הכנסות קבועות עדיין'}
                </p>
                {!anyFilterActive && (
                  <button
                    onClick={() => { resetRecurringForm(); setShowRecurringPanel(true); }}
                    className="px-4 py-2 text-white rounded-[10px] font-semibold text-sm hover:opacity-90"
                    style={{ backgroundColor: '#1E56A0' }}
                  >
                    הוסף הכנסה קבועה ראשונה
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map(t => {
                  const pm = resolvePaymentDisplay(t.payment_source_id, t.payment_method, paymentSources);
                  const isDeactivating = deactivatingId === t.id;
                  return (
                    <div
                      key={t.id}
                      className="bg-white rounded-2xl p-4 flex items-start gap-3"
                      style={{
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        opacity: isDeactivating ? 0.5 : t.is_active ? 1 : 0.55,
                      }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${t.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                        🔁
                      </div>
                      <div className="flex-1 min-w-0">
                        {t.income_type && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mb-1"
                            style={{
                              backgroundColor: t.is_active ? '#E8F0FB' : '#F3F4F6',
                              color: t.is_active ? '#1E56A0' : '#9CA3AF',
                            }}
                          >{t.income_type}</span>
                        )}
                        <p className={`text-sm font-semibold truncate ${t.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                          {t.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {t.expected_day_of_month != null && (
                            <span className="text-xs text-gray-400">יום {t.expected_day_of_month}</span>
                          )}
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: pm.color + '15', color: pm.color }}
                          >{pm.name}</span>
                          {showAttribution && t.attributed_to_type && (
                            <AttrChip attrType={t.attributed_to_type} memberId={t.attributed_to_member_id} members={members} />
                          )}
                          {t.is_active ? (() => {
                            const tms = templateMonthStatuses.get(t.id);
                            const status: TemplateMonthStatus = tms?.status ?? 'מצופה';
                            const styleMap: Record<TemplateMonthStatus, React.CSSProperties> = {
                              'מצופה':     { backgroundColor: '#FEF3C7', color: '#D97706' },
                              'התקבל':     { backgroundColor: '#D1FAE5', color: '#059669' },
                              'לא התקבל': { backgroundColor: '#FEE2E2', color: '#DC2626' },
                            };
                            return (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={styleMap[status]}>
                                {status}
                              </span>
                            );
                          })() : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">לא פעיל</span>
                          )}
                        </div>
                        {t.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{t.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-left">
                          <p className="text-[10px] text-gray-400 mb-0.5">צפוי</p>
                          <span
                            className="text-sm font-bold"
                            style={{ color: t.is_active ? '#1E56A0' : '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatCurrency(t.amount)}
                          </span>
                          <span className="text-[11px] text-gray-400 mr-1">/ חודש</span>
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] text-gray-400 mb-0.5">בפועל</p>
                          {(() => {
                            const tms = templateMonthStatuses.get(t.id);
                            if (tms?.confirmedAmount != null) {
                              return (
                                <span className="text-sm font-bold" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatCurrency(tms.confirmedAmount)}
                                </span>
                              );
                            }
                            return <span className="text-sm text-gray-400">—</span>;
                          })()}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => handleEditTemplate(t)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs"
                            title="עריכת תבנית"
                          >✏️</button>
                          <button
                            onClick={() => handleToggleActive(t.id, t.is_active)}
                            disabled={isDeactivating}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs disabled:cursor-not-allowed"
                            title={t.is_active ? 'השהה' : 'הפעל'}
                          >{t.is_active ? '⏸️' : '▶️'}</button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            disabled={deletingTemplateId === t.id}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            title="מחק תבנית"
                          >🗑️</button>
                        </div>
                        {t.is_active && (() => {
                          const tms = templateMonthStatuses.get(t.id);
                          const status: TemplateMonthStatus = tms?.status ?? 'מצופה';
                          if (status === 'התקבל') {
                            return (
                              <button
                                onClick={() => handleOpenArrival(t)}
                                className="mt-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                              >ערוך</button>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <button
                                onClick={() => handleOpenArrival(t)}
                                className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
                              >התקבל</button>
                              {status !== 'לא התקבל' && (
                                <button
                                  onClick={() => handleMarkSkipped(t)}
                                  disabled={markingSkippedId === t.id}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                                >לא התקבל</button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Actuals section ────────────────────────────────────────────── */}
        {showMovementsSection && (
          <div>
            {showTemplateSection && (
              <div className="flex items-center gap-1.5 mb-3">
                <span>💰</span>
                <h3 className="text-sm font-bold text-gray-700">הכנסות בפועל</h3>
              </div>
            )}

            {isLoading ? (
              <div className="bg-white rounded-2xl p-10 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="w-7 h-7 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">טוען הכנסות...</p>
              </div>
            ) : filteredIncomes.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-3xl mb-2">💰</p>
                <p className="text-gray-500 font-medium mb-3 text-sm">
                  {anyFilterActive ? 'לא נמצאו הכנסות התואמות את הסינון' : 'אין הכנסות לחודש זה'}
                </p>
                {!anyFilterActive && (
                  <button
                    onClick={() => { resetForm(); setShowPanel(true); }}
                    className="px-5 py-2 text-white rounded-[10px] font-semibold text-sm hover:opacity-90"
                    style={{ backgroundColor: '#1E56A0' }}
                  >
                    הוסף הכנסה ראשונה
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIncomes.map(income => {
                  const pm = resolvePaymentDisplay(income.payment_source_id, income.payment_method, paymentSources);
                  const expectedCol = income.expected_amount ?? income.amount;
                  const actualCol   = income.amount;
                  return (
                    <div
                      key={income.id}
                      className="bg-white rounded-2xl p-4 flex items-start gap-3"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: deletingId === income.id ? 0.5 : 1 }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg flex-shrink-0">💰</div>
                      <div className="flex-1 min-w-0">
                        {income.sub_category && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mb-1"
                            style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}
                          >{income.sub_category}</span>
                        )}
                        <p className="text-sm font-semibold text-gray-900 truncate">{income.description}</p>
                        {income.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{income.notes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">{formatDate(income.date)}</span>
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: pm.color + '15', color: pm.color }}
                          >{pm.name}</span>
                          {showAttribution && income.attributed_to_type && (
                            <AttrChip attrType={income.attributed_to_type} memberId={income.attributed_to_member_id} members={members} />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-left">
                          <p className="text-[10px] text-gray-400 mb-0.5">צפוי</p>
                          <span
                            className="text-sm font-bold"
                            style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatCurrency(expectedCol)}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] text-gray-400 mb-0.5">בפועל</p>
                          <span
                            className="text-sm font-bold"
                            style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}
                          >
                            +{formatCurrency(actualCol)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ADD / EDIT INCOME PANEL                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowPanel(false); resetForm(); }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}
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
                {/* 1. Income type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סוג הכנסה</label>
                  <div className="flex flex-wrap gap-2">
                    {INCOME_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setTxIncomeType(type)}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txIncomeType === type
                          ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >{type}</button>
                    ))}
                  </div>
                </div>

                {/* 2. Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input
                    value={txDescription}
                    onChange={e => setTxDescription(e.target.value)}
                    placeholder="למשל: משכורת חודשית"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
                  />
                </div>

                {/* 3. Expected amount (primary, required) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום צפוי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={txExpectedAmount}
                      onChange={e => setTxExpectedAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                {/* 3b. Actual amount (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום בפועל <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-[10px] text-base text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">אם התקבל סכום שונה מהצפוי, יוצג בטבלה לצד הצפוי</p>
                </div>

                {/* 4. Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                {/* 5. Attribution (couple/family only) */}
                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setTxAttrType('shared'); setTxAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txAttrType === 'shared'
                          ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >משותף</button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setTxAttrType('member'); setTxAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txAttrType === 'member' && txAttrMemberId === m.id
                            ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{m.name}</button>
                      ))}
                      {txAttrType !== null && (
                        <button
                          onClick={() => { setTxAttrType(null); setTxAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}
                        >ללא שיוך</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. הופקד לחשבון */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הופקד לחשבון</label>
                  <div className="flex flex-wrap gap-2">
                    {depositSources.length > 0 ? (
                      depositSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setTxSourceId(src.id); setTxPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txSourceId === src.id
                            ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => { setTxPayment(pm.id); setTxSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txPayment === pm.id && !txSourceId
                            ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                {/* 7. Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
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
                  disabled={isSaving || !txDescription.trim() || !txExpectedAmount}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RECURRING TEMPLATE PANEL                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showRecurringPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowRecurringPanel(false); resetRecurringForm(); }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTemplate ? 'עריכת הכנסה קבועה' : 'הוספת הכנסה קבועה'}
                </h2>
                <button
                  onClick={() => { setShowRecurringPanel(false); resetRecurringForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                >✕</button>
              </div>

              <div className="space-y-4">
                {/* 1. Income type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סוג הכנסה</label>
                  <div className="flex flex-wrap gap-2">
                    {INCOME_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setRtIncomeType(type)}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={rtIncomeType === type
                          ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >{type}</button>
                    ))}
                  </div>
                </div>

                {/* 2. Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input
                    value={rtDescription}
                    onChange={e => setRtDescription(e.target.value)}
                    placeholder="למשל: משכורת חודשית"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
                  />
                </div>

                {/* 3. Monthly amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום חודשי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={rtAmount}
                      onChange={e => setRtAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                {/* 4. Expected day of month */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    יום צפוי בחודש <span className="font-normal text-gray-400">(אופציונלי)</span>
                  </label>
                  <input
                    type="number"
                    value={rtExpectedDay}
                    onChange={e => setRtExpectedDay(e.target.value)}
                    placeholder="1–31"
                    min={1}
                    max={31}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                {/* 5. Attribution (couple/family only) */}
                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setRtAttrType('shared'); setRtAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={rtAttrType === 'shared'
                          ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >משותף</button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setRtAttrType('member'); setRtAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtAttrType === 'member' && rtAttrMemberId === m.id
                            ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{m.name}</button>
                      ))}
                      {rtAttrType !== null && (
                        <button
                          onClick={() => { setRtAttrType(null); setRtAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}
                        >ללא שיוך</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. הופקד לחשבון */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הופקד לחשבון</label>
                  <div className="flex flex-wrap gap-2">
                    {depositSources.length > 0 ? (
                      depositSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setRtSourceId(src.id); setRtPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtSourceId === src.id
                            ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => { setRtPayment(pm.id); setRtSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtPayment === pm.id && !rtSourceId
                            ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                {/* 7. Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <textarea
                    value={rtNotes}
                    onChange={e => setRtNotes(e.target.value)}
                    rows={2}
                    placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                <button
                  onClick={handleSaveTemplate}
                  disabled={recurringIsSaving || !rtDescription.trim() || !rtAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
                >
                  {recurringIsSaving ? 'שומר...' : editingTemplate ? 'עדכן הכנסה קבועה' : 'שמור הכנסה קבועה'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RECURRING ARRIVAL PANEL (Phase 3)                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showArrivalPanel && arrivalTemplate && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setShowArrivalPanel(false); resetArrivalForm(); }}
          />
          <div
            className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white"
            style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {arrivalEditingMovementId ? 'עריכת הכנסה' : 'רישום הכנסה'}
                </h2>
                <button
                  onClick={() => { setShowArrivalPanel(false); resetArrivalForm(); }}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                >✕</button>
              </div>

              {/* Template context pill */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl" style={{ backgroundColor: '#E8F0FB' }}>
                <span className="text-base">🔁</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-blue-900">{arrivalTemplate.description}</span>
                  {arrivalTemplate.income_type && (
                    <span className="text-[10px] text-blue-700 mr-1.5">{arrivalTemplate.income_type}</span>
                  )}
                </div>
                <span className="text-xs font-bold text-blue-800 mr-auto" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(arrivalTemplate.amount)} / חודש
                </span>
              </div>

              {arrivalError && (
                <div className="px-4 py-2.5 rounded-xl text-sm font-semibold mb-4"
                  style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                  ⚠️ {arrivalError}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input
                    value={arrivalDescription}
                    onChange={e => setArrivalDescription(e.target.value)}
                    placeholder="תיאור"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition"
                  />
                </div>

                {/* 2. Actual amount (required) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום בפועל</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input
                      type="number"
                      value={arrivalAmount}
                      onChange={e => setArrivalAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>

                {/* 3. Date received */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={e => setArrivalDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                {/* 4. Attribution (couple/family only) */}
                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setArrivalAttrType('shared'); setArrivalAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={arrivalAttrType === 'shared'
                          ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >משותף</button>
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setArrivalAttrType('member'); setArrivalAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalAttrType === 'member' && arrivalAttrMemberId === m.id
                            ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{m.name}</button>
                      ))}
                      {arrivalAttrType !== null && (
                        <button
                          onClick={() => { setArrivalAttrType(null); setArrivalAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}
                        >ללא שיוך</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. הופקד לחשבון */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הופקד לחשבון</label>
                  <div className="flex flex-wrap gap-2">
                    {depositSources.length > 0 ? (
                      depositSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setArrivalSourceId(src.id); setArrivalPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalSourceId === src.id
                            ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => { setArrivalPayment(pm.id); setArrivalSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalPayment === pm.id && !arrivalSourceId
                            ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }}
                        >{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                {/* 6. Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <textarea
                    value={arrivalNotes}
                    onChange={e => setArrivalNotes(e.target.value)}
                    rows={2}
                    placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>

                <button
                  onClick={handleSaveRecurringArrival}
                  disabled={arrivalIsSaving || !arrivalDescription.trim() || !arrivalAmount || !arrivalDate}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.25)' }}
                >
                  {arrivalIsSaving ? 'שומר...' : arrivalEditingMovementId ? 'עדכן' : 'אישור התקבלות'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ANALYTICS SECTION                                                 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-8">
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: '#1E56A0' }} />
            <h2 className="text-lg font-bold text-gray-900">ניתוח הכנסות</h2>
          </div>
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {ANALYTICS_PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setAnalyticsPeriod(opt.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={analyticsPeriod === opt.id
                  ? { backgroundColor: '#fff', color: '#1E56A0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#6B7280' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="w-7 h-7 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">טוען ניתוח...</p>
          </div>
        ) : analyticsError ? (
          <div className="px-5 py-3 rounded-xl text-sm font-semibold mb-4"
            style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
            ⚠️ {analyticsError}
          </div>
        ) : !analyticsHasData ? (
          <p className="text-sm text-gray-400 text-center py-6">הוסף הכנסות כדי לראות ניתוח</p>
        ) : (
          <div className="space-y-5">

            {/* ── KPI strip ──────────────────────────────────────────────── */}
            <div className={`grid gap-4 ${analyticsStabilityPct !== null ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {/* ממוצע חודשי */}
              <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-xs text-gray-500 font-medium mb-1">ממוצע חודשי</p>
                <p className="text-2xl font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(Math.round(analyticsAvg))}
                </p>
              </div>
              {/* חודש שיא */}
              <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-xs text-gray-500 font-medium mb-1">חודש שיא</p>
                <p className="text-base font-bold text-gray-400">{analyticsPeakMonth?.label ?? '—'}</p>
                <p className="text-lg font-extrabold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
                  {analyticsPeakMonth ? formatCurrency(analyticsPeakMonth.actual) : '—'}
                </p>
              </div>
              {/* חודש שפל */}
              <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-xs text-gray-500 font-medium mb-1">חודש שפל</p>
                <p className="text-base font-bold text-gray-400">{analyticsLowMonth?.label ?? '—'}</p>
                <p className="text-lg font-extrabold" style={{ color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                  {analyticsLowMonth ? formatCurrency(analyticsLowMonth.actual) : '—'}
                </p>
              </div>
              {/* יציבות הכנסה — only when active templates exist */}
              {analyticsStabilityPct !== null && (
                <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <p className="text-xs text-gray-500 font-medium mb-1">יציבות הכנסה</p>
                  <p className="text-2xl font-extrabold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>
                    {analyticsStabilityPct}%
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">מבסיס קבוע</p>
                </div>
              )}
            </div>

            {/* ── Chart 1: Monthly actual income bar chart ────────────────── */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <p className="text-sm font-bold text-gray-700 mb-4">הכנסה חודשית בפועל</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analyticsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
                    width={36}
                  />
                  <Tooltip
                    formatter={(value: unknown, name?: string | number) => [typeof value === 'number' ? formatCurrency(value) : '—', name === 'actual' ? 'בפועל' : String(name ?? '')] as [string, string]}
                    labelStyle={{ fontFamily: 'inherit', fontSize: 12 }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                  />
                  <Bar dataKey="actual" fill="#00A86B" radius={[4, 4, 0, 0]} name="actual" />
                  {hasActiveTemplates && (
                    <ReferenceLine
                      y={totalRecurringBaseline}
                      stroke="#1E56A0"
                      strokeDasharray="5 3"
                      label={{ value: 'בסיס קבוע', position: 'insideTopRight', fontSize: 10, fill: '#1E56A0' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
              {hasActiveTemplates && (
                <p className="text-[11px] text-gray-400 mt-2 text-center">
                  קו מקווקו = בסיס הכנסה קבועה ({formatCurrency(totalRecurringBaseline)} / חודש)
                </p>
              )}
            </div>

            {/* ── Chart 2: Expected vs actual — only when expected data exists ── */}
            {analyticsHasExpectedData && (
              <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-sm font-bold text-gray-700 mb-4">צפוי מול בפועל</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analyticsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
                      width={36}
                    />
                    <Tooltip
                      formatter={(value: unknown, name?: string | number) => [
                        typeof value === 'number' ? formatCurrency(value) : '—',
                        name === 'expected' ? 'צפוי' : 'בפועל',
                      ] as [string, string]}
                      labelStyle={{ fontFamily: 'inherit', fontSize: 12 }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                    />
                    <Bar dataKey="expected" fill="#93C5FD" radius={[4, 4, 0, 0]} name="expected" />
                    <Bar dataKey="actual"   fill="#00A86B" radius={[4, 4, 0, 0]} name="actual" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#93C5FD' }} />
                    <span className="text-[11px] text-gray-500">צפוי</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#00A86B' }} />
                    <span className="text-[11px] text-gray-500">בפועל</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Chart 3: Income type breakdown ──────────────────────────── */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <p className="text-sm font-bold text-gray-700 mb-4">הרכב לפי סוג הכנסה</p>
              <div className="space-y-3">
                {analyticsTypeBreakdown.map(({ type, amount, pct }) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-700">{type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{pct}%</span>
                        <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: '#1E56A0' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Chart 4: Attribution breakdown — couple/family only ──────── */}
            {showAttribution && (
              <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <p className="text-sm font-bold text-gray-700 mb-4">הרכב לפי שיוך</p>
                {analyticsAttributionBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">לא הוגדר שיוך להכנסות בתקופה זו</p>
                ) : (
                  <div className="space-y-3">
                    {analyticsAttributionBreakdown.map(({ label, color, amount, pct }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-sm font-semibold text-gray-700">{label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">{pct}%</span>
                            <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default IncomesPage;
