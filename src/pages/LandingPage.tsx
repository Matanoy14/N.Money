import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import NMoneyLogo from '../components/NMoneyLogo';

const LandingPage: React.FC = () => {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const features = [
    { icon: '📊', title: 'דשבורד חכם', description: 'תמונה מלאה של המצב הפיננסי שלך בשניות' },
    { icon: '💬', title: 'הוספה קולית', description: 'הוסף עסקאות בדיבור, המערכת מבינה עברית' },
    { icon: '🎯', title: 'מטרות חיסכון', description: 'הגדר יעדים ועקוב אחרי ההתקדמות שלך' },
    { icon: '📈', title: 'תובנות אוטומטיות', description: 'ניתוח חכם של ההרגלים הפיננסיים שלך' },
    { icon: '🔒', title: 'פרטיות מלאה', description: 'הנתונים שלך מוגנים ושייכים לך בלבד' },
    { icon: '👨‍👩‍👧', title: 'לכל המשפחה', description: 'ניהול משותף לזוגות ומשפחות' },
  ];

  const faqItems = [
    {
      question: 'מה זה N.Money ולמי זה מתאים?',
      answer: 'N.Money היא אפליקציית ניהול פיננסי בעברית המיועדת לכל אחד — יחיד, זוג או משפחה שלמה. האפליקציה מאפשרת מעקב אחרי הוצאות והכנסות, ניהול תקציב, מעקב אחרי הלוואות ומטרות פיננסיות, וקבלת נתונים על המצב הפיננסי — הכל במקום אחד, בעברית.',
    },
    {
      question: 'האם האפליקציה מתחברת לחשבון הבנק שלי?',
      answer: 'לא. N.Money היא אפליקציה ידנית וקולית — אתה מזין את הנתונים בעצמך, בהקלדה או בדיבור. כך הנתונים שלך נשארים אצלך בלבד.',
    },
    {
      question: 'האם המידע שלי מאובטח?',
      answer: 'בהחלט. כל חשבון מבודד לחלוטין. הצפנה 256-bit, אימות מאובטח, וגיבוי אוטומטי. אתה יכול למחוק את החשבון בכל עת.',
    },
    {
      question: 'מה ההבדל בין חשבון אישי, זוגי ומשפחתי?',
      answer: 'אישי: משתמש אחד, כל הפיצ\'רים. זוגי: שני בני הזוג נכנסים עם פרטים שונים, ניהול משותף עם פילוח. משפחתי: כל בני המשפחה כולל ילדים, מעקב כסף כיס ויעדי חיסכון.',
    },
    {
      question: 'האם אפשר להוסיף עסקאות בקול?',
      answer: 'כן! לחץ על אייקון המיקרופון ואמור "שילמתי 150 שקל על דלק בפז באשראי" — המערכת תזהה ותמלא אוטומטית.',
    },
    {
      question: 'איך עובד ניהול ההלוואות?',
      answer: 'מזין פרטי הלוואה — סכום, ריבית, תאריך תחילה. המערכת מחשבת אוטומטית: החזר חודשי, כמה נשאר, מתי מסתיים, וסך הריבית.',
    },
    {
      question: 'כמה פעמים אפשר לגשת ממכשירים שונים?',
      answer: 'N.Money עובדת מכל דפדפן — מחשב, טאבלט, טלפון. בחשבון זוגי/משפחתי כל אחד נכנס מהמכשיר שלו.',
    },
    {
      question: 'מה זה ציון הבריאות הפיננסית?',
      answer: 'ציון 0-100 שמחושב מ-4 פרמטרים: אחוז חיסכון, עמידה בתקציב, יחס חוב להכנסה, התקדמות מטרות. מתעדכן אוטומטית.',
    },
    {
      question: 'האם יש אפליקציה להורדה?',
      answer: 'N.Money היא web app — אין צורך בהורדה. ניתן להוסיפה למסך הבית לחוויה כמו אפליקציה מלאה.',
    },
    {
      question: 'האם ניתן לשדרג או לשנות תוכנית בכל עת?',
      answer: 'כן, בכל עת. ניתן לשדרג, להוריד מדרגה, או לבטל — ללא עמלות.',
    },
  ];

  const testimonials = [
    {
      name: 'יעל כ.',
      initials: 'יכ',
      color: '#1E56A0',
      text: 'סוף סוף אפליקציה בעברית שמרגישה מקצועית! אני ובעלי מנהלים את התקציב ביחד ורואים בדיוק לאן הכסף הולך.',
      badge: 'חשבון זוגי',
    },
    {
      name: 'אבי מ.',
      initials: 'אמ',
      color: '#00A86B',
      text: 'ההוספה הקולית שינתה לי את החיים. במקום לשכוח לרשום — אני פשוט אומר את זה ונגמר.',
      badge: 'חשבון אישי',
    },
    {
      name: 'מיכל ד.',
      initials: 'מד',
      color: '#7C3AED',
      text: 'הילדים שלי לומדים לנהל כסף כיס דרך האפליקציה. זה כלי חינוכי מדהים!',
      badge: 'חשבון משפחתי',
    },
  ];

  const securityCards = [
    { icon: '🔐', title: 'הצפנה 256-bit', desc: 'כל הנתונים מוצפנים בתקן הגבוה ביותר' },
    { icon: '🏗️', title: 'בידוד מוחלט', desc: 'כל חשבון מבודד לחלוטין מחשבונות אחרים' },
    { icon: '💾', title: 'גיבוי אוטומטי', desc: 'הנתונים מגובים באופן אוטומטי מדי יום' },
    { icon: '🔑', title: 'אימות דו-שלבי', desc: 'שכבת הגנה נוספת לחשבונך' },
  ];

  return (
    <div className="bg-white" dir="rtl">
      {/* Bounce animation for scroll arrow */}
      <style>{`
        @keyframes bounceArrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .bounce-arrow {
          animation: bounceArrow 2s ease-in-out infinite;
        }
      `}</style>

      {/* ===== 1. NAVBAR ===== */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md border-b border-gray-100"
        style={{ backgroundColor: 'rgba(255,255,255,0.80)', boxShadow: '0 1px 3px rgba(30,86,160,0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-[72px]">
            {/* Logo on RIGHT (RTL: flex-start = right) */}
            <Link to="/" className="flex items-center gap-2">
              <NMoneyLogo size="sm" variant="blue" />
              <span className="text-[22px] font-extrabold tracking-tight" style={{ color: '#1E56A0' }}>
                N.Money
              </span>
            </Link>
            {/* Buttons on LEFT (RTL: flex-end = left) */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-[10px] font-semibold text-[15px] transition-all duration-200 hover:bg-gray-100"
                style={{ color: '#1E56A0' }}
              >
                כניסה
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-[15px] transition-all duration-200 hover:opacity-90 hover:shadow-lg"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.3)' }}
              >
                הרשמה
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== 2. HERO SECTION ===== */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D2F6B 0%, #1E56A0 50%, #4A90D9 100%)' }}
      >
        {/* Decorative blurred circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-10 right-[10%] w-[400px] h-[400px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(74,144,217,0.6), transparent 70%)', filter: 'blur(80px)' }}
          />
          <div
            className="absolute bottom-10 left-[5%] w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)', filter: 'blur(100px)' }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.5), transparent 70%)', filter: 'blur(60px)', transform: 'translate(-50%, -50%)' }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text content */}
            <div className="text-center lg:text-right">
              {/* Trust badge pill */}
              <div className="inline-block px-5 py-2 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-8 backdrop-blur-sm border border-white/20">
                ✨ ניהול פיננסי חכם לישראלים
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 tracking-tight">
                שליטה פיננסית מלאה
              </h1>
              <p className="text-2xl sm:text-3xl lg:text-4xl text-white/80 font-light mb-6">
                לך, לכם, למשפחה
              </p>
              <p className="text-lg lg:text-xl text-white/70 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                הגיע הזמן לקחת שליטה על הכסף שלך. עם N.Money תדע בדיוק לאן כל שקל הולך, תחסוך יותר, ותבנה עתיד פיננסי יציב — לך ולמשפחה שלך.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/signup"
                  className="px-8 py-4 bg-white rounded-[10px] text-lg font-bold transition-all duration-200 hover:scale-[1.03] inline-flex items-center justify-center gap-2"
                  style={{ color: '#1E56A0', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
                >
                  התחל בחינם ←
                </Link>
                <button className="px-8 py-4 border-2 border-white/30 text-white rounded-[10px] text-lg font-semibold transition-all duration-200 hover:bg-white/10 hover:border-white/50 backdrop-blur-sm inline-flex items-center justify-center gap-2">
                  <span>▶</span> צפה בסרטון
                </button>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-6 mt-12 text-white/60 text-sm">
                <span className="flex items-center gap-1.5">🔒 SSL מאובטח</span>
                <span className="text-white/20">|</span>
                <span className="flex items-center gap-1.5">👥 10,000+ משתמשים</span>
                <span className="text-white/20">|</span>
                <span className="flex items-center gap-1.5">⭐ 4.9/5 דירוג</span>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center lg:justify-start">
              <div
                className="w-[280px] sm:w-[300px] rounded-[36px] p-3 relative"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                  border: '2px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}
              >
                {/* Phone inner screen */}
                <div className="rounded-[28px] overflow-hidden" style={{ backgroundColor: '#f0f4f8' }}>
                  {/* Status bar */}
                  <div className="flex justify-between items-center px-5 py-2" style={{ backgroundColor: '#1E56A0' }}>
                    <div className="text-white text-xs font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</div>
                    <div className="flex gap-1">
                      <div className="w-4 h-2 rounded-sm bg-white/60" />
                      <div className="w-1.5 h-2 rounded-sm bg-white/40" />
                    </div>
                  </div>

                  {/* App header */}
                  <div className="px-4 py-3" style={{ backgroundColor: '#1E56A0' }}>
                    <div className="text-white/70 text-[10px] mb-1">שלום, יעל 👋</div>
                    <div className="text-white text-[11px] font-bold">הדשבורד שלך</div>
                  </div>

                  {/* Balance card */}
                  <div className="mx-3 -mt-1 rounded-xl p-3 mb-3" style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="text-[9px] text-gray-400 mb-1">יתרה כוללת</div>
                    <div className="text-[18px] font-bold" style={{ color: '#0D2F6B', fontVariantNumeric: 'tabular-nums' }}>₪24,850</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] font-semibold" style={{ color: '#00A86B' }}>+12.5%</span>
                      <span className="text-[9px] text-gray-400">מהחודש שעבר</span>
                    </div>
                  </div>

                  {/* Mini chart bars */}
                  <div className="mx-3 rounded-xl p-3 mb-3" style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="text-[9px] text-gray-500 mb-2 font-semibold">הוצאות לפי קטגוריה</div>
                    <div className="flex items-end gap-1.5 h-[50px]">
                      <div className="flex-1 rounded-t" style={{ height: '70%', backgroundColor: '#1E56A0' }} />
                      <div className="flex-1 rounded-t" style={{ height: '55%', backgroundColor: '#4A90D9' }} />
                      <div className="flex-1 rounded-t" style={{ height: '85%', backgroundColor: '#0D2F6B' }} />
                      <div className="flex-1 rounded-t" style={{ height: '40%', backgroundColor: '#E8F0FB', border: '1px solid #4A90D9' }} />
                      <div className="flex-1 rounded-t" style={{ height: '65%', backgroundColor: '#1E56A0' }} />
                      <div className="flex-1 rounded-t" style={{ height: '30%', backgroundColor: '#4A90D9' }} />
                      <div className="flex-1 rounded-t" style={{ height: '50%', backgroundColor: '#0D2F6B' }} />
                    </div>
                  </div>

                  {/* Recent transactions */}
                  <div className="mx-3 rounded-xl p-3 mb-3" style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="text-[9px] text-gray-500 mb-2 font-semibold">עסקאות אחרונות</div>
                    {[
                      { name: 'סופר', amount: '-₪320', color: '#E53E3E' },
                      { name: 'משכורת', amount: '+₪15,000', color: '#00A86B' },
                      { name: 'דלק', amount: '-₪280', color: '#E53E3E' },
                    ].map((tx, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#E8F0FB' }} />
                          <span className="text-[9px] text-gray-700">{tx.name}</span>
                        </div>
                        <span className="text-[9px] font-semibold" style={{ color: tx.color, fontVariantNumeric: 'tabular-nums' }}>{tx.amount}</span>
                      </div>
                    ))}
                  </div>

                  {/* Savings goal */}
                  <div className="mx-3 rounded-xl p-3 mb-4" style={{ backgroundColor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="text-[9px] text-gray-500 mb-1.5 font-semibold">🎯 מטרת חיסכון</div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-gray-600">חופשה משפחתית</span>
                      <span className="font-semibold" style={{ color: '#1E56A0', fontVariantNumeric: 'tabular-nums' }}>67%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: '#E8F0FB' }}>
                      <div className="h-full rounded-full" style={{ width: '67%', backgroundColor: '#1E56A0' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll down arrow */}
          <div className="flex justify-center mt-12 lg:mt-16">
            <div className="bounce-arrow text-white/40 text-2xl cursor-pointer">
              ↓
            </div>
          </div>
        </div>

        {/* Bottom wave SVG */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80L60 70C120 60 240 40 360 35C480 30 600 40 720 45C840 50 960 50 1080 45C1200 40 1320 30 1380 25L1440 20V80H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ===== 3. FEATURES SECTION ===== */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              הכלים שישנו את הדרך שאתה מנהל כסף
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              כל מה שצריך לניהול פיננסי חכם ויעיל — במקום אחד
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white p-8 border border-gray-100 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,86,160,0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)';
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-5"
                  style={{ backgroundColor: '#E8F0FB' }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 4. ACCOUNT TYPES SECTION ===== */}
      <section className="py-20 lg:py-28 px-6 lg:px-8" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              מותאם בדיוק לך
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* אישי */}
            <div
              className="bg-white border border-gray-200 p-8 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,86,160,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)'; }}
            >
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">אישי</h3>
              <p className="text-gray-500 text-sm mb-6">לניהול הכספים שלך בלבד</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>₪20</span>
                <span className="text-gray-400 text-sm mr-1">/חודש</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['דשבורד אישי', 'מעקב הוצאות והכנסות', 'ניהול תקציב', 'מטרות חיסכון', 'דוחות חודשיים'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0" style={{ backgroundColor: '#1E56A0' }}>✓</div>
                    <span className="text-gray-600 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-5 text-center">
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0', borderRadius: '999px' }}>
                  חודש ניסיון חינם
                </span>
              </div>
              <button
                className="w-full py-3.5 text-white font-bold cursor-pointer transition-all duration-200 hover:opacity-90 hover:shadow-lg"
                style={{ backgroundColor: '#1E56A0', borderRadius: '10px' }}
              >
                בחר תוכנית
              </button>
            </div>

            {/* זוגי — highlighted */}
            <div
              className="text-white p-8 relative"
              style={{
                background: 'linear-gradient(135deg, #1E56A0, #0D2F6B)',
                borderRadius: '16px',
                transform: 'scale(1.05)',
                boxShadow: '0 8px 30px rgba(13,47,107,0.35)',

                border: '2px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-sm font-bold"
                style={{ backgroundColor: '#C9A84C', color: '#0D2F6B', borderRadius: '999px' }}
              >
                הכי פופולרי
              </div>
              <div className="text-4xl mb-4">👫</div>
              <h3 className="text-2xl font-bold text-white mb-1">זוגי</h3>
              <p className="text-white/70 text-sm mb-6">ניהול משותף ושקיפות מלאה</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>₪30</span>
                <span className="text-white/60 text-sm mr-1">/חודש</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['כל מה שבאישי +', 'ניהול זוגי עם פילוח', 'תקציב משותף ואישי', 'תובנות לפי בן/בת זוג'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/20 text-white flex-shrink-0">✓</div>
                    <span className="text-white/90 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-5 text-center">
                <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/15 text-white/90" style={{ borderRadius: '999px' }}>
                  חודש ניסיון חינם
                </span>
              </div>
              <button
                className="w-full py-3.5 bg-white font-bold cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:shadow-lg"
                style={{ color: '#1E56A0', borderRadius: '10px' }}
              >
                בחר תוכנית
              </button>
            </div>

            {/* משפחתי */}
            <div
              className="bg-white border border-gray-200 p-8 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,86,160,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)'; }}
            >
              <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">משפחתי</h3>
              <p className="text-gray-500 text-sm mb-6">לכל בני המשפחה כולל ילדים</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>₪40</span>
                <span className="text-gray-400 text-sm mr-1">/חודש</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['כל מה שבזוגי +', 'עד 6 בני משפחה', 'מעקב כסף כיס לילדים', 'יעדי חיסכון לילדים'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0" style={{ backgroundColor: '#1E56A0' }}>✓</div>
                    <span className="text-gray-600 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-5 text-center">
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: '#E8F0FB', color: '#1E56A0', borderRadius: '999px' }}>
                  חודש ניסיון חינם
                </span>
              </div>
              <button
                className="w-full py-3.5 text-white font-bold cursor-pointer transition-all duration-200 hover:opacity-90 hover:shadow-lg"
                style={{ backgroundColor: '#1E56A0', borderRadius: '10px' }}
              >
                בחר תוכנית
              </button>
            </div>
          </div>

          {/* Launch banner */}
          <div
            className="mt-10 text-center py-4 px-6 font-semibold text-sm"
            style={{ backgroundColor: '#E8F0FB', color: '#1E56A0', borderRadius: '16px' }}
          >
            🚀 בהרצה — כל התוכניות זמינות בחינם כרגע
          </div>
        </div>
      </section>

      {/* ===== 5. HOW IT WORKS SECTION ===== */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              מתחילים תוך 3 דקות
            </h2>
          </div>

          <div className="relative">
            {/* Connecting dashed line */}
            <div
              className="hidden md:block absolute top-10 right-[16.66%] left-[16.66%] h-[2px] z-0"
              style={{ borderTop: '2px dashed #4A90D9', opacity: 0.3 }}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
              {[
                { num: '1', icon: '📝', title: 'נרשמים', desc: 'הרשמה מהירה בלי כרטיס אשראי' },
                { num: '2', icon: '⚙️', title: 'מגדירים', desc: 'שאלון קצר שמאפשר לנו להתאים את המערכת' },
                { num: '3', icon: '✨', title: 'מתחילים', desc: 'הוסף עסקה ראשונה וראה את הקסם קורה' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 relative"
                    style={{ backgroundColor: '#1E56A0', boxShadow: '0 4px 16px rgba(30,86,160,0.3)' }}
                  >
                    <span className="text-3xl">{step.icon}</span>
                    <span
                      className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: '#0D2F6B', border: '2px solid white' }}
                    >
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm max-w-[250px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. TESTIMONIALS SECTION ===== */}
      <section className="py-20 lg:py-28 px-6 lg:px-8" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              מה אומרים המשתמשים שלנו
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white p-8 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,86,160,0.15)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)'; }}
              >
                {/* Stars */}
                <div className="text-amber-400 text-sm mb-4">⭐⭐⭐⭐⭐</div>

                {/* Quote */}
                <p className="text-gray-600 leading-relaxed mb-6 text-[15px]">
                  &ldquo;{t.text}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: '#E8F0FB', color: '#1E56A0', borderRadius: '999px' }}
                    >
                      {t.badge}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 7. SECURITY SECTION ===== */}
      <section
        className="py-20 lg:py-28 px-6 lg:px-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0D2F6B 0%, #1E56A0 100%)' }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight text-white">
            הביטחון שלך הוא העדיפות שלנו
          </h2>
          <p className="text-white/60 text-lg mb-14 max-w-xl mx-auto">
            הנתונים שלך מוגנים בטכנולוגיות האבטחה המתקדמות ביותר
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {securityCards.map((item, i) => (
              <div
                key={i}
                className="backdrop-blur-sm p-7 border transition-all duration-200 hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                }}
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 8. FAQ SECTION ===== */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              שאלות שכיחות
            </h2>
            <p className="text-lg text-gray-500">כל מה שרצית לדעת על N.Money</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="overflow-hidden transition-all duration-200"
                style={{
                  borderRadius: '12px',
                  border: expandedFAQ === index ? '1.5px solid #1E56A0' : '1.5px solid #e5e7eb',
                  boxShadow: expandedFAQ === index ? '0 0 0 2px rgba(30,86,160,0.15)' : 'none',
                }}
              >
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  className="w-full px-6 py-5 text-right flex justify-between items-center gap-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-200"
                >
                  <span className="text-[16px] font-semibold text-gray-900">{item.question}</span>
                  <span
                    className="text-sm flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: expandedFAQ === index ? '#1E56A0' : '#f3f4f6',
                      color: expandedFAQ === index ? 'white' : '#6b7280',
                      transform: expandedFAQ === index ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    ▼
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: expandedFAQ === index ? '300px' : '0',
                    opacity: expandedFAQ === index ? 1 : 0,
                    transition: 'max-height 300ms ease, opacity 200ms ease',
                    overflow: 'hidden',
                  }}
                >
                  <div className="px-6 pb-5 bg-white">
                    <p className="text-gray-500 leading-relaxed text-[15px]">{item.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 9. CTA SECTION ===== */}
      <section
        className="py-20 lg:py-28 px-6 lg:px-8"
        style={{ background: 'linear-gradient(135deg, #0D2F6B, #1E56A0)' }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 tracking-tight">
            מוכן להשתלט על הכספים שלך?
          </h2>
          <p className="text-lg text-white/70 mb-10">
            הצטרף לאלפי ישראלים שכבר מנהלים כסף בחכמה
          </p>
          <Link
            to="/signup"
            className="inline-block px-10 py-4 bg-white text-lg font-bold transition-all duration-200 hover:scale-[1.03] hover:shadow-xl"
            style={{ color: '#1E56A0', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
          >
            צור חשבון חינמי ←
          </Link>
          <p className="text-white/50 text-sm mt-5">
            ללא כרטיס אשראי · ביטול בכל עת
          </p>
        </div>
      </section>

      {/* ===== 10. FOOTER ===== */}
      <footer className="py-14 px-6 lg:px-8" style={{ backgroundColor: '#0D2F6B' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Col 1: Logo + tagline */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <NMoneyLogo size="sm" variant="blue" className="!w-8 !h-8" />
                <span className="text-lg font-extrabold text-white">N.Money</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                שליטה פיננסית מלאה לך, לכם, למשפחה
              </p>
            </div>

            {/* Col 2: מוצר */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-white tracking-wider">מוצר</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">דשבורד</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">עסקאות</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">תקציב</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">מטרות</a></li>
              </ul>
            </div>

            {/* Col 3: חברה */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-white tracking-wider">חברה</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">אודות</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">בלוג</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">קריירה</a></li>
              </ul>
            </div>

            {/* Col 4: משפטי */}
            <div>
              <h4 className="font-bold mb-4 text-sm text-white tracking-wider">משפטי</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors duration-200">תנאים</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">פרטיות</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-200">אבטחה</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-8 text-center text-gray-500 text-sm" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p>&copy; 2026 N.Money &middot; כל הזכויות שמורות</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
