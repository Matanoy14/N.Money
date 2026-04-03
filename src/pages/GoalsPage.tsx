import React, { useState } from 'react';
import { formatCurrency } from '../lib/formatters';

interface Goal {
  id: number;
  name: string;
  icon: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
  monthlyContribution: number;
  color: string;
  priority: 'high' | 'medium' | 'low';
}

const goalsData: Goal[] = [
  {
    id: 1,
    name: 'קרן חירום',
    icon: '🛡️',
    targetAmount: 60000,
    savedAmount: 45000,
    targetDate: '2026-09-01',
    monthlyContribution: 2500,
    color: '#00A86B',
    priority: 'high',
  },
  {
    id: 2,
    name: 'חופשה באירופה',
    icon: '✈️',
    targetAmount: 25000,
    savedAmount: 8000,
    targetDate: '2026-08-01',
    monthlyContribution: 1700,
    color: '#1E56A0',
    priority: 'medium',
  },
  {
    id: 3,
    name: 'החלפת רכב',
    icon: '🚗',
    targetAmount: 120000,
    savedAmount: 22000,
    targetDate: '2027-06-01',
    monthlyContribution: 3200,
    color: '#F59E0B',
    priority: 'medium',
  },
  {
    id: 4,
    name: 'ריהוט לסלון',
    icon: '🛋️',
    targetAmount: 15000,
    savedAmount: 6500,
    targetDate: '2026-12-01',
    monthlyContribution: 800,
    color: '#8B5CF6',
    priority: 'low',
  },
];

const priorityConfig = {
  high:   { label: 'גבוהה', bg: '#FEF2F2', color: '#E53E3E' },
  medium: { label: 'בינונית', bg: '#FEF3C7', color: '#B45309' },
  low:    { label: 'נמוכה',  bg: '#F3F4F6', color: '#6B7280' },
};

const GoalsPage: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newMonthly, setNewMonthly] = useState('');

  const totalSaved = goalsData.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = goalsData.reduce((s, g) => s + g.targetAmount, 0);
  const totalMonthly = goalsData.reduce((s, g) => s + g.monthlyContribution, 0);

  const getMonthsLeft = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (30 * 24 * 60 * 60 * 1000)));
  };

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">מטרות חיסכון</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף מטרה
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'סה״כ חסכתי',     value: formatCurrency(totalSaved),   color: '#00A86B' },
          { label: 'יעד כולל',       value: formatCurrency(totalTarget),  color: '#1E56A0' },
          { label: 'חיסכון חודשי',   value: formatCurrency(totalMonthly), color: '#8B5CF6' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-extrabold" style={{ color: card.color, fontVariantNumeric: 'tabular-nums' }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Goals grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {goalsData.map(goal => {
          const pct = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
          const monthsLeft = getMonthsLeft(goal.targetDate);
          const needed = goal.targetAmount - goal.savedAmount;
          const p = priorityConfig[goal.priority];

          return (
            <div
              key={goal.id}
              className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: goal.color + '15' }}
                  >
                    {goal.icon}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{goal.name}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: p.bg, color: p.color }}>
                      עדיפות {p.label}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-extrabold" style={{ color: goal.color, fontVariantNumeric: 'tabular-nums' }}>
                    {pct}%
                  </p>
                  <p className="text-xs text-gray-400">הושג</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(goal.savedAmount)}
                  </span>
                  <span className="text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: goal.color }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">נשאר לחסוך</p>
                  <p className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(needed)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">חודשים נותרו</p>
                  <p className="text-sm font-bold text-gray-900">{monthsLeft}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">הפקדה חודשית</p>
                  <p className="text-sm font-bold" style={{ color: goal.color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(goal.monthlyContribution)}
                  </p>
                </div>
              </div>

              {pct === 100 && (
                <div className="mt-3 bg-[#E8F8F2] rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-[#00A86B]">🎉 כל הכבוד! הגעת ליעד!</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivational tip */}
      <div className="bg-gradient-to-l from-[#00A86B] to-[#007a4d] rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <span className="text-3xl">🎯</span>
          <div>
            <p className="font-bold text-lg mb-1">אתה בדרך הנכונה!</p>
            <p className="text-white/80 text-sm leading-relaxed">
              בקצב הנוכחי תגיע ליעד קרן החירום שלך בעוד 6 חודשים.
              הגדלה של ₪500 בחודש תקצר את הזמן ב-2 חודשים נוספים.
            </p>
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">הוספת מטרת חיסכון</h2>
              <button onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם המטרה</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="למשל: קרן חירום"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">סכום יעד</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הפקדה חודשית</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                    <input type="number" value={newMonthly} onChange={e => setNewMonthly(e.target.value)}
                      className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך יעד</label>
                <input type="date"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">
                ביטול
              </button>
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-[10px] text-white font-bold transition hover:opacity-90"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;
