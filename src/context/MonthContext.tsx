import React, { createContext, useContext, useState } from 'react';

interface MonthContextType {
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  isCurrentMonth: boolean;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

export const MonthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const goToPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isCurrentMonth = (() => {
    const now = new Date();
    return currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() === now.getMonth();
  })();

  return (
    <MonthContext.Provider value={{ currentMonth, setCurrentMonth, goToPrevMonth, goToNextMonth, isCurrentMonth }}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = () => {
  const context = useContext(MonthContext);
  if (!context) throw new Error('useMonth must be used within MonthProvider');
  return context;
};
