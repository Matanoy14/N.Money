// voiceParser.ts — Hebrew expense text → structured form values
// Pure module, no side effects, no API calls.

import { EXPENSE_CATEGORIES } from './categories';

export interface ParsedExpense {
  amount: number | null;
  description: string;
  category: string;          // EXPENSE_CATEGORIES id, or '' if unknown
  subCategory: string;       // SUBCATEGORIES value matching the category, or ''
  date: string;              // YYYY-MM-DD, defaults to today
  paymentMethod: string;     // canonical payment method id
  paymentSourceId: string | null;
  attributedToType: 'shared' | 'member' | null;
  attributedToMemberId: string | null;
  /** How much was actually extracted — drives preview chip display */
  fieldsFound: ('amount' | 'category' | 'subCategory' | 'date' | 'payment' | 'attribution')[];
  rawText: string;
}

interface ParseContext {
  members: Array<{ id: string; name: string }>;
  paymentSources: Array<{ id: string; name: string; type: string }>;
}

// ─── Amount ───────────────────────────────────────────────────────────────────

function extractAmount(text: string): number | null {
  const clean = (s: string) => parseFloat(s.replace(/[,.']/g, ''));
  const try_ = (re: RegExp): number | null => {
    const m = text.match(re);
    if (!m) return null;
    const n = clean(m[1]);
    return isNaN(n) || n <= 0 ? null : n;
  };

  return (
    try_(/₪\s*([\d,.']+)/) ??
    try_(/\b([\d,.']+)\s*(?:ש["״'ח]+|שקל)/) ??
    try_(/ב[-–]?([\d,.']+)/) ??
    try_(/\b([\d]{3,5})\b/) ??          // 3–5 digit standalone
    try_(/\b([\d]{2})\b/) ??            // 2-digit fallback
    hebrewWordAmount(text)
  );
}

const HEBREW_AMOUNTS: [RegExp, number][] = [
  [/אלפיים/, 2000], [/אלף/, 1000],
  [/תשע מאות/, 900], [/שמונה מאות/, 800], [/שבע מאות/, 700],
  [/שש מאות/, 600], [/חמש מאות/, 500], [/ארבע מאות/, 400],
  [/שלוש מאות/, 300], [/מאתיים/, 200], [/מאה/, 100],
  [/תשעים/, 90], [/שמונים/, 80], [/שבעים/, 70],
  [/שישים/, 60], [/חמישים/, 50], [/ארבעים/, 40],
  [/שלושים/, 30], [/עשרים/, 20], [/עשר|עשרה/, 10],
];

function hebrewWordAmount(text: string): number | null {
  for (const [re, val] of HEBREW_AMOUNTS) {
    if (re.test(text)) return val;
  }
  return null;
}

// ─── Date ─────────────────────────────────────────────────────────────────────

function extractDate(text: string): { date: string; found: boolean } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const shift = (days: number) => {
    const d = new Date(today); d.setDate(d.getDate() + days); return fmt(d);
  };
  if (/אתמול/.test(text))                              return { date: shift(-1), found: true };
  if (/לפני\s+יומיים/.test(text))                     return { date: shift(-2), found: true };
  if (/לפני\s+(?:שלושה|3)\s*ימים/.test(text))        return { date: shift(-3), found: true };
  if (/השבוע/.test(text))                              return { date: shift(-2), found: true };
  const dm = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dm) {
    const [, d, mo] = dm.map(Number);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return { date: fmt(new Date(today.getFullYear(), mo - 1, d)), found: true };
    }
  }
  return { date: fmt(today), found: false };
}

// ─── Category ─────────────────────────────────────────────────────────────────

const CAT_HINTS: Array<{ id: string; kw: string[] }> = [
  { id: 'food', kw: [
    'סופר', 'סופרמרקט', 'מכולת', 'ירקן', 'מזון', 'קניות', 'שופרסל', 'רמי לוי', 'יוחננוף',
    'ויקטורי', 'מגה', 'ניצה', 'חצי חינם', 'יינות ביתן', 'פרש מרקט', 'קצב', 'מאפייה',
    'לחם', 'חלב', 'ביצים', 'ירקות', 'פירות', 'am:pm', 'מוצרי ניקיון',
  ]},
  { id: 'entertainment', kw: [
    'מסעדה', 'קפה', 'פיצה', 'שוורמה', 'סושי', 'בורגר', 'מקדונלד', 'בורגר קינג',
    'בילוי', 'פאב', 'הופעה', 'קולנוע', 'משלוח', 'וולט', 'wolt', 'תן ביס',
    'ארומה', 'לטה', 'אספרסו', 'בית קפה', 'בר', 'יין', 'בירה', 'מועדון', 'תיאטרון',
    'הזמנה', 'פלאפל', 'שקשוקה', 'גלידה',
  ]},
  { id: 'transport', kw: [
    'מונית', 'אוטובוס', 'רכבת', 'דלק', 'בנזין', 'תדלוק', 'חניה', 'פנגו',
    'גט', 'uber', 'אובר', 'bolt', 'בולט', 'רכב', 'כביש', 'אגרה', 'טסט',
    'ביטוח רכב', 'מוסך', 'גרר', 'שטיפה', 'רישוי', 'תחבורה', 'סונול', 'פז',
  ]},
  { id: 'housing', kw: [
    'שכירות', 'שכ"ד', 'ארנונה', 'ועד בית', 'ועד', 'משכנתא', 'חשמל', 'מים', 'גז',
    'תיקון', 'אינסטלטור', 'חשמלאי', 'שרברב', 'נגר', 'שיפוץ', 'צבע', 'ריהוט',
    'איקאה', 'ikea', 'home center', 'ace', 'ניקיון', 'כלי בית',
  ]},
  { id: 'communication', kw: [
    'אינטרנט', 'סלולר', 'טלפון', 'נטפליקס', 'ספוטיפיי', 'ספוטיפאי', 'סטרימינג',
    'אפליקציה', 'תוכנה', 'yes', 'הוט', 'hot', 'partner', 'פרטנר',
    'cellcom', 'סלקום', 'pelephone', 'פלאפון', 'גולן', 'בזק',
    'google', 'גוגל', 'microsoft', 'icloud', 'dropbox', 'amazon prime',
    'דיסני', 'apple tv', 'apple music', 'hbo', 'zoom', 'adobe',
  ]},
  { id: 'health', kw: [
    'תרופות', 'רופא', 'מרפאה', 'בית חולים', 'קופת חולים', 'קופה',
    'שיניים', 'אופטיקה', 'משקפיים', 'עדשות',
    'מכבי', 'כללית', 'לאומית', 'מאוחדת',
    'פסיכולוג', 'פיזיותרפיסט', 'בית מרקחת', 'פארם', 'מרשם', 'הדמיה',
  ]},
  { id: 'fitness', kw: [
    'כושר', 'חדר כושר', 'ג\'ים', 'gym', 'סטודיו', 'יוגה', 'פילאטיס',
    'חוג', 'אימון', 'מאמן', 'ספינינג', 'קרוספיט', 'זומבה', 'ריצה',
    'שחייה', 'טניס', 'הולמס', 'מחסני ספורט', 'decathlon',
  ]},
  { id: 'clothing', kw: [
    'בגדים', 'ביגוד', 'נעליים', 'חולצה', 'מכנסיים', 'שמלה', "ז'קט",
    'זארה', 'hm', 'h&m', 'מנגו', 'קסטרו', 'fox', 'פוקס', 'גולף',
    'מג\'יק', 'adidas', 'nike', 'נייקי', 'אדידס', 'סנדלים', 'מגפיים',
  ]},
  { id: 'children', kw: [
    'גן', 'ילדים', 'צהרון', 'בייביסיטר', 'מטפלת', 'אומנת',
    'צעצועים', 'חוגים לילדים', 'ספרי לימוד', 'קייטנה', 'מחנה',
  ]},
  { id: 'education', kw: [
    'שיעורים', 'קורס', 'לימודים', 'שכר לימוד', 'אוניברסיטה', 'מכללה',
    'הכשרה', 'udemy', 'coursera', 'ספרים', 'ציוד לימודי', 'הסמכה',
  ]},
  { id: 'travel', kw: [
    'מלון', 'טיסה', 'חופשה', 'airbnb', 'אטרקציה', 'תיירות',
    'אל על', 'el al', 'booking', 'השכרת רכב', 'חו"ל', 'נמל תעופה',
  ]},
  { id: 'pets', kw: [
    'וטרינר', 'כלב', 'חתול', 'חיות', 'מזון לכלב', 'מזון לחתול',
    'פנסיון לחיות', 'ציוד לכלב', 'טיפוח כלב',
  ]},
  { id: 'gifts', kw: [
    'מתנה', 'מתנות', 'פרחים', 'אירוע', 'חתונה', 'בר מצווה', 'בת מצווה',
    'יום הולדת', 'יומולדת', 'ברית', 'מסיבה', 'חגים',
  ]},
  { id: 'insurance', kw: [
    'ביטוח', 'ביטוח חיים', 'ביטוח בריאות', 'ביטוח דירה', 'ביטוח רכב',
    'פוליסה', 'פרמיה', 'מגן', 'חובה', 'מקיף',
  ]},
  { id: 'grooming', kw: [
    'מספרה', 'תספורת', 'ברבר', 'קוסמטיקה', 'ספא', 'מניקור', 'פדיקור',
    'בישום', 'בושם', 'טיפוח', 'שמפו', 'קרם', 'איפור', 'עיצוב שיער',
  ]},
];

const VALID_CAT_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.id));

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  let best = { id: '', hits: 0 };
  for (const { id, kw } of CAT_HINTS) {
    if (!VALID_CAT_IDS.has(id)) continue;
    const hits = kw.filter(k => lower.includes(k.toLowerCase())).length;
    if (hits > best.hits) best = { id, hits };
  }
  return best.id;
}

// ─── Subcategory ──────────────────────────────────────────────────────────────
// Values MUST match entries in SUBCATEGORIES in categories.ts

interface SubCatHint { catId: string; subCat: string; kw: string[]; }

const SUB_CAT_HINTS: SubCatHint[] = [
  // food
  { catId: 'food', subCat: 'סופרמרקט',        kw: ['שופרסל', 'רמי לוי', 'יוחננוף', 'ויקטורי', 'מגה', 'ניצה', 'חצי חינם', 'יינות ביתן', 'פרש', 'סופר'] },
  { catId: 'food', subCat: 'מכולת',           kw: ['מכולת'] },
  { catId: 'food', subCat: 'ירקן',            kw: ['ירקן', 'ירקות', 'פירות', 'שוק'] },
  { catId: 'food', subCat: 'מאפייה',          kw: ['מאפייה', 'לחם', 'חלה', 'עוגה', 'בייגל', 'קרואסון'] },
  { catId: 'food', subCat: 'קצב/דגים',        kw: ['קצב', 'דגים', 'בשר', 'עוף'] },
  // entertainment
  { catId: 'entertainment', subCat: 'מסעדות',          kw: ['מסעדה', 'שוורמה', 'פיצה', 'סושי', 'בורגר', 'מקדונלד', 'בורגר קינג', 'פלאפל', 'שקשוקה'] },
  { catId: 'entertainment', subCat: 'בתי קפה',         kw: ['קפה', 'ארומה', 'לטה', 'אספרסו', 'קפיטריה', 'בית קפה'] },
  { catId: 'entertainment', subCat: 'משלוחים',         kw: ['משלוח', 'וולט', 'wolt', 'תן ביס', 'deliveroo', 'הזמנה'] },
  { catId: 'entertainment', subCat: 'ברים/פאבים',      kw: ['בר', 'פאב', 'בירה', 'יין', 'אלכוהול', 'מועדון'] },
  { catId: 'entertainment', subCat: 'קולנוע/הופעות',   kw: ['קולנוע', 'סרט', 'הופעה', 'קונצרט', 'תיאטרון', 'מוזיאון'] },
  { catId: 'entertainment', subCat: 'גיימינג',         kw: ['גיים', 'steam', 'playstation', 'nintendo', 'xbox', 'גיימינג'] },
  // transport
  { catId: 'transport', subCat: 'דלק',                kw: ['דלק', 'בנזין', 'תדלוק', 'סונול', 'פז', 'דור אלון'] },
  { catId: 'transport', subCat: 'חניה',               kw: ['חניה', 'פנגו', 'parking'] },
  { catId: 'transport', subCat: 'תחבורה ציבורית',    kw: ['אוטובוס', 'רכבת', 'תחבורה ציבורית', 'מטרו', 'קו', 'rav-kav', 'רב קו'] },
  { catId: 'transport', subCat: 'מוניות',             kw: ['מונית', 'גט', 'uber', 'אובר', 'bolt', 'בולט', 'יאנגו'] },
  { catId: 'transport', subCat: 'כבישי אגרה',         kw: ['כביש', 'אגרה', 'כביש 6', 'נתיבי ישראל', 'תשלום כביש'] },
  { catId: 'transport', subCat: 'טיפולים לרכב',       kw: ['מוסך', 'טיפול', 'גרר', 'פנצ\'ר'] },
  { catId: 'transport', subCat: 'רישוי וטסט',         kw: ['טסט', 'רישוי', 'רשות הרישוי'] },
  { catId: 'transport', subCat: 'שטיפת רכב',         kw: ['שטיפה', 'שטיפת רכב'] },
  // housing
  { catId: 'housing', subCat: 'שכירות',              kw: ['שכירות', 'שכ"ד', 'שכד', 'שכר דירה'] },
  { catId: 'housing', subCat: 'משכנתא',              kw: ['משכנתא'] },
  { catId: 'housing', subCat: 'ארנונה',              kw: ['ארנונה', 'עיריה', 'מועצה'] },
  { catId: 'housing', subCat: 'חשמל',               kw: ['חשמל', 'חברת חשמל'] },
  { catId: 'housing', subCat: 'מים',                kw: ['מים', 'חברת מים'] },
  { catId: 'housing', subCat: 'גז',                 kw: ['גז', 'גפ"מ', 'תנור גז'] },
  { catId: 'housing', subCat: 'ועד בית',            kw: ['ועד בית', 'ועד', 'ועד הבית'] },
  { catId: 'housing', subCat: 'תיקונים ותחזוקה',   kw: ['תיקון', 'אינסטלטור', 'חשמלאי', 'שרברב', 'נגר', 'שיפוץ', 'צבע', 'ניקיון'] },
  // communication
  { catId: 'communication', subCat: 'סלולר',                       kw: ['סלולר', 'פלאפון', 'pelephone', 'cellcom', 'סלקום', 'partner', 'פרטנר', 'hotmobile', 'גולן', '012'] },
  { catId: 'communication', subCat: 'אינטרנט',                     kw: ['אינטרנט', 'ראוטר', 'סיבים', 'בזק'] },
  { catId: 'communication', subCat: 'טלוויזיה',                    kw: ['טלוויזיה', 'yes', 'הוט', 'hot', 'ערוצים'] },
  { catId: 'communication', subCat: 'נטפליקס/סטרימינג וידאו',    kw: ['נטפליקס', 'דיסני', 'apple tv', 'hbo', 'amazon prime', 'prime video', 'yes vod', 'הוט vod'] },
  { catId: 'communication', subCat: 'ספוטיפיי/Apple Music/מוזיקה', kw: ['ספוטיפיי', 'ספוטיפאי', 'spotify', 'apple music', 'deezer', 'מוזיקה'] },
  { catId: 'communication', subCat: 'אחסון ענן',                   kw: ['icloud', 'google one', 'dropbox', 'one drive', 'onedrive'] },
  { catId: 'communication', subCat: 'אפליקציות/תוכנות',            kw: ['אפליקציה', 'תוכנה', 'adobe', 'zoom', 'microsoft', 'google', 'גוגל'] },
  // health
  { catId: 'health', subCat: 'קופת חולים',         kw: ['קופת חולים', 'קופה', 'מכבי', 'כללית', 'לאומית', 'מאוחדת'] },
  { catId: 'health', subCat: 'רופאים מומחים',      kw: ['רופא', 'מרפאה', 'פסיכולוג', 'פסיכיאטר', 'פיזיותרפיסט', 'נוירולוג', 'קרדיולוג'] },
  { catId: 'health', subCat: 'תרופות',             kw: ['תרופות', 'בית מרקחת', 'פארם', 'מרשם', 'כדורים'] },
  { catId: 'health', subCat: 'שיניים',             kw: ['שיניים', 'דנטל', 'אורתו', 'סתימה', 'עקירה', 'שתל'] },
  { catId: 'health', subCat: 'אופטיקה',            kw: ['אופטיקה', 'משקפיים', 'עדשות', 'אופטיקנה'] },
  { catId: 'health', subCat: 'בריאות נפש',         kw: ['פסיכולוג', 'טיפול נפשי', 'מטפל'] },
  // clothing
  { catId: 'clothing', subCat: 'בגדים יומיומיים', kw: ['חולצה', 'מכנסיים', 'שמלה', "ז'קט", 'ביגוד', 'בגדים', 'זארה', 'h&m', 'hm', 'מנגו', 'קסטרו', 'fox', 'פוקס', 'גולף', "מג'יק"] },
  { catId: 'clothing', subCat: 'נעליים',          kw: ['נעליים', 'נעל', 'סנדלים', 'מגפיים', 'כפכפים'] },
  { catId: 'clothing', subCat: 'אביזרי אופנה',    kw: ['תיק', 'ארנק', 'חגורה', 'צעיף', 'כובע'] },
  // fitness
  { catId: 'fitness', subCat: 'חדר כושר',         kw: ['חדר כושר', "ג'ים", 'gym', 'הולמס', 'macabi sport', 'topgym', 'טופ גיים'] },
  { catId: 'fitness', subCat: 'סטודיו/חוג',       kw: ['סטודיו', 'יוגה', 'פילאטיס', 'ריקוד', 'זומבה', 'ספינינג', 'קרוספיט', 'חוג'] },
  { catId: 'fitness', subCat: 'מאמן/אימונים',     kw: ['מאמן', 'אימון', 'פרסונל', 'personal'] },
  { catId: 'fitness', subCat: 'ציוד ספורט',       kw: ['ציוד ספורט', 'decathlon', 'מחסני ספורט', 'נעלי ריצה', 'מזרן'] },
  // children
  { catId: 'children', subCat: 'גן/בית ספר',          kw: ['גן', 'גן ילדים', 'גנון', 'בית ספר', 'חינוך חינם'] },
  { catId: 'children', subCat: 'צהרון',                kw: ['צהרון'] },
  { catId: 'children', subCat: 'חוגים',                kw: ['חוג', 'חוגים לילדים'] },
  { catId: 'children', subCat: 'בייביסיטר/מטפלת',    kw: ['בייביסיטר', 'מטפלת', 'אומנת'] },
  { catId: 'children', subCat: 'צעצועים',             kw: ['צעצועים', 'משחקים', 'לגו', 'ברבי'] },
  // education
  { catId: 'education', subCat: 'שכר לימוד',             kw: ['שכר לימוד', 'אוניברסיטה', 'מכללה', 'מוסד לימודים'] },
  { catId: 'education', subCat: 'קורסים',                 kw: ['קורס', 'udemy', 'coursera', 'אונליין', 'online', 'masterclass'] },
  { catId: 'education', subCat: 'ספרים וחומרי לימוד',   kw: ['ספרים', 'ספר לימוד', 'חומרי לימוד', 'מחברת'] },
  { catId: 'education', subCat: 'הכשרות מקצועיות',      kw: ['הכשרה', 'הסמכה', 'שיעורים פרטיים', 'מקצועי'] },
  // travel
  { catId: 'travel', subCat: 'טיסות',         kw: ['טיסה', 'אל על', 'el al', 'נמל תעופה', 'בן גוריון', 'ryanair', 'wizz', 'easyjet'] },
  { catId: 'travel', subCat: 'מלונות',        kw: ['מלון', 'airbnb', 'אירביאנד', 'booking', 'hostel', 'צימר'] },
  { catId: 'travel', subCat: 'אטרקציות',     kw: ['אטרקציה', 'פארק', 'מוזיאון', 'סיור', 'טיול', 'יומן'] },
  { catId: 'travel', subCat: 'תחבורה בחו״ל', kw: ['רנט א קר', 'השכרת רכב', 'תחבורה בחו"ל', 'metro', 'subway'] },
  // pets
  { catId: 'pets', subCat: 'אוכל',          kw: ['מזון לכלב', 'מזון לחתול', 'אוכל לחיות', 'petsmart'] },
  { catId: 'pets', subCat: 'וטרינר',        kw: ['וטרינר', 'ווטרינר', 'קליניקה לחיות', 'vet'] },
  { catId: 'pets', subCat: 'פנסיון',        kw: ['פנסיון', 'פנסיון לחיות', 'doggy hotel'] },
  // gifts & events
  { catId: 'gifts', subCat: 'מתנות לימי הולדת', kw: ['מתנה', 'יום הולדת', 'יומולדת', 'birthday'] },
  { catId: 'gifts', subCat: 'אירועים',           kw: ['חתונה', 'בר מצווה', 'בת מצווה', 'ברית', 'מסיבה'] },
  { catId: 'gifts', subCat: 'מתנות לחגים',       kw: ['חגים', 'ראש השנה', 'פורים', 'חנוכה', 'פסח'] },
  // insurance
  { catId: 'insurance', subCat: 'ביטוח רכב',      kw: ['ביטוח רכב', 'חובה', 'מקיף'] },
  { catId: 'insurance', subCat: 'ביטוח דירה',     kw: ['ביטוח דירה', 'ביטוח בית', 'מבנה'] },
  { catId: 'insurance', subCat: 'ביטוח חיים',     kw: ['ביטוח חיים', 'ריסק'] },
  { catId: 'insurance', subCat: 'ביטוח בריאות',   kw: ['ביטוח בריאות', 'מגן', 'שמירה'] },
  // grooming
  { catId: 'grooming', subCat: 'ספר / תספורת',   kw: ['מספרה', 'תספורת', 'ברבר', 'שיער', 'עיצוב שיער', 'צבע שיער'] },
  { catId: 'grooming', subCat: 'מניקור / פדיקור', kw: ['מניקור', 'פדיקור', 'ציפורניים', 'gel nails'] },
  { catId: 'grooming', subCat: 'קוסמטיקה',       kw: ['קוסמטיקה', 'איפור', 'foundation', 'מייקאפ'] },
  { catId: 'grooming', subCat: 'בישום',           kw: ['בישום', 'בושם', 'parfum', 'eau de toilette'] },
  { catId: 'grooming', subCat: 'מוצרי היגיינה',  kw: ['שמפו', 'קרם', 'סבון', 'דאודורנט', 'טיפוח'] },
];

function inferSubCategory(text: string, category: string): string {
  if (!category) return '';
  const lower = text.toLowerCase();
  let best = { subCat: '', hits: 0 };
  for (const hint of SUB_CAT_HINTS) {
    if (hint.catId !== category) continue;
    const hits = hint.kw.filter(k => lower.includes(k.toLowerCase())).length;
    if (hits > best.hits) best = { subCat: hint.subCat, hits };
  }
  return best.subCat;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

function inferPayment(
  text: string,
  sources: ParseContext['paymentSources']
): { method: string; sourceId: string | null; found: boolean } {
  // Try named source match first
  for (const src of sources) {
    if (text.includes(src.name)) {
      const method = src.type === 'bit' || src.type === 'paybox' ? 'bit'
        : src.type === 'bank' || src.type === 'transfer' ? 'transfer'
        : src.type === 'cash' ? 'cash'
        : 'credit';
      return { method, sourceId: src.id, found: true };
    }
  }
  if (/ביט/.test(text))                                    return { method: 'bit',      sourceId: null, found: true };
  if (/paybox|פיי\s*בוקס/.test(text))                     return { method: 'bit',      sourceId: null, found: true };
  if (/מזומן/.test(text))                                  return { method: 'cash',     sourceId: null, found: true };
  if (/ויזה|מסטרקארד|אמקס|אשראי|כרטיס/.test(text))      return { method: 'credit',   sourceId: null, found: true };
  if (/העברה|בנק|עו"ש/.test(text))                       return { method: 'transfer', sourceId: null, found: true };
  if (/הוראת קבע/.test(text))                              return { method: 'standing', sourceId: null, found: true };
  return { method: 'credit', sourceId: null, found: false };
}

// ─── Attribution ──────────────────────────────────────────────────────────────

function inferAttribution(
  text: string,
  members: ParseContext['members']
): { type: 'shared' | 'member' | null; memberId: string | null; found: boolean } {
  if (/משותף|שלנו/.test(text)) return { type: 'shared', memberId: null, found: true };
  for (const m of members) {
    if (text.includes(m.name)) return { type: 'member', memberId: m.id, found: true };
  }
  return { type: null, memberId: null, found: false };
}

// ─── Description builder ──────────────────────────────────────────────────────

const FILLER = [
  /₪\s*[\d,.']+/g,
  /[\d,.']+\s*(?:ש["״'ח]+|שקל)/g,
  /ב[-–]?[\d,.']+/g,
  /\b[\d,.']{3,}\b/g,
  /^(?:קניתי|שילמתי|הוצאתי|הוצאה|הוסף)\s*/,
  /\s+(?:אתמול|היום|השבוע|לפני\s+\S+\s+ימים)$/,
  /\s+(?:ב(?:ויזה|ביט|מזומן|כרטיס|אשראי))\b/g,
];

function buildDescription(text: string): string {
  let d = text;
  for (const re of FILLER) d = d.replace(re, ' ');
  d = d.replace(/\s+/g, ' ').trim();
  return d.length >= 2 ? d : text.trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseExpenseText(text: string, ctx: ParseContext): ParsedExpense {
  const amount      = extractAmount(text);
  const dateRes     = extractDate(text);
  const category    = inferCategory(text);
  const subCategory = inferSubCategory(text, category);
  const payment     = inferPayment(text, ctx.paymentSources);
  const attr        = inferAttribution(text, ctx.members);
  const description = buildDescription(text);

  const fieldsFound: ParsedExpense['fieldsFound'] = [];
  if (amount !== null)   fieldsFound.push('amount');
  if (category)          fieldsFound.push('category');
  if (subCategory)       fieldsFound.push('subCategory');
  if (dateRes.found)     fieldsFound.push('date');
  if (payment.found)     fieldsFound.push('payment');
  if (attr.found)        fieldsFound.push('attribution');

  return {
    amount,
    description,
    category,
    subCategory,
    date:                 dateRes.date,
    paymentMethod:        payment.method,
    paymentSourceId:      payment.sourceId,
    attributedToType:     attr.type,
    attributedToMemberId: attr.memberId,
    fieldsFound,
    rawText: text,
  };
}
