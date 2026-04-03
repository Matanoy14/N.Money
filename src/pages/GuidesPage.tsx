import React, { useState } from 'react';

interface Guide {
  id: number;
  title: string;
  description: string;
  icon: string;
  category: string;
  readTime: number;
  color: string;
  tags: string[];
}

const guidesData: Guide[] = [
  {
    id: 1,
    title: 'כיצד לבנות תקציב חודשי אפקטיבי',
    description: 'מדריך מלא לבניית תקציב משפחתי מאוזן, כולל שיטת 50/30/20 וטיפים מעשיים.',
    icon: '📊',
    category: 'תקציב',
    readTime: 8,
    color: '#1E56A0',
    tags: ['תקציב', 'חיסכון', 'מתחילים'],
  },
  {
    id: 2,
    title: 'קרן חירום — כמה כסף צריך לשמור?',
    description: 'למד מדוע קרן חירום חיונית וכיצד לחשב את הסכום הנכון עבורך ועבור משפחתך.',
    icon: '🛡️',
    category: 'חיסכון',
    readTime: 5,
    color: '#00A86B',
    tags: ['חיסכון', 'ביטחון פיננסי'],
  },
  {
    id: 3,
    title: 'ריבית דריבית — הפלא השמיני של העולם',
    description: 'הבן כיצד ריבית דריבית יכולה להכפיל את הכסף שלך לאורך זמן ולמה כדאי להתחיל מוקדם.',
    icon: '📈',
    category: 'השקעות',
    readTime: 6,
    color: '#F59E0B',
    tags: ['השקעות', 'ריבית דריבית', 'מתחילים'],
  },
  {
    id: 4,
    title: 'משכנתא: המדריך השלם לרוכשי דירה',
    description: 'כל מה שצריך לדעת על סוגי המשכנתאות, ריביות, תקופות ואיך לבחור נכון.',
    icon: '🏠',
    category: 'נדל״ן',
    readTime: 12,
    color: '#E53E3E',
    tags: ['משכנתא', 'נדל״ן', 'מתקדמים'],
  },
  {
    id: 5,
    title: 'השקעה בבורסה למתחילים',
    description: 'מבוא להשקעות בשוק ההון: מניות, אג"ח, קרנות נאמנות וכיצד להתחיל להשקיע.',
    icon: '💹',
    category: 'השקעות',
    readTime: 10,
    color: '#8B5CF6',
    tags: ['בורסה', 'השקעות', 'מתחילים'],
  },
  {
    id: 6,
    title: 'כרטיסי אשראי: יתרונות, סכנות וניהול נכון',
    description: 'כיצד להשתמש בכרטיסי אשראי לטובתך, ולהימנע ממלכודות חובות.',
    icon: '💳',
    category: 'חובות',
    readTime: 7,
    color: '#EC4899',
    tags: ['אשראי', 'חובות', 'ניהול'],
  },
  {
    id: 7,
    title: 'פנסיה: מה כל ישראלי חייב לדעת',
    description: 'הבן את מסלולי הפנסיה, קרנות ההשתלמות ואיך למקסם את החיסכון הפנסיוני.',
    icon: '🌅',
    category: 'פנסיה',
    readTime: 9,
    color: '#0EA5E9',
    tags: ['פנסיה', 'חיסכון', 'לטווח ארוך'],
  },
  {
    id: 8,
    title: 'חיסכון לילדים: אפשרויות ואסטרטגיות',
    description: 'סקירת האפשרויות לחיסכון לטובת ילדיך: חסכונות בנקאיים, קרנות ופוליסות.',
    icon: '👶',
    category: 'חיסכון',
    readTime: 6,
    color: '#F97316',
    tags: ['ילדים', 'חיסכון', 'עתיד'],
  },
];

const categories = ['הכל', 'תקציב', 'חיסכון', 'השקעות', 'נדל״ן', 'חובות', 'פנסיה'];

const GuidesPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('הכל');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);

  const filtered = guidesData.filter(g => {
    const matchCat = activeCategory === 'הכל' || g.category === activeCategory;
    const matchSearch = !searchQuery ||
      g.title.includes(searchQuery) ||
      g.description.includes(searchQuery) ||
      g.tags.some(t => t.includes(searchQuery));
    return matchCat && matchSearch;
  });

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">מדריכים פיננסיים</h1>
        <div className="relative max-w-xs w-full">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חפש מדריך..."
            className="w-full pr-9 pl-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#1E56A0] transition shadow-sm"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200"
            style={activeCategory === cat
              ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
              : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured guide */}
      <div
        className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D2F6B, #1E56A0)' }}
      >
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-start gap-5">
          <span className="text-5xl">⭐</span>
          <div>
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1 block">מדריך מומלץ</span>
            <h2 className="text-xl font-bold mb-2">כיצד לבנות תקציב חודשי אפקטיבי</h2>
            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              שיטת 50/30/20 הידועה: 50% לצרכים, 30% לרצונות, 20% לחיסכון — ומה לעשות כשהמספרים לא מסתדרים.
            </p>
            <button className="px-5 py-2.5 bg-white text-[#1E56A0] rounded-[10px] font-bold text-sm hover:bg-white/90 transition">
              קרא עכשיו ←
            </button>
          </div>
        </div>
      </div>

      {/* Guides grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <p className="text-gray-500">לא נמצאו מדריכים מתאימים</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(guide => (
            <div
              key={guide.id}
              className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: guide.color + '15' }}
                  >
                    {guide.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug">{guide.title}</h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{guide.readTime} דק׳</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">
                      {guide.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: guide.color + '18', color: guide.color }}
                      >
                        {guide.category}
                      </span>
                      {guide.tags.slice(1).map(tag => (
                        <span key={tag} className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {expandedGuide === guide.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{guide.description}</p>
                  <div className="bg-white rounded-xl p-4 mb-4">
                    <p className="text-xs text-gray-500 mb-2 font-medium">נקודות עיקריות:</p>
                    <ul className="space-y-1.5">
                      {['הבן את העקרון הבסיסי', 'יישם בחיי היומיום', 'מדוד את ההתקדמות', 'התאם לצרכים שלך'].map(point => (
                        <li key={point} className="text-sm text-gray-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: guide.color }} />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    className="w-full py-2.5 rounded-[10px] text-white font-semibold text-sm transition hover:opacity-90"
                    style={{ backgroundColor: guide.color }}
                  >
                    קרא את המדריך המלא ←
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GuidesPage;
