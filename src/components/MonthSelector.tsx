import React from 'react';
import { useMonth } from '../context/MonthContext';
import { formatMonth } from '../lib/formatters';

const MonthSelector: React.FC = () => {
  const { currentMonth, goToPrevMonth, goToNextMonth } = useMonth();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={goToNextMonth}
        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 text-gray-600 hover:text-gray-900"
      >
        ◀
      </button>
      <span className="text-lg font-bold text-gray-900 min-w-[140px] text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatMonth(currentMonth)}
      </span>
      <button
        onClick={goToPrevMonth}
        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 text-gray-600 hover:text-gray-900"
      >
        ▶
      </button>
    </div>
  );
};

export default MonthSelector;
