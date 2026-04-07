import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency, formatDate, formatDateNumeric } from '../lib/formatters';
import MonthSelector from '../components/MonthSelector';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { useMonth } from '../context/MonthContext';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, resolvePaymentDisplay, SOURCE_TYPE_TO_PM } from '../lib/paymentMethods';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
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

const PIE_COLORS = ['#1E56A0', '#00A86B', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#6B7280'];

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

/** Unified table row — either a recurring template or an income movement */
type UnifiedRow =
  | { kind: 'template'; id: string; data: RecurringIncome }
  | { kind: 'movement'; id: string; data: IncomeMovement };

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
  const [filterIncomeTypes, setFilterIncomeTypes] = useState<Set<string>>(new Set());
  const [filterAttribution, setFilterAttribution] = useState<Set<string>>(new Set());
  const [filterNature,      setFilterNature]      = useState<Set<string>>(new Set());
  const [filterStatus,      setFilterStatus]      = useState<Set<string>>(new Set());

  // ── Filter panel + choice drawer + inactive toggle + analytics collapse ───
  const [showFilterPanel,       setShowFilterPanel]       = useState(false);
  const [showChoiceDrawer,      setShowChoiceDrawer]      = useState(false);
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false);
  // Analytics always visible — no toggle state needed

  // ── Income nature (for panel UX) + back-nav from panel to choice ─────────
  const [txNature,                   setTxNature]                   = useState<'חד-פעמית' | 'משתנה'>('חד-פעמית');
  const [panelFromChoice,            setPanelFromChoice]            = useState(false);
  const [recurringPanelFromChoice,   setRecurringPanelFromChoice]   = useState(false);

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

    const { data, error: fetchError } = await supabase
      .from('financial_movements')
      .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
      .eq('type', 'income')
      .eq('account_id', accountId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (fetchError) {
      if (fetchError.code === '42703') {
        // expected_amount / recurring_income_id columns not yet added — migrations pending.
        const { data: fallback, error: fallbackError } = await supabase
          .from('financial_movements')
          .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id')
          .eq('type', 'income')
          .eq('account_id', accountId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });
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
    setTxNature('חד-פעמית');
    setPanelFromChoice(false);
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
    setRecurringPanelFromChoice(false);
  };

  // ── Open edit panel ───────────────────────────────────────────────────────
  const handleEdit = (income: IncomeMovement) => {
    setPanelFromChoice(false);
    setEditingIncome(income);
    setTxDescription(income.description);
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

  /** Mark a template as "לא הגיע" for the selected month. */
  const handleMarkSkipped = async (t: RecurringIncome) => {
    if (!user || !accountId) return;
    setMarkingSkippedId(t.id);

    const y  = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const monthStr = `${y}-${String(mo + 1).padStart(2, '0')}-01`;

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
      const { data, error: insertError } = await supabase
        .from('financial_movements')
        .insert({ ...movementPayload, user_id: user.id, account_id: accountId })
        .select('id, date, description, sub_category, payment_method, payment_source_id, amount, notes, attributed_to_type, attributed_to_member_id, expected_amount, recurring_income_id')
        .single();
      if (insertError) { setArrivalError('שגיאה בשמירת ההכנסה.'); setArrivalIsSaving(false); return; }
      movementId = data.id;
      setArrivalEditingMovementId(data.id);
      setIncomes(prev => [data as IncomeMovement, ...prev]);
    }

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

  // ── Derived values ────────────────────────────────────────────────────────
  const totalActual     = incomes.reduce((s, m) => s + m.amount, 0);
  const showAttribution = isCouple || isFamily;

  // Summary strip computations (always from unfiltered data)
  // Expected = active template amounts + unlinked movement expected amounts
  const totalExpectedMonthly = useMemo(() => {
    const templateTotal = recurringIncomes
      .filter(t => t.is_active)
      .reduce((s, t) => s + t.amount, 0);
    const movementTotal = incomes
      .filter(m => m.recurring_income_id == null)
      .reduce((s, m) => s + (m.expected_amount ?? m.amount), 0);
    return templateTotal + movementTotal;
  }, [recurringIncomes, incomes]);
  const gapMonthly = totalExpectedMonthly - totalActual;

  // Pie chart data by income type for summary strip
  const pieTypeData = useMemo(() => {
    if (!incomes.length) return [];
    const map = new Map<string, number>();
    incomes.forEach(m => {
      const k = m.sub_category ?? 'אחר';
      map.set(k, (map.get(k) ?? 0) + m.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incomes]);

  // ── Filter option lists ───────────────────────────────────────────────────
  const attributionFilterOptions = useMemo(() => [
    ...members.map(m => ({ id: m.id, label: m.name, color: m.avatarColor })),
    { id: 'shared', label: 'משותף', color: '#6B7280' },
    { id: '_none_', label: 'ללא שיוך', color: '#9CA3AF' },
  ], [members]);

  // ── Clear all filters ─────────────────────────────────────────────────────
  const clearAllFilters = () => {
    setFilterSearch('');
    setFilterIncomeTypes(new Set());
    setFilterAttribution(new Set());
    setFilterNature(new Set());
    setFilterStatus(new Set());
  };

  // Active filter count for badge
  const activeFilterCount = [
    filterSearch.length > 0 ? 1 : 0,
    filterIncomeTypes.size > 0 ? 1 : 0,
    filterAttribution.size > 0 ? 1 : 0,
    filterNature.size > 0 ? 1 : 0,
    filterStatus.size > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Chip active helper
  const chipActive = (set: Set<string>, value: string) => set.size === 0 || set.has(value);

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

  // ── Unified filtered rows ────────────────────────────────────────────────
  const filteredUnifiedRows = useMemo((): UnifiedRow[] => {
    const search = filterSearch.toLowerCase();
    const showTemplates = filterNature.size === 0 || filterNature.has('קבועה');
    const showMovements = filterNature.size === 0 || filterNature.has('חד-פעמית') || filterNature.has('משתנה');
    const rows: UnifiedRow[] = [];

    // Templates
    if (showTemplates) {
      for (const t of recurringIncomes) {
        if (!t.is_active && !showInactiveTemplates) continue;
        if (search && !t.description.toLowerCase().includes(search)) continue;
        if (filterIncomeTypes.size > 0 && !filterIncomeTypes.has(t.income_type ?? '_none_')) continue;
        if (filterAttribution.size > 0) {
          const key = t.attributed_to_type === 'shared' ? 'shared'
            : t.attributed_to_type === 'member' && t.attributed_to_member_id ? t.attributed_to_member_id
            : '_none_';
          if (!filterAttribution.has(key)) continue;
        }
        if (filterStatus.size > 0) {
          const tms = templateMonthStatuses.get(t.id);
          const s = !t.is_active ? 'לא פעיל' : tms?.status ?? 'מצופה';
          if (!filterStatus.has(s)) continue;
        }
        rows.push({ kind: 'template', id: t.id, data: t });
      }
    }

    // Movements (unlinked only — recurring arrivals are represented by their template row)
    if (showMovements) {
      for (const m of incomes) {
        if (m.recurring_income_id != null) continue;
        if (search && !m.description.toLowerCase().includes(search)) continue;
        if (filterIncomeTypes.size > 0 && !filterIncomeTypes.has(m.sub_category ?? '_none_')) continue;
        if (filterAttribution.size > 0) {
          const key = m.attributed_to_type === 'shared' ? 'shared'
            : m.attributed_to_type === 'member' && m.attributed_to_member_id ? m.attributed_to_member_id
            : '_none_';
          if (!filterAttribution.has(key)) continue;
        }
        if (filterStatus.size > 0 && !filterStatus.has('התקבל')) continue;
        // Finer nature filter: distinguish חד-פעמית (no expected_amount) from משתנה (has expected_amount)
        if (filterNature.size > 0 && (filterNature.has('חד-פעמית') || filterNature.has('משתנה'))) {
          const nature = m.expected_amount != null ? 'משתנה' : 'חד-פעמית';
          if (!filterNature.has(nature)) continue;
        }
        rows.push({ kind: 'movement', id: m.id, data: m });
      }
    }

    return rows;
  }, [recurringIncomes, incomes, filterSearch, filterIncomeTypes, filterAttribution,
      filterNature, filterStatus, showInactiveTemplates, templateMonthStatuses]);

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

  // ── Data-driven insights for current month ────────────────────────────────
  const insights = useMemo((): { icon: string; text: string; color: string }[] => {
    const list: { icon: string; text: string; color: string }[] = [];
    // 1. Realization rate
    if (totalExpectedMonthly > 0) {
      const rate = totalActual / totalExpectedMonthly;
      const pct = Math.round(rate * 100);
      if (rate >= 1) {
        list.push({ icon: '✓', text: `מומש ${pct}% מהצפוי`, color: '#059669' });
      } else if (rate >= 0.8) {
        list.push({ icon: '~', text: `מומש ${pct}% — ${formatCurrency(Math.abs(gapMonthly))} חסרים`, color: '#D97706' });
      } else if (rate > 0) {
        list.push({ icon: '!', text: `מומש ${pct}% בלבד — פער של ${formatCurrency(Math.abs(gapMonthly))}`, color: '#DC2626' });
      } else {
        list.push({ icon: '○', text: `טרם הגיעה הכנסה — צפוי ${formatCurrency(totalExpectedMonthly)}`, color: '#9CA3AF' });
      }
    }
    // 2. Income concentration
    if (pieTypeData.length > 0 && totalActual > 0) {
      const top = pieTypeData[0];
      const pct = Math.round((top.value / totalActual) * 100);
      if (pct >= 80) {
        list.push({ icon: '⚑', text: `${pct}% מ"${top.name}" — תלות גבוהה`, color: '#D97706' });
      } else if (pieTypeData.length >= 3) {
        list.push({ icon: '✦', text: `הכנסות מ-${pieTypeData.length} מקורות`, color: '#1E56A0' });
      }
    }
    // 3. Trend vs previous month (from analyticsData)
    if (analyticsData.length > 0) {
      const cur  = currentMonth;
      const curKey  = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
      const prevKey  = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const curTotal  = analyticsData.filter(r => r.date.startsWith(curKey)).reduce((s, r) => s + r.amount, 0);
      const prevTotal = analyticsData.filter(r => r.date.startsWith(prevKey)).reduce((s, r) => s + r.amount, 0);
      if (prevTotal > 0 && curTotal > 0) {
        const diff = curTotal - prevTotal;
        const pct  = Math.round(Math.abs(diff / prevTotal) * 100);
        if (pct >= 5) {
          list.push(diff > 0
            ? { icon: '↑', text: `+${pct}% לעומת החודש הקודם`, color: '#059669' }
            : { icon: '↓', text: `${pct}%- לעומת החודש הקודם`, color: '#DC2626' });
        }
      }
    }
    // 4. Recurring status
    const activeTemplates = recurringIncomes.filter(t => t.is_active);
    if (activeTemplates.length > 0) {
      const received = activeTemplates.filter(t => templateMonthStatuses.get(t.id)?.status === 'התקבל').length;
      const pending  = activeTemplates.filter(t => {
        const s = templateMonthStatuses.get(t.id)?.status;
        return !s || s === 'מצופה';
      }).length;
      if (pending > 0) {
        list.push({ icon: '○', text: `${received}/${activeTemplates.length} הכנסות קבועות אושרו`, color: '#6B7280' });
      }
    }
    return list.slice(0, 4);
  }, [totalExpectedMonthly, totalActual, gapMonthly, pieTypeData, recurringIncomes, templateMonthStatuses, analyticsData, currentMonth]);

  // ── Helper: expected date for a recurring template in the selected month ──
  const templateExpectedDate = (t: RecurringIncome): string => {
    if (t.expected_day_of_month == null) return '';
    const y = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const maxDay = new Date(y, mo + 1, 0).getDate();
    const day = Math.min(t.expected_day_of_month, maxDay);
    return `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-gray-900">הכנסות</h1>
          <div className="relative">
            <MonthSelector />
          </div>
        </div>
        <button
          onClick={() => setShowChoiceDrawer(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף הכנסה
        </button>
      </div>

      {/* ── Summary section ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* KPI vertical stack — right side (RTL-first priority) */}
        <div className="sm:w-[240px] shrink-0 bg-white rounded-2xl px-6 py-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase mb-4">סיכום חודשי</p>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-gray-400 mb-1">סכום צפוי</p>
              <p className="text-2xl font-extrabold" style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalExpectedMonthly)}
              </p>
            </div>
            <div className="h-px bg-gray-100" />
            <div>
              <p className="text-[11px] text-gray-400 mb-1">סכום בפועל</p>
              <p className="text-2xl font-extrabold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(totalActual)}
              </p>
            </div>
            <div className="h-px bg-gray-100" />
            <div>
              <p className="text-[11px] text-gray-400 mb-1">פער</p>
              <p className="text-2xl font-extrabold" style={{
                color: gapMonthly > 0 ? '#EF4444' : gapMonthly < 0 ? '#00A86B' : '#9CA3AF',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {gapMonthly === 0 ? '—' : (gapMonthly > 0 ? '−' : '+') + formatCurrency(Math.abs(gapMonthly))}
              </p>
              {gapMonthly !== 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: gapMonthly > 0 ? '#EF4444' : '#00A86B' }}>
                  {gapMonthly > 0 ? 'חסר מהצפוי' : 'עודף על הצפוי'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Donut chart — center */}
        <div className="sm:w-[240px] shrink-0 bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase mb-3">הכנסות לפי סוג</p>
          {pieTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-[100px]">
              <p className="text-sm text-gray-300">אין נתונים לחודש זה</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <PieChart width={110} height={110}>
                <Pie data={pieTypeData} cx={55} cy={55} innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                  {pieTypeData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="min-w-0">
                {pieTypeData.slice(0, 5).map((d, idx) => {
                  const pct = totalActual > 0 ? Math.round((d.value / totalActual) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 mb-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-600 truncate max-w-[90px]">{d.name}</span>
                      <span className="text-xs font-bold text-gray-400 mr-auto">{pct}%</span>
                    </div>
                  );
                })}
                {pieTypeData.length > 5 && <p className="text-[10px] text-gray-400">+{pieTypeData.length - 5}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Insight card — leftmost in RTL */}
        <div className="flex-1 bg-white rounded-2xl px-5 py-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', minWidth: 0 }}>
          <p className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase mb-3">תובנות</p>
          {insights.length === 0 ? (
            <p className="text-xs text-gray-300 py-4 text-center">הוסף הכנסות לצפייה</p>
          ) : (
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[12px] font-bold mt-0.5 flex-shrink-0" style={{ color: ins.color }}>{ins.icon}</span>
                  <p className="text-[11px] text-gray-700 leading-snug">{ins.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl mb-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Row 1: filter button (primary) + search (secondary) */}
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={() => setShowFilterPanel(p => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] border text-sm font-bold transition-all whitespace-nowrap"
            style={showFilterPanel || activeFilterCount > 0
              ? { borderColor: '#1E56A0', backgroundColor: '#1E56A0', color: '#fff' }
              : { borderColor: '#1E56A0', backgroundColor: '#fff', color: '#1E56A0' }}
          >
            <span>סינון</span>
            {activeFilterCount > 0 ? (
              <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
                {activeFilterCount}
              </span>
            ) : (
              <span style={{ fontSize: 11 }}>▾</span>
            )}
          </button>
          {/* Quick "אופי" chips — always visible */}
          <div className="hidden sm:flex items-center gap-1.5">
            {(['קבועה', 'חד-פעמית', 'משתנה'] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterNature(prev => toggleFilter(prev, v))}
                className="px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all"
                style={filterNature.has(v)
                  ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                  : { borderColor: '#e5e7eb', color: '#6b7280' }}
              >{v}</button>
            ))}
          </div>
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="חיפוש..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition min-w-0"
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition whitespace-nowrap"
            >
              נקה
            </button>
          )}
        </div>

        {/* Collapsible filter panel */}
        {showFilterPanel && (
          <div className="px-3 pb-3 pt-0 border-t border-gray-100 mt-0 space-y-3 pt-3">
            {/* סוג הכנסה */}
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 min-w-[72px] shrink-0 pt-1">סוג הכנסה</span>
              <div className="flex flex-wrap gap-1.5">
                {INCOME_TYPES.map(v => (
                  <button
                    key={v}
                    onClick={() => setFilterIncomeTypes(prev => toggleFilter(prev, v))}
                    className="px-2.5 py-1 rounded-full border text-xs font-semibold transition-all"
                    style={filterIncomeTypes.has(v)
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >{v}</button>
                ))}
              </div>
            </div>

            {/* שיוך — couple/family only */}
            {showAttribution && (
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-400 min-w-[72px] shrink-0 pt-1">שיוך</span>
                <div className="flex flex-wrap gap-1.5">
                  {attributionFilterOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setFilterAttribution(prev => toggleFilter(prev, opt.id))}
                      className="px-2.5 py-1 rounded-full border text-xs font-semibold transition-all"
                      style={filterAttribution.has(opt.id)
                        ? { borderColor: opt.color, backgroundColor: opt.color + '18', color: opt.color }
                        : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* סטטוס */}
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 min-w-[72px] shrink-0 pt-1">סטטוס</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'התקבל',    color: '#059669', bg: '#D1FAE5' },
                  { id: 'לא התקבל', color: '#DC2626', bg: '#FEE2E2' },
                  { id: 'מצופה',    color: '#D97706', bg: '#FEF3C7' },
                ].map(({ id, color, bg }) => (
                  <button
                    key={id}
                    onClick={() => setFilterStatus(prev => toggleFilter(prev, id))}
                    className="px-2.5 py-1 rounded-full border text-xs font-semibold transition-all"
                    style={filterStatus.has(id)
                      ? { borderColor: color, backgroundColor: bg, color }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >{id}</button>
                ))}
              </div>
            </div>

            {/* Inactive templates toggle */}
            {recurringIncomes.some(t => !t.is_active) && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowInactiveTemplates(p => !p)}
                  className="text-xs font-semibold transition"
                  style={{ color: showInactiveTemplates ? '#1E56A0' : '#9CA3AF' }}
                >
                  {showInactiveTemplates ? '✓ מציג הכנסות קבועות לא פעילות' : 'הצג הכנסות קבועות לא פעילות'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}
      {recurringError && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {recurringError}</span>
          <button onClick={() => setRecurringError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}
      {recurringMonthConfirmationsError && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl mb-4 text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          <span>⚠️ {recurringMonthConfirmationsError}</span>
          <button onClick={() => setRecurringMonthConfirmationsError(null)} className="opacity-60 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* UNIFIED TABLE                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        {(isLoading || recurringLoading) ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="w-7 h-7 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">טוען הכנסות...</p>
          </div>
        ) : filteredUnifiedRows.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-3xl mb-2">💰</p>
            <p className="text-gray-500 font-medium text-sm mb-3">
              {activeFilterCount > 0 ? 'לא נמצאו הכנסות התואמות את הסינון' : 'אין הכנסות לחודש זה'}
            </p>
            {activeFilterCount === 0 && (
              <button
                onClick={() => setShowChoiceDrawer(true)}
                className="px-5 py-2 text-white rounded-[10px] font-semibold text-sm hover:opacity-90"
                style={{ backgroundColor: '#1E56A0' }}
              >+ הוסף הכנסה ראשונה</button>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop table ──────────────────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.06)' }}>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[80px]">תאריך</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5">שם ההכנסה</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[72px]">סוג</th>
                    {showAttribution && <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[72px]">שיוך</th>}
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[72px]">אופי</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[80px]">סטטוס</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[100px]">יעד הפקדה</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[90px]">סכום צפוי</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 w-[90px]">סכום בפועל</th>
                    <th className="px-3 py-2.5 w-[150px]" />
                  </tr>
                </thead>
                <tbody>
                  {filteredUnifiedRows.map((row, i) => {
                    const bgBase = i % 2 === 0 ? '#fff' : '#f9fafb';

                    if (row.kind === 'template') {
                      const t = row.data;
                      const tms = t.is_active ? templateMonthStatuses.get(t.id) : undefined;
                      const status: TemplateMonthStatus | 'לא פעיל' = !t.is_active ? 'לא פעיל' : tms?.status ?? 'מצופה';
                      const confirmedAmount = tms?.confirmedAmount ?? null;
                      const isDeactivating = deactivatingId === t.id;
                      const isDeletingTpl = deletingTemplateId === t.id;
                      const pm = resolvePaymentDisplay(t.payment_source_id, t.payment_method, paymentSources);
                      const statusStyleMap: Record<string, React.CSSProperties> = {
                        'מצופה':     { backgroundColor: '#FEF3C7', color: '#D97706' },
                        'התקבל':     { backgroundColor: '#D1FAE5', color: '#059669' },
                        'לא התקבל': { backgroundColor: '#FEE2E2', color: '#DC2626' },
                        'לא פעיל':  { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
                      };
                      return (
                        <tr key={t.id} className="border-b border-gray-50 transition-colors"
                          style={{ backgroundColor: hoveredRow === t.id ? '#f0f6ff' : bgBase, opacity: isDeactivating ? 0.5 : !t.is_active ? 0.55 : 1 }}
                          onMouseEnter={() => setHoveredRow(t.id)} onMouseLeave={() => setHoveredRow(null)}>
                          {/* תאריך */}
                          <td className="px-3 py-2.5 text-sm text-gray-400 text-right whitespace-nowrap">
                            {templateExpectedDate(t) ? formatDateNumeric(templateExpectedDate(t)) : '—'}
                          </td>
                          {/* שם */}
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm flex-shrink-0">🔁</span>
                              <div className="min-w-0">
                                <span className={`text-sm font-semibold ${!t.is_active ? 'text-gray-400' : 'text-gray-900'}`}>{t.description}</span>
                                {t.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[180px]">{t.notes}</p>}
                              </div>
                            </div>
                          </td>
                          {/* סוג */}
                          <td className="px-3 py-2.5 text-right">
                            {t.income_type && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={!t.is_active ? { backgroundColor: '#F3F4F6', color: '#9CA3AF' } : { backgroundColor: '#E8F0FB', color: '#1E56A0' }}>{t.income_type}</span>}
                          </td>
                          {/* שיוך */}
                          {showAttribution && <td className="px-3 py-2.5 text-right"><AttrChip attrType={t.attributed_to_type} memberId={t.attributed_to_member_id} members={members} /></td>}
                          {/* אופי */}
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>קבועה</span>
                          </td>
                          {/* סטטוס */}
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={statusStyleMap[status] ?? {}}>{status}</span>
                          </td>
                          {/* יעד הפקדה */}
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: pm.color + '15', color: pm.color }}>{pm.name}</span>
                          </td>
                          {/* סכום צפוי */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className="text-sm font-bold" style={{ color: !t.is_active ? '#9CA3AF' : '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.amount)}</span>
                            <span className="text-[10px] text-gray-400 mr-0.5">/חודש</span>
                          </td>
                          {/* סכום בפועל */}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {confirmedAmount != null
                              ? <span className="text-sm font-bold" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(confirmedAmount)}</span>
                              : <span className="text-sm text-gray-300">—</span>}
                          </td>
                          {/* פעולות */}
                          <td className="px-3 py-2.5">
                            <div className={`flex items-center gap-1 flex-wrap transition-opacity duration-150 ${hoveredRow === t.id ? 'opacity-100' : 'opacity-0'}`}>
                              <button onClick={() => handleEditTemplate(t)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs" title="ערוך">✏️</button>
                              {t.is_active && (() => {
                                if (status === 'התקבל') return <button onClick={() => handleOpenArrival(t)} className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>ערוך קבלה</button>;
                                return (<>
                                  <button onClick={() => handleOpenArrival(t)} className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>התקבל</button>
                                  {status !== 'לא התקבל' && <button onClick={() => handleMarkSkipped(t)} disabled={markingSkippedId === t.id} className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap disabled:opacity-50" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>לא התקבל</button>}
                                </>);
                              })()}
                              <button onClick={() => handleToggleActive(t.id, t.is_active)} disabled={isDeactivating} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs disabled:cursor-not-allowed" title={t.is_active ? 'השהה' : 'הפעל'}>{t.is_active ? '⏸️' : '▶️'}</button>
                              <button onClick={() => handleDeleteTemplate(t.id)} disabled={isDeletingTpl} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:opacity-50" title="מחק">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Movement row
                    const m = row.data;
                    const pm = resolvePaymentDisplay(m.payment_source_id, m.payment_method, paymentSources);
                    const isDeletingMov = deletingId === m.id;
                    const showExpected = m.expected_amount != null && m.expected_amount !== m.amount;
                    return (
                      <tr key={m.id} className="border-b border-gray-50 transition-colors"
                        style={{ backgroundColor: isDeletingMov ? '#fff5f5' : hoveredRow === m.id ? '#f0f6ff' : bgBase, opacity: isDeletingMov ? 0.5 : 1 }}
                        onMouseEnter={() => setHoveredRow(m.id)} onMouseLeave={() => setHoveredRow(null)}>
                        {/* תאריך */}
                        <td className="px-3 py-2.5 text-sm text-gray-500 text-right whitespace-nowrap">{formatDateNumeric(m.date)}</td>
                        {/* שם */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-900">{m.description}</span>
                            {m.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[180px]">{m.notes}</p>}
                          </div>
                        </td>
                        {/* סוג */}
                        <td className="px-3 py-2.5 text-right">
                          {m.sub_category && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>{m.sub_category}</span>}
                        </td>
                        {/* שיוך */}
                        {showAttribution && <td className="px-3 py-2.5 text-right"><AttrChip attrType={m.attributed_to_type} memberId={m.attributed_to_member_id} members={members} /></td>}
                        {/* אופי */}
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={m.expected_amount != null
                              ? { backgroundColor: '#FFEDD5', color: '#C2410C', border: '1px solid #FED7AA' }
                              : { backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                            {m.expected_amount != null ? '≈ משתנה' : 'חד-פעמית'}
                          </span>
                        </td>
                        {/* סטטוס */}
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>התקבל</span>
                        </td>
                        {/* יעד הפקדה */}
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: pm.color + '15', color: pm.color }}>{pm.name}</span>
                        </td>
                        {/* סכום צפוי */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {showExpected
                            ? <span className="text-sm font-bold" style={{ color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(m.expected_amount!)}</span>
                            : <span className="text-sm font-bold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(m.amount)}</span>}
                        </td>
                        {/* סכום בפועל */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="text-sm font-bold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(m.amount)}</span>
                        </td>
                        {/* פעולות */}
                        <td className="px-3 py-2.5">
                          <div className={`flex items-center gap-1 transition-opacity duration-150 ${hoveredRow === m.id ? 'opacity-100' : 'opacity-0'}`}>
                            <button onClick={() => handleEdit(m)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs">✏️</button>
                            <button onClick={() => handleDelete(m.id)} disabled={isDeletingMov} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ───────────────────────────────────────────── */}
            <div className="md:hidden space-y-3">
              {filteredUnifiedRows.map(row => {
                if (row.kind === 'template') {
                  const t = row.data;
                  const tms = t.is_active ? templateMonthStatuses.get(t.id) : undefined;
                  const status: TemplateMonthStatus | 'לא פעיל' = !t.is_active ? 'לא פעיל' : tms?.status ?? 'מצופה';
                  const confirmedAmount = tms?.confirmedAmount ?? null;
                  const isDeactivating = deactivatingId === t.id;
                  const isDeletingTpl = deletingTemplateId === t.id;
                  const statusStyleMap: Record<string, React.CSSProperties> = {
                    'מצופה': { backgroundColor: '#FEF3C7', color: '#D97706' },
                    'התקבל': { backgroundColor: '#D1FAE5', color: '#059669' },
                    'לא התקבל': { backgroundColor: '#FEE2E2', color: '#DC2626' },
                    'לא פעיל': { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
                  };
                  return (
                    <div key={t.id} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: isDeactivating ? 0.5 : !t.is_active ? 0.55 : 1 }}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${t.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>🔁</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {t.income_type && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={!t.is_active ? { backgroundColor: '#F3F4F6', color: '#9CA3AF' } : { backgroundColor: '#E8F0FB', color: '#1E56A0' }}>{t.income_type}</span>}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>קבועה</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={statusStyleMap[status] ?? {}}>{status}</span>
                          </div>
                          <p className={`text-sm font-semibold ${!t.is_active ? 'text-gray-400' : 'text-gray-900'}`}>{t.description}</p>
                          {t.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.notes}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {t.expected_day_of_month != null && <span className="text-xs text-gray-400">יום {t.expected_day_of_month}</span>}
                            {showAttribution && t.attributed_to_type && <AttrChip attrType={t.attributed_to_type} memberId={t.attributed_to_member_id} members={members} />}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="text-left">
                            <p className="text-[10px] text-gray-400 mb-0.5">צפוי</p>
                            <span className="text-sm font-bold" style={{ color: !t.is_active ? '#9CA3AF' : '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.amount)}</span>
                            <span className="text-[10px] text-gray-400 mr-1">/חודש</span>
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] text-gray-400 mb-0.5">בפועל</p>
                            {confirmedAmount != null
                              ? <span className="text-sm font-bold" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(confirmedAmount)}</span>
                              : <span className="text-sm text-gray-400">—</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <button onClick={() => handleEditTemplate(t)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs">✏️</button>
                            <button onClick={() => handleToggleActive(t.id, t.is_active)} disabled={isDeactivating} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs disabled:cursor-not-allowed">{t.is_active ? '⏸️' : '▶️'}</button>
                            <button onClick={() => handleDeleteTemplate(t.id)} disabled={isDeletingTpl} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:opacity-50">🗑️</button>
                          </div>
                          {t.is_active && (() => {
                            if (status === 'התקבל') return <button onClick={() => handleOpenArrival(t)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>ערוך קבלה</button>;
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                <button onClick={() => handleOpenArrival(t)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>התקבל</button>
                                {status !== 'לא התקבל' && <button onClick={() => handleMarkSkipped(t)} disabled={markingSkippedId === t.id} className="px-2.5 py-1 rounded-full text-[11px] font-semibold disabled:opacity-50" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>לא התקבל</button>}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Movement card
                const m = row.data;
                const pm = resolvePaymentDisplay(m.payment_source_id, m.payment_method, paymentSources);
                const isDeletingMov = deletingId === m.id;
                const showExpected = m.expected_amount != null && m.expected_amount !== m.amount;
                return (
                  <div key={m.id} className="bg-white rounded-2xl p-4 flex items-start gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: isDeletingMov ? 0.5 : 1 }}>
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg flex-shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {m.sub_category && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>{m.sub_category}</span>}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={m.expected_amount != null
                            ? { backgroundColor: '#FFEDD5', color: '#C2410C', border: '1px solid #FED7AA' }
                            : { backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                          {m.expected_amount != null ? '≈ משתנה' : 'חד-פעמית'}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>התקבל</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.description}</p>
                      {m.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{m.notes}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">{formatDateNumeric(m.date)}</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: pm.color + '15', color: pm.color }}>{pm.name}</span>
                        {showAttribution && m.attributed_to_type && <AttrChip attrType={m.attributed_to_type} memberId={m.attributed_to_member_id} members={members} />}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: '#00A86B', fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(m.amount)}</span>
                      {showExpected && <span className="text-[11px] text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>צפוי: {formatCurrency(m.expected_amount!)}</span>}
                      <div className="flex items-center gap-1 mt-1">
                        <button onClick={() => handleEdit(m)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-xs">✏️</button>
                        <button onClick={() => handleDelete(m.id)} disabled={isDeletingMov} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-xs disabled:cursor-not-allowed">🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CHOICE DRAWER — בחר סוג הכנסה (3 options)                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showChoiceDrawer && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowChoiceDrawer(false)} />
          <div className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[360px] z-50 bg-white overflow-y-auto" style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">הוסף הכנסה</h2>
                <button onClick={() => setShowChoiceDrawer(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => { setShowChoiceDrawer(false); resetRecurringForm(); setRecurringPanelFromChoice(true); setShowRecurringPanel(true); }}
                  className="w-full p-5 rounded-2xl border-2 text-right transition-all hover:border-[#1E56A0] hover:bg-blue-50 group"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">🔁</span>
                    <span className="text-base font-bold text-gray-900 group-hover:text-[#1E56A0]">הכנסה קבועה</span>
                  </div>
                  <p className="text-sm text-gray-500 mr-10">ממשיכה אוטומטית לחודשים הבאים — יצירת תבנית</p>
                </button>
                <button
                  onClick={() => { setShowChoiceDrawer(false); resetForm(); setTxNature('חד-פעמית'); setPanelFromChoice(true); setShowPanel(true); }}
                  className="w-full p-5 rounded-2xl border-2 text-right transition-all hover:border-[#1E56A0] hover:bg-blue-50 group"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">💰</span>
                    <span className="text-base font-bold text-gray-900 group-hover:text-[#1E56A0]">הכנסה חד-פעמית</span>
                  </div>
                  <p className="text-sm text-gray-500 mr-10">הכנסה שאינה חוזרת — אירוע בודד</p>
                </button>
                <button
                  onClick={() => { setShowChoiceDrawer(false); resetForm(); setTxNature('משתנה'); setPanelFromChoice(true); setShowPanel(true); }}
                  className="w-full p-5 rounded-2xl border-2 text-right transition-all hover:border-[#1E56A0] hover:bg-blue-50 group"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">📊</span>
                    <span className="text-base font-bold text-gray-900 group-hover:text-[#1E56A0]">הכנסה משתנה</span>
                  </div>
                  <p className="text-sm text-gray-500 mr-10">חוזרת בטבעה אך הסכום משתנה — כגון משכורת</p>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ADD / EDIT INCOME PANEL                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowPanel(false); resetForm(); }} />
          <div className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white" style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {panelFromChoice && !editingIncome && (
                    <button
                      onClick={() => { setShowPanel(false); resetForm(); setShowChoiceDrawer(true); }}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                      title="חזור"
                    >→</button>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {editingIncome ? 'עריכת הכנסה' : txNature === 'משתנה' ? 'הכנסה משתנה' : 'הכנסה חד-פעמית'}
                    </h2>
                    {!editingIncome && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                        style={txNature === 'משתנה'
                          ? { backgroundColor: '#FEF3C7', color: '#D97706' }
                          : { backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                        {txNature}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setShowPanel(false); resetForm(); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
              </div>

              <div className="space-y-4">
                {/* 1. Income type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סוג הכנסה</label>
                  <div className="flex flex-wrap gap-2">
                    {INCOME_TYPES.map(type => (
                      <button key={type} onClick={() => setTxIncomeType(type)}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txIncomeType === type
                          ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}>{type}</button>
                    ))}
                  </div>
                </div>

                {/* 2. Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input value={txDescription} onChange={e => setTxDescription(e.target.value)}
                    placeholder="למשל: משכורת חודשית"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition" />
                </div>

                {/* 3. Expected amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום צפוי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input type="number" value={txExpectedAmount} onChange={e => setTxExpectedAmount(e.target.value)} placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                </div>

                {/* 3b. Actual amount (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום בפועל <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-300">₪</span>
                    <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0"
                      className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-[10px] text-base text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">אם התקבל סכום שונה מהצפוי, יוצג בטבלה לצד הצפוי</p>
                </div>

                {/* 4. Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                {/* 5. Attribution */}
                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setTxAttrType('shared'); setTxAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={txAttrType === 'shared' ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>משותף</button>
                      {members.map(m => (
                        <button key={m.id} onClick={() => { setTxAttrType('member'); setTxAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txAttrType === 'member' && txAttrMemberId === m.id ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{m.name}</button>
                      ))}
                      {txAttrType !== null && (
                        <button onClick={() => { setTxAttrType(null); setTxAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>ללא שיוך</button>
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
                        <button key={src.id} onClick={() => { setTxSourceId(src.id); setTxPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txSourceId === src.id ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button key={pm.id} onClick={() => { setTxPayment(pm.id); setTxSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={txPayment === pm.id && !txSourceId ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                {/* 7. Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <textarea value={txNotes} onChange={e => setTxNotes(e.target.value)} rows={2} placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                <button onClick={handleSave} disabled={isSaving || !txDescription.trim() || !txExpectedAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
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
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowRecurringPanel(false); resetRecurringForm(); }} />
          <div className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white" style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {recurringPanelFromChoice && !editingTemplate && (
                    <button
                      onClick={() => { setShowRecurringPanel(false); resetRecurringForm(); setShowChoiceDrawer(true); }}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                      title="חזור"
                    >→</button>
                  )}
                  <h2 className="text-lg font-bold text-gray-900">{editingTemplate ? 'עריכת הכנסה קבועה' : 'הוספת הכנסה קבועה'}</h2>
                </div>
                <button onClick={() => { setShowRecurringPanel(false); resetRecurringForm(); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">סוג הכנסה</label>
                  <div className="flex flex-wrap gap-2">
                    {INCOME_TYPES.map(type => (
                      <button key={type} onClick={() => setRtIncomeType(type)}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={rtIncomeType === type ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{type}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input value={rtDescription} onChange={e => setRtDescription(e.target.value)} placeholder="למשל: משכורת חודשית"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום חודשי</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input type="number" value={rtAmount} onChange={e => setRtAmount(e.target.value)} placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">יום צפוי בחודש <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <input type="number" value={rtExpectedDay} onChange={e => setRtExpectedDay(e.target.value)} placeholder="1–31" min={1} max={31}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setRtAttrType('shared'); setRtAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={rtAttrType === 'shared' ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>משותף</button>
                      {members.map(m => (
                        <button key={m.id} onClick={() => { setRtAttrType('member'); setRtAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtAttrType === 'member' && rtAttrMemberId === m.id ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{m.name}</button>
                      ))}
                      {rtAttrType !== null && (
                        <button onClick={() => { setRtAttrType(null); setRtAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>ללא שיוך</button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הופקד לחשבון</label>
                  <div className="flex flex-wrap gap-2">
                    {depositSources.length > 0 ? (
                      depositSources.map(src => (
                        <button key={src.id} onClick={() => { setRtSourceId(src.id); setRtPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtSourceId === src.id ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button key={pm.id} onClick={() => { setRtPayment(pm.id); setRtSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={rtPayment === pm.id && !rtSourceId ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <textarea value={rtNotes} onChange={e => setRtNotes(e.target.value)} rows={2} placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                <button onClick={handleSaveTemplate} disabled={recurringIsSaving || !rtDescription.trim() || !rtAmount}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
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
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setShowArrivalPanel(false); resetArrivalForm(); }} />
          <div className="fixed top-0 right-0 bottom-0 lg:right-[240px] w-full md:w-[400px] z-50 overflow-y-auto bg-white" style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', animation: 'slideInRight 0.25s ease' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">{arrivalEditingMovementId ? 'עריכת הכנסה' : 'רישום הכנסה'}</h2>
                <button onClick={() => { setShowArrivalPanel(false); resetArrivalForm(); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">✕</button>
              </div>

              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl" style={{ backgroundColor: '#E8F0FB' }}>
                <span className="text-base">🔁</span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-blue-900">{arrivalTemplate.description}</span>
                  {arrivalTemplate.income_type && <span className="text-[10px] text-blue-700 mr-1.5">{arrivalTemplate.income_type}</span>}
                </div>
                <span className="text-xs font-bold text-blue-800 mr-auto" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(arrivalTemplate.amount)} / חודש
                </span>
              </div>

              {arrivalError && (
                <div className="px-4 py-2.5 rounded-xl text-sm font-semibold mb-4" style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                  ⚠️ {arrivalError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תיאור</label>
                  <input value={arrivalDescription} onChange={e => setArrivalDescription(e.target.value)} placeholder="תיאור"
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום בפועל</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₪</span>
                    <input type="number" value={arrivalAmount} onChange={e => setArrivalAmount(e.target.value)} placeholder="0"
                      className="w-full pr-12 pl-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#1E56A0] transition"
                      style={{ fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
                  <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                {showAttribution && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שיוך</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setArrivalAttrType('shared'); setArrivalAttrMemberId(null); }}
                        className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                        style={arrivalAttrType === 'shared' ? { borderColor: '#6B7280', backgroundColor: '#6B728018', color: '#6B7280' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>משותף</button>
                      {members.map(m => (
                        <button key={m.id} onClick={() => { setArrivalAttrType('member'); setArrivalAttrMemberId(m.id); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalAttrType === 'member' && arrivalAttrMemberId === m.id ? { borderColor: m.avatarColor, backgroundColor: m.avatarColor + '20', color: m.avatarColor } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{m.name}</button>
                      ))}
                      {arrivalAttrType !== null && (
                        <button onClick={() => { setArrivalAttrType(null); setArrivalAttrMemberId(null); }}
                          className="px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition-all"
                          style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>ללא שיוך</button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">הופקד לחשבון</label>
                  <div className="flex flex-wrap gap-2">
                    {depositSources.length > 0 ? (
                      depositSources.map(src => (
                        <button key={src.id} onClick={() => { setArrivalSourceId(src.id); setArrivalPayment(SOURCE_TYPE_TO_PM[src.type] || 'transfer'); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalSourceId === src.id ? { borderColor: src.color, backgroundColor: src.color + '15', color: src.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{src.name}</button>
                      ))
                    ) : (
                      DEPOSIT_FALLBACK_PM.map(pm => (
                        <button key={pm.id} onClick={() => { setArrivalPayment(pm.id); setArrivalSourceId(null); }}
                          className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all"
                          style={arrivalPayment === pm.id && !arrivalSourceId ? { borderColor: pm.color, backgroundColor: pm.color + '15', color: pm.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>{pm.name}</button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות <span className="font-normal text-gray-400">(אופציונלי)</span></label>
                  <textarea value={arrivalNotes} onChange={e => setArrivalNotes(e.target.value)} rows={2} placeholder="הוסף הערה..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm resize-none focus:outline-none focus:border-[#1E56A0] transition" />
                </div>

                <button onClick={handleSaveRecurringArrival} disabled={arrivalIsSaving || !arrivalDescription.trim() || !arrivalAmount || !arrivalDate}
                  className="w-full py-3.5 rounded-[10px] text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.25)' }}>
                  {arrivalIsSaving ? 'שומר...' : arrivalEditingMovementId ? 'עדכן' : 'אישור התקבלות'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ANALYTICS — always visible                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 space-y-3">
        {/* Header + period selector */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">ניתוח הכנסות</p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {ANALYTICS_PERIOD_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setAnalyticsPeriod(opt.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={analyticsPeriod === opt.id
                  ? { backgroundColor: '#fff', color: '#1E56A0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#6B7280' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="w-7 h-7 border-2 border-[#1E56A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">טוען ניתוח...</p>
          </div>
        ) : analyticsError ? (
          <div className="px-5 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
            ⚠️ {analyticsError}
          </div>
        ) : !analyticsHasData ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p className="text-sm text-gray-400">הוסף הכנסות כדי לראות ניתוח</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500">
                {analyticsHasExpectedData ? 'צפוי מול בפועל' : 'הכנסות לאורך זמן'}
              </p>
              {totalExpectedMonthly > 0 && (
                <div className="text-left">
                  <p className="text-[10px] text-gray-400">אחוז מימוש</p>
                  <p className="text-sm font-extrabold" style={{
                    color: totalActual >= totalExpectedMonthly ? '#00A86B' : totalActual >= totalExpectedMonthly * 0.8 ? '#D97706' : '#EF4444',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Math.round((totalActual / totalExpectedMonthly) * 100)}%
                  </p>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analyticsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} width={36} />
                <Tooltip
                  formatter={(value: unknown, name?: string | number) => [
                    typeof value === 'number' ? formatCurrency(value) : '—',
                    name === 'expected' ? 'צפוי' : 'בפועל',
                  ] as [string, string]}
                  labelStyle={{ fontFamily: 'inherit', fontSize: 12 }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                />
                {analyticsHasExpectedData && <Bar dataKey="expected" fill="#93C5FD" radius={[4, 4, 0, 0]} name="expected" />}
                <Bar dataKey="actual" fill="#00A86B" radius={[4, 4, 0, 0]} name="actual" />
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              </BarChart>
            </ResponsiveContainer>
            {analyticsHasExpectedData && (
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
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default IncomesPage;
