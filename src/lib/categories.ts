export const EXPENSE_CATEGORIES = [
  { id: 'housing',       name: 'בית ודיור',        icon: '🏠', color: '#1E56A0', chartColor: '#F59E0B' },
  { id: 'food',          name: 'מזון וקניות',       icon: '🛒', color: '#00A86B', chartColor: '#F97316' },
  { id: 'entertainment', name: 'מסעדות ובילוי',     icon: '🍽️', color: '#8B5CF6', chartColor: '#8B5CF6' },
  { id: 'transport',     name: 'רכב ותחבורה',       icon: '🚗', color: '#F59E0B', chartColor: '#FBBF24' },
  { id: 'communication', name: 'תקשורת ודיגיטל',   icon: '📱', color: '#0EA5E9', chartColor: '#A855F7' },
  { id: 'health',        name: 'בריאות',            icon: '🏥', color: '#E53E3E', chartColor: '#FB923C' },
  { id: 'fitness',       name: 'כושר ופנאי',        icon: '💪', color: '#22C55E', chartColor: '#D97706' },
  { id: 'clothing',      name: 'ביגוד והנעלה',      icon: '👗', color: '#EC4899', chartColor: '#EC4899' },
  { id: 'children',      name: 'ילדים',             icon: '👶', color: '#A855F7', chartColor: '#C026D3' },
  { id: 'education',     name: 'חינוך',             icon: '📚', color: '#0EA5E9', chartColor: '#7C3AED' },
  { id: 'travel',        name: 'חופשות ונסיעות',    icon: '✈️', color: '#6366F1', chartColor: '#6366F1' },
  { id: 'pets',          name: 'חיות מחמד',         icon: '🐾', color: '#F59E0B', chartColor: '#E879F9' },
  { id: 'gifts',         name: 'מתנות ואירועים',    icon: '🎁', color: '#EC4899', chartColor: '#DB2777' },
  { id: 'insurance',     name: 'ביטוחים',           icon: '🔒', color: '#1E56A0', chartColor: '#71717A' },
  { id: 'grooming',      name: 'טיפוח והיגיינה',   icon: '🧴', color: '#06B6D4', chartColor: '#14B8A6' },
  { id: 'other',         name: 'אחר',               icon: '📦', color: '#6B7280', chartColor: '#A8A29E' },
] as const;

// Default subcategory labels per category (approved default tier from taxonomy-v1)
export const SUBCATEGORIES: Record<string, string[]> = {
  food:          ['סופרמרקט', 'מכולת', 'ירקן', 'מאפייה', 'קצב/דגים', 'מוצרי ניקיון לבית', 'אחר'],
  housing:       ['שכירות', 'משכנתא', 'ארנונה', 'חשמל', 'מים', 'גז', 'ועד בית', 'תיקונים ותחזוקה', 'אחר'],
  transport:     ['דלק', 'חניה', 'תחבורה ציבורית', 'מוניות', 'כבישי אגרה', 'טיפולים לרכב', 'רישוי וטסט', 'שטיפת רכב', 'אחר'],
  insurance:     ['ביטוח רכב', 'ביטוח דירה', 'ביטוח חיים', 'ביטוח בריאות', 'ביטוח נסיעות', 'אחר'],
  health:        ['קופת חולים', 'רופאים מומחים', 'תרופות', 'טיפולים', 'שיניים', 'אופטיקה', 'בריאות נפש', 'אחר'],
  education:     ['שכר לימוד', 'קורסים', 'ספרים וחומרי לימוד', 'ציוד לימודי', 'הכשרות מקצועיות', 'מנויים לימודיים', 'אחר'],
  clothing:      ['בגדים יומיומיים', 'בגדי אירועים', 'נעליים', 'אביזרי אופנה', 'תיקונים וניקוי יבש', 'אחר'],
  communication: ['סלולר', 'אינטרנט', 'טלוויזיה', 'נטפליקס/סטרימינג וידאו', 'ספוטיפיי/Apple Music/מוזיקה', 'אחסון ענן', 'אפליקציות/תוכנות', 'אחר'],
  fitness:       ['חדר כושר', 'סטודיו/חוג', 'ציוד ספורט', 'מאמן/אימונים', 'מרוצים/אירועי ספורט', 'אחר'],
  children:      ['גן/בית ספר', 'צהרון', 'חוגים', 'ביגוד לילדים', 'צעצועים', 'בריאות לילדים', 'בייביסיטר/מטפלת', 'אחר'],
  travel:        ['טיסות', 'מלונות', 'תחבורה בחו״ל', 'אוכל בחו״ל', 'אטרקציות', 'ביטוח נסיעות', 'קניות בחו״ל', 'אחר'],
  pets:          ['אוכל', 'וטרינר', 'טיפולים ותרופות', 'ציוד', 'טיפוח/מספרה', 'פנסיון', 'ביטוח חיות', 'אחר'],
  gifts:         ['מתנות לימי הולדת', 'מתנות לחגים', 'אירועים', 'תרומות', 'עזרה למשפחה', 'אחר'],
  entertainment: ['מסעדות', 'בתי קפה', 'משלוחים', 'ברים/פאבים', 'קולנוע/הופעות', 'יציאות', 'תחביבים', 'גיימינג', 'אירועי תרבות', 'אחר'],
  grooming:      ['ספר / תספורת', 'קוסמטיקה', 'איפור', 'טיפוח עור', 'מניקור / פדיקור', 'בישום', 'מוצרי היגיינה', 'אחר'],
  other:         ['אחר'],
};

// Aliases for legacy Hebrew strings stored by FixedExpensesPage
const CATEGORY_ALIASES: Record<string, string> = {
  'בית ודיור':        'housing',
  'רכב ותחבורה':     'transport',
  'תקשורת ודיגיטל':  'communication',
  'בריאות':           'health',
  'ילדים וחינוך':    'children',
  'ילדים':            'children',
  'אחר':              'other',
};

export const getCategoryMeta = (id: string) => {
  const canonical = CATEGORY_ALIASES[id] ?? id;
  return (
    EXPENSE_CATEGORIES.find(c => c.id === canonical) ??
    { id: canonical, name: id, icon: '📦', color: '#6B7280', chartColor: '#A8A29E' }
  );
};
