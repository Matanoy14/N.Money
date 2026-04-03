import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = 'personal' | 'couple' | 'family';
type EmploymentType = 'salaried' | 'self_employed' | 'both';
type InputMethod = 'manual' | 'voice' | 'chat' | 'mixed';

interface ProfilingAnswers {
  employment_type: EmploymentType;
  income_range: string;
  household_size: string;
  main_concern: string;
  spending_method: string;
  has_loan: boolean | null;
  has_savings_goal: boolean | null;
  money_comfort_level: string;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 4; // account type, 8 profiling questions, input method, done

// ─── Component ────────────────────────────────────────────────────────────────

const OnboardingPage: React.FC = () => {
  const { user }              = useAuth();
  const { accountId, refetchAccount } = useAccount();
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();
  // After onboarding, return to invite URL if one was threaded through signup
  const redirectAfter = (() => {
    const r = searchParams.get('redirect') ?? '';
    return r.startsWith('/') ? r : '/dashboard';
  })();

  const [step, setStep]       = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Step 1 — account type
  const [accountType, setAccountTypeLocal] = useState<AccountType>('personal');

  // Step 2 — profiling
  const [answers, setAnswers] = useState<ProfilingAnswers>({
    employment_type:    'salaried',
    income_range:       '',
    household_size:     '',
    main_concern:       '',
    spending_method:    '',
    has_loan:           null,
    has_savings_goal:   null,
    money_comfort_level: '',
  });

  // Step 3 — input method
  const [inputMethod, setInputMethod] = useState<InputMethod>('manual');

  // ── Persist step 1 (account type) ──────────────────────────────────────────
  const saveAccountType = async () => {
    if (!user || !accountId) return;
    setIsSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('accounts')
      .update({ type: accountType })
      .eq('id', accountId);
    setIsSaving(false);
    if (err) { setError('שגיאה בשמירה. נסה שוב.'); return; }
    await supabase
      .from('user_profiles')
      .update({ onboarding_step: 2 })
      .eq('id', user.id);
    setStep(2);
  };

  // ── Persist step 2 (profiling) ──────────────────────────────────────────────
  const saveProfiling = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('user_profiles')
      .update({
        employment_type:  answers.employment_type,
        profiling_answers: answers,
        onboarding_step:   3,
      })
      .eq('id', user.id);
    setIsSaving(false);
    if (err) { setError('שגיאה בשמירה. נסה שוב.'); return; }
    setStep(3);
  };

