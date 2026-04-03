import React, { useState } from 'react';
import { formatCurrency } from '../lib/formatters';

type CalculatorType = 'mortgage' | 'savings' | 'loan' | 'retirement';

const CalculatorsPage: React.FC = () => {
  const [activeCalc, setActiveCalc] = useState<CalculatorType>('mortgage');

  // Mortgage calculator state
  const [mortgageAmount, setMortgageAmount] = useState('900000');
  const [mortgageRate, setMortgageRate] = useState('3.2');
  const [mortgageYears, setMortgageYears] = useState('30');

  // Savings calculator state
  const [savingsInitial, setSavingsInitial] = useState('10000');
  const [savingsMonthly, setSavingsMonthly] = useState('1000');
  const [savingsRate, setSavingsRate] = useState('5');
  const [savingsYears, setSavingsYears] = useState('10');

  // Loan calculator state
  const [loanAmount, setLoanAmount] = useState('50000');
  const [loanRate, setLoanRate] = useState('6');
  const [loanMonths, setLoanMonths] = useState('36');

  // Retirement calculator state
  const [retirementAge, setRetirementAge] = useState('35');
  const [retirementSaved, setRetirementSaved] = useState('120000');
  const [retirementMonthly, setRetirementMonthly] = useState('3000');
  const [retirementRate, setRetirementRate] = useState('6');

  // ── Calculations ──────────────────────────────────────────────────────────

  const calcMortgage = () => {
    const P = parseFloat(mortgageAmount) || 0;
    const r = (parseFloat(mortgageRate) || 0) / 100 / 12;
    const n = (parseFloat(mortgageYears) || 1) * 12;
    if (r === 0) return { monthly: P / n, total: P, interest: 0 };
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = monthly * n;
    return { monthly, total, interest: total - P };
  };

  const calcSavings = () => {
    const P = parseFloat(savingsInitial) || 0;
    const PMT = parseFloat(savingsMonthly) || 0;
    const r = (parseFloat(savingsRate) || 0) / 100 / 12;
    const n = (parseFloat(savingsYears) || 0) * 12;
    if (r === 0) return { total: P + PMT * n, gain: PMT * n, months: n };
    const futureInitial = P * Math.pow(1 + r, n);
    const futurePMT = PMT * ((Math.pow(1 + r, n) - 1) / r);
    const total = futureInitial + futurePMT;
    const invested = P + PMT * n;
    return { total, gain: total - invested, months: n };
  };

  const calcLoan = () => {
    const P = parseFloat(loanAmount) || 0;
    const r = (parseFloat(loanRate) || 0) / 100 / 12;
    const n = parseFloat(loanMonths) || 1;
    if (r === 0) return { monthly: P / n, total: P, interest: 0 };
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = monthly * n;
    return { monthly, total, interest: total - P };
  };

  const calcRetirement = () => {
    const currentAge = parseFloat(retirementAge) || 35;
    const yearsToRetirement = 67 - currentAge;
    const n = yearsToRetirement * 12;
    const P = parseFloat(retirementSaved) || 0;
    const PMT = parseFloat(retirementMonthly) || 0;
    const r = (parseFloat(retirementRate) || 0) / 100 / 12;
    if (r === 0) return { total: P + PMT * n, years: yearsToRetirement };
    const futureInitial = P * Math.pow(1 + r, n);
    const futurePMT = PMT * ((Math.pow(1 + r, n) - 1) / r);
    return { total: futureInitial + futurePMT, years: yearsToRetirement };
  };

  const mortgage = calcMortgage();
  const savings = calcSavings();
  const loan = calcLoan();
  const retirement = calcRetirement();

  const calculators = [
    { id: 'mortgage' as const,   icon: '🏠', label: 'משכנתא' },
    { id: 'savings' as const,    icon: '💰', label: 'חיסכון' },
    { id: 'loan' as const,       icon: '💳', label: 'הלוואה' },
    { id: 'retirement' as const, icon: '🌅', label: 'פנסיה' },
  ];

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">מחשבונים פיננסיים</h1>

      {/* Calculator type tabs */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {calculators.map(calc => (
          <button
            key={calc.id}
            onClick={() => setActiveCalc(calc.id)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
            style={activeCalc === calc.id
              ? { backgroundColor: '#1E56A0', color: '#fff', boxShadow: '0 2px 8px rgba(30,86,160,0.3)' }
              : { backgroundColor: '#fff', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <span className="text-lg">{calc.icon}</span>
            <span>{calc.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Mortgage Calculator ─────────────────────────────────────────── */}
        {activeCalc === 'mortgage' && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
                🏠 מחשבון משכנתא
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>סכום ההלוואה</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input type="number" value={mortgageAmount} onChange={e => setMortgageAmount(e.target.value)}
                      className={`${inputClass} pr-8`} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>ריבית שנתית (%)</label>
                  <input type="number" step="0.1" value={mortgageRate} onChange={e => setMortgageRate(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>תקופת ההלוואה (שנים)</label>
                  <input type="number" value={mortgageYears} onChange={e => setMortgageYears(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5">תוצאות</h2>
              <div className="space-y-4">
                {[
                  { label: 'תשלום חודשי', value: formatCurrency(mortgage.monthly), color: '#1E56A0', large: true },
                  { label: 'סה״כ תשלומים', value: formatCurrency(mortgage.total), color: '#111827' },
                  { label: 'סה״כ ריבית', value: formatCurrency(mortgage.interest), color: '#E53E3E' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">{item.label}</span>
                    <span className={`font-extrabold ${item.large ? 'text-2xl' : 'text-lg'}`}
                      style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="bg-[#E8F0FB] rounded-xl p-4">
                  <p className="text-sm text-[#1E56A0] font-medium">
                    💡 עבור כל 1% עלייה בריבית, התשלום החודשי עולה בכ-{formatCurrency(Math.round(parseFloat(mortgageAmount) * 0.001 / 12))}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Savings Calculator ──────────────────────────────────────────── */}
        {activeCalc === 'savings' && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
                💰 מחשבון חיסכון
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'סכום התחלתי', val: savingsInitial, set: setSavingsInitial, prefix: '₪' },
                  { label: 'הפקדה חודשית', val: savingsMonthly, set: setSavingsMonthly, prefix: '₪' },
                  { label: 'ריבית שנתית (%)', val: savingsRate, set: setSavingsRate, prefix: '' },
                  { label: 'תקופת החיסכון (שנים)', val: savingsYears, set: setSavingsYears, prefix: '' },
                ].map(field => (
                  <div key={field.label}>
                    <label className={labelClass}>{field.label}</label>
                    {field.prefix ? (
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{field.prefix}</span>
                        <input type="number" value={field.val} onChange={e => field.set(e.target.value)}
                          className={`${inputClass} pr-8`} />
                      </div>
                    ) : (
                      <input type="number" step="0.1" value={field.val} onChange={e => field.set(e.target.value)}
                        className={inputClass} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5">תוצאות</h2>
              <div className="space-y-4">
                {[
                  { label: `סכום לאחר ${savingsYears} שנים`, value: formatCurrency(savings.total), color: '#00A86B', large: true },
                  { label: 'סה״כ הפקדות', value: formatCurrency((parseFloat(savingsInitial) || 0) + (parseFloat(savingsMonthly) || 0) * savings.months), color: '#111827' },
                  { label: 'רווח מריבית', value: formatCurrency(savings.gain), color: '#00A86B' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">{item.label}</span>
                    <span className={`font-extrabold ${item.large ? 'text-2xl' : 'text-lg'}`}
                      style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="bg-[#E8F8F2] rounded-xl p-4">
                  <p className="text-sm text-[#00A86B] font-medium">
                    📈 הריבית דריבית מייצרת {Math.round((savings.gain / ((parseFloat(savingsInitial) || 0) + (parseFloat(savingsMonthly) || 0) * savings.months)) * 100)}% תשואה על השקעתך
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Loan Calculator ─────────────────────────────────────────────── */}
        {activeCalc === 'loan' && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
                💳 מחשבון הלוואה
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>סכום ההלוואה</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                      className={`${inputClass} pr-8`} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>ריבית שנתית (%)</label>
                  <input type="number" step="0.1" value={loanRate} onChange={e => setLoanRate(e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>מספר תשלומים (חודשים)</label>
                  <input type="number" value={loanMonths} onChange={e => setLoanMonths(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5">תוצאות</h2>
              <div className="space-y-4">
                {[
                  { label: 'תשלום חודשי', value: formatCurrency(loan.monthly), color: '#8B5CF6', large: true },
                  { label: 'סה״כ תשלומים', value: formatCurrency(loan.total), color: '#111827' },
                  { label: 'עלות הריבית הכוללת', value: formatCurrency(loan.interest), color: '#E53E3E' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">{item.label}</span>
                    <span className={`font-extrabold ${item.large ? 'text-2xl' : 'text-lg'}`}
                      style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Retirement Calculator ────────────────────────────────────────── */}
        {activeCalc === 'retirement' && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
                🌅 מחשבון פרישה
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'גיל נוכחי', val: retirementAge, set: setRetirementAge, prefix: '' },
                  { label: 'חיסכון פנסיוני קיים', val: retirementSaved, set: setRetirementSaved, prefix: '₪' },
                  { label: 'הפקדה חודשית', val: retirementMonthly, set: setRetirementMonthly, prefix: '₪' },
                  { label: 'תשואה שנתית צפויה (%)', val: retirementRate, set: setRetirementRate, prefix: '' },
                ].map(field => (
                  <div key={field.label}>
                    <label className={labelClass}>{field.label}</label>
                    {field.prefix ? (
                      <div className="relative">
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{field.prefix}</span>
                        <input type="number" value={field.val} onChange={e => field.set(e.target.value)}
                          className={`${inputClass} pr-8`} />
                      </div>
                    ) : (
                      <input type="number" value={field.val} onChange={e => field.set(e.target.value)}
                        className={inputClass} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
              <h2 className="font-bold text-gray-900 text-lg mb-5">תחזית פרישה בגיל 67</h2>
              <div className="space-y-4">
                {[
                  { label: `חיסכון צפוי בפרישה`, value: formatCurrency(retirement.total), color: '#EC4899', large: true },
                  { label: 'שנים עד פרישה', value: `${retirement.years} שנים`, color: '#111827' },
                  { label: 'הכנסה חודשית צפויה', value: formatCurrency(retirement.total / (20 * 12)), color: '#8B5CF6' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600">{item.label}</span>
                    <span className={`font-extrabold ${item.large ? 'text-2xl' : 'text-lg'}`}
                      style={{ color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="bg-[#FEF3C7] rounded-xl p-4">
                  <p className="text-sm text-[#B45309] font-medium">
                    💡 הגדלה של ₪500 בהפקדה החודשית תוסיף {formatCurrency(500 * retirement.years * 12 * (1 + parseFloat(retirementRate) / 100 / 2))} לחיסכון הפנסיוני
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CalculatorsPage;
