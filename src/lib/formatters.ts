// Currency formatter for ILS
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Currency with decimals
export const formatCurrencyExact = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Date formatter: "12 במרץ"
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
};

// Date with year: "12 במרץ 2026"
export const formatDateFull = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Short month: "מרץ 2026"
export const formatMonth = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
};

// Day of week: "יום שלישי"
export const formatDayOfWeek = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL', { weekday: 'long' });
};

// Short month names for charts
export const shortMonthNames = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

// Percentage formatter
export const formatPercent = (value: number): string => {
  return `${Math.round(value)}%`;
};

// Number with commas
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('he-IL').format(num);
};