  // ── Persist step 3 (input method) ──────────────────────────────────────────
  const saveInputMethod = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('user_profiles')
      .update({
        preferred_input_method: inputMethod,
        onboarding_step:        4,
      })
      .eq('id', user.id);
    setIsSaving(false);
    if (err) { setError('שגיאה בשמירה. נסה שוב.'); return; }
    setStep(4);
  };

  // ── Complete onboarding ─────────────────────────────────────────────────────
  const completeOnboarding = async () => {
    if (!user) return;
    setIsSaving(true);
    await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true, onboarding_step: 4 })
      .eq('id', user.id);
    setIsSaving(false);
    refetchAccount();
    navigate(redirectAfter, { replace: true });
  };

  // ── Skip entirely ───────────────────────────────────────────────────────────
  const skipOnboarding = async () => {
    if (!user) return;
    await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    refetchAccount();
    navigate(redirectAfter, { replace: true });
  };

  const setAnswer = <K extends keyof ProfilingAnswers>(key: K, val: ProfilingAnswers[K]) =>
    setAnswers(prev => ({ ...prev, [key]: val }));

  // ── Progress bar ────────────────────────────────────────────────────────────
  const progressPct = Math.round(((step - 1) / TOTAL_STEPS) * 100);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F0FB] to-white p-4" dir="rtl">
      <div className="max-w-xl mx-auto pt-8">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-3xl font-extrabold text-[#1E56A0] mb-1">N.Money</p>
          <p className="text-gray-500 text-sm">נגדיר את החשבון שלך — זה לוקח 2 דקות</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>שלב {Math.min(step, TOTAL_STEPS)} מתוך {TOTAL_STEPS}</span>
            <button onClick={skipOnboarding} className="text-[#1E56A0] hover:underline font-medium">
              דלג
            </button>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: '#1E56A0' }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Step 1: Account type ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">מי מנהל את החשבון?</h2>
            <p className="text-gray-500 text-sm mb-6">ניתן לשנות בכל עת מההגדרות</p>
            <div className="space-y-3">
              {([
                ['personal', '👤', 'אישי', 'רק אני מנהל את הכסף'],
                ['couple',   '👫', 'זוגי',  'אני והשותף/ה שלי ביחד'],
                ['family',   '👨‍👩‍👧‍👦', 'משפחתי', 'אנחנו ומעורבים ילדים'],
              ] as [AccountType, string, string, string][]).map(([val, icon, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setAccountTypeLocal(val)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-right transition-all"
                  style={accountType === val
                    ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB' }
                    : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}
                >
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div>
                    <p className="font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  {accountType === val && (
                    <span className="mr-auto text-[#1E56A0] font-bold text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={saveAccountType}
              disabled={isSaving}
              className="w-full mt-6 py-3.5 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#1E56A0' }}
            >
              {isSaving ? 'שומר...' : 'המשך'}
            </button>
          </div>
        )}

        {/* ── Step 2: Profiling questions ───────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">קצת עלייך</h2>
              <p className="text-gray-500 text-sm">כדי שנוכל להתאים את החוויה לך</p>
            </div>

            {/* Q1: Employment */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">מה מצב ההעסקה שלך?</label>
              <div className="flex gap-2 flex-wrap">
                {([['salaried','שכיר/ה'],['self_employed','עצמאי/ת'],['both','שניהם']] as [EmploymentType,string][]).map(([val,label]) => (
                  <button key={val} onClick={() => setAnswer('employment_type', val)}
                    className="px-4 py-2 rounded-full border-2 text-sm font-semibold transition"
                    style={answers.employment_type === val
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Income range */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">הכנסה חודשית ממוצעת (משפחתית)?</label>
              <div className="flex gap-2 flex-wrap">
                {(['עד ₪8K','₪8K–₪15K','₪15K–₪25K','₪25K–₪40K','מעל ₪40K']).map(r => (
                  <button key={r} onClick={() => setAnswer('income_range', r)}
                    className="px-3 py-1.5 rounded-full border-2 text-sm font-medium transition"
                    style={answers.income_range === r
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Household size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">כמה נפשות בבית?</label>
              <div className="flex gap-2 flex-wrap">
                {(['1','2','3','4','5+']).map(n => (
                  <button key={n} onClick={() => setAnswer('household_size', n)}
                    className="w-12 h-10 rounded-xl border-2 text-sm font-bold transition"
                    style={answers.household_size === n
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Q4: Main concern */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">מה הדאגה הפיננסית העיקרית שלך?</label>
              <div className="flex gap-2 flex-wrap">
                {(['לחסוך יותר','לצמצם הוצאות','לנהל חוב','לתכנן לעתיד','להבין לאן הולך הכסף']).map(c => (
                  <button key={c} onClick={() => setAnswer('main_concern', c)}
                    className="px-3 py-1.5 rounded-full border-2 text-sm font-medium transition"
                    style={answers.main_concern === c
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Q5: Spending method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">כיצד אתה משלם בדרך כלל?</label>
              <div className="flex gap-2 flex-wrap">
                {(['אשראי בעיקר','מזומן בעיקר','מעורב','העברות בנקאיות']).map(m => (
                  <button key={m} onClick={() => setAnswer('spending_method', m)}
                    className="px-3 py-1.5 rounded-full border-2 text-sm font-medium transition"
                    style={answers.spending_method === m
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Q6: Has loan */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">יש לך הלוואה או משכנתא?</label>
              <div className="flex gap-2">
                {([['yes','כן',true],['no','לא',false]] as [string,string,boolean][]).map(([key,label,val]) => (
                  <button key={key} onClick={() => setAnswer('has_loan', val)}
                    className="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition"
                    style={answers.has_loan === val
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q7: Has savings goal */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">יש לך מטרת חיסכון?</label>
              <div className="flex gap-2">
                {([['yes','כן',true],['no','לא',false]] as [string,string,boolean][]).map(([key,label,val]) => (
                  <button key={key} onClick={() => setAnswer('has_savings_goal', val)}
                    className="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition"
                    style={answers.has_savings_goal === val
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q8: Comfort level */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">מה רמת הנוחות שלך עם ניהול כסף?</label>
              <div className="flex gap-2 flex-wrap">
                {(['מתחיל','בינוני','מנוסה','מומחה']).map(l => (
                  <button key={l} onClick={() => setAnswer('money_comfort_level', l)}
                    className="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition"
                    style={answers.money_comfort_level === l
                      ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB', color: '#1E56A0' }
                      : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)}
                className="px-5 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
                חזור
              </button>
              <button onClick={saveProfiling} disabled={isSaving}
                className="flex-1 py-3 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0' }}>
                {isSaving ? 'שומר...' : 'המשך'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Input method ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">איך תעדיף להזין עסקאות?</h2>
            <p className="text-gray-500 text-sm mb-6">ניתן לשנות בהגדרות בכל עת</p>
            <div className="space-y-3">
              {([
                ['manual', '⌨️', 'ידני',  'אזין עסקאות דרך הטפסים'],
                ['voice',  '🎤', 'קולי',  'אדבר ואתן יתרגם'],
                ['chat',   '💬', 'צ׳אט',  'אכתוב בשפה חופשית'],
                ['mixed',  '🔄', 'מעורב', 'אשתמש בהתאם למצב'],
              ] as [InputMethod, string, string, string][]).map(([val, icon, label, desc]) => (
                <button key={val} onClick={() => setInputMethod(val)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-right transition-all"
                  style={inputMethod === val
                    ? { borderColor: '#1E56A0', backgroundColor: '#E8F0FB' }
                    : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div>
                    <p className="font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  {inputMethod === val && (
                    <span className="mr-auto text-[#1E56A0] font-bold text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)}
                className="px-5 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
                חזור
              </button>
              <button onClick={saveInputMethod} disabled={isSaving}
                className="flex-1 py-3 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0' }}>
                {isSaving ? 'שומר...' : 'המשך'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">הכל מוכן!</h2>
            <p className="text-gray-500 text-sm mb-8">
              החשבון שלך מוכן. בוא נתחיל לנהל כסף בצורה חכמה.
            </p>
            <button
              onClick={completeOnboarding}
              disabled={isSaving}
              className="w-full py-4 rounded-[10px] text-white font-bold text-base transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#1E56A0', boxShadow: '0 4px 16px rgba(30,86,160,0.3)' }}
            >
              {isSaving ? 'טוען...' : 'מעבר לדשבורד →'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default OnboardingPage;
