> ⚠️ HISTORICAL — Sprints 1 & 2 are complete. This describes a past state (table was `transactions`, dashboard was mock). See MODULE_STATUS.md + SPRINT_BACKLOG.md for current state.

> This document defines the approved V1 implementation roadmap for N.Money.

---

# מפרט רודמאפ יישום V1 — N.Money

---

## 1. סיכום המצב הנוכחי

הפרויקט קיים כ-Vite + React + TypeScript + Supabase. קיים scaffold מלא של עמודים ונתיבים, auth אמיתי, ושילוב Supabase בסיסי בעמוד עסקאות. שאר העמודים מכילים נתונים מדומים (mock) או ריקים לחלוטין.

**מה קיים ועובד:**
- Auth: login / signup / logout / session persistence — **אמיתי ועובד**
- TransactionsPage — fetch מ-Supabase, הוספה, מחיקה — **אמיתי, חלקי**
- 16 עמודים ב-routing — **scaffold קיים**
- AppLayout, MonthSelector, NMoneyLogo, Toast — **קיימים**
- AuthContext, AccountContext, MonthContext — **קיימים**

**מה מדומה (mock) או חסר:**
- Dashboard — נתונים מדומים לחלוטין
- Incomes, Budget, FixedExpenses, Loans, Assets, Goals — mock data
- Onboarding — עמוד קיים, לוגיקה חסרה
- LandingPage — קיים, תוכן שיווקי ואמיתי חסר
- Settings — ריק
- Calculators, Guides — mock/placeholder
- מבנה `accounts` ו-`account_members` — לא קיים ב-DB
- RLS לפי account_id — לא קיים
- הרשאות ילד / pending_approval — לא קיים
- טבלת DB נקראת `transactions` (לא `financial_movements`)
- אין שדות: `type`, `status`, `source`, `account_id`, `recurring_id`, `goal_id`

---

## 2. מה כבר בנוי

| פיצ'ר | מצב | הערות |
|-------|-----|-------|
| Signup / Login / Logout | ✅ עובד | אימייל + סיסמה, Supabase Auth |
| Session persistence | ✅ עובד | getSession + onAuthStateChange |
| Routing + ProtectedRoute | ✅ עובד | React Router, redirect לא-מחוברים |
| RTL layout | ✅ עובד | dir="rtl" גלובלי |
| TransactionsPage — fetch | ✅ עובד | שולף מ-`transactions` לפי user_id + חודש |
| TransactionsPage — הוספה | ✅ עובד | |
| TransactionsPage — מחיקה | ✅ עובד | |
| MonthSelector | ✅ עובד | |
| AppLayout + Sidebar | ✅ עובד | |
| Toast notifications | ✅ עובד | |

---

## 3. מה מדומה / חלקי / חסר

| פיצ'ר | מצב | מה חסר |
|-------|-----|-------|
| TransactionsPage — עריכה | ⚠️ חסר | edit panel לא ממומש |
| Dashboard | ❌ mock | כל הנתונים hardcoded |
| Incomes | ❌ mock | אין fetch אמיתי |
| Budget | ❌ mock | אין טבלת budgets, אין חישוב |
| FixedExpenses | ❌ mock | אין טבלת recurring_expenses |
| Loans | ❌ mock | אין טבלת loans |
| Assets | ❌ mock | אין טבלת assets |
| Goals | ❌ mock | אין טבלת goals |
| Onboarding | ❌ חסר | לוגיקה, שאלון, צ'קליסט — חסרים |
| LandingPage | ⚠️ חלקי | קיים, חסר תוכן שיווקי + שאלון + וידאו |
| Settings | ❌ ריק | |
| Calculators | ❌ placeholder | |
| Guides | ❌ placeholder | |
| accounts table | ❌ לא קיים | |
| account_members table | ❌ לא קיים | |
| RLS לפי account_id | ❌ לא קיים | |
| שדה `type` בעסקאות | ❌ לא קיים | income / expense / saving / transfer |
| שדה `status` בעסקאות | ❌ לא קיים | actual / pending / planned וכו' |
| שדה `source` בעסקאות | ❌ לא קיים | |
| pending_approval flow | ❌ לא קיים | |
| הרשאות ילד | ❌ לא קיים | |
| audit_log | ❌ לא קיים | |
| user_profiles | ❌ לא קיים | |

---

## 4. עקרונות יישום

1. **DB ראשון, UI אחר כך.** כל מודול מתחיל בהגדרת ה-schema + RLS ב-Supabase — ורק לאחר מכן ממשקים.
2. **שינויים מינימליים ממוקדים.** כל sprint מטפל במודול אחד — לא מרפקטור קוד שלא נגיעה בו.
3. **אין mock בעמוד שמחובר לנתונים.** ברגע שמודול מחובר ל-DB — מוסרים כל הנתונים המדומים.
4. **RLS מיידית.** כל טבלה חדשה מקבלת RLS ביצירתה — לא כ-afterthought.
5. **פרופיל משתמש מלווה כל המשך.** `user_profiles` + `accounts` + `account_members` הם הבסיס שעליו כל שאר המודולים תלויים.
6. **עריכה = פיצ'ר מלא.** כל CRUD כולל edit — לא רק add + delete.
7. **קודם אישי, אחר כך זוגי, אחר כך משפחתי.** מבנה חשבון מורכב מגיע בשלבים.

---

## 5. פאזות היישום — סקירה כללית

| פאזה | שם | תוכן עיקרי |
|------|----|-----------|
| **0** | מיגרציה ובסיס DB | schema חדש, RLS, migration |
| **1** | ליבת הנתונים | עסקאות מלא, הכנסות, דשבורד חי |
| **2** | מודולי ניהול | תקציב, הוצאות קבועות, הגדרות |
| **3** | מודולים פיננסיים | הלוואות, נכסים, מטרות |
| **4** | חשבונות מרובים | זוגי + משפחתי + הרשאות ילד |
| **5** | אונבורדינג + נחיתה | שאלון, צ'קליסט, דף נחיתה |
| **6** | תקשורת ואוטומציה | דוחות, התראות, בוט |
| **7** | השקה | billing, analytics, hardening |

---

## 6. תלויות בין פאזות

```
פאזה 0 (DB) ──────────────────────────────────────────┐
                                                       ↓
פאזה 1 (עסקאות + הכנסות + דשבורד) ─────────────────┐  │
                                                     ↓  │
פאזה 2 (תקציב + הוצאות קבועות) ──────────────────┐  │  │
                                                   ↓  │  │
פאזה 3 (הלוואות + נכסים + מטרות) ─────────────┐  │  │  │
                                               ↓  │  │  │
פאזה 4 (חשבונות מרובים + הרשאות) ──────────┐  │  │  │  │
                                            ↓  │  │  │  │
פאזה 5 (אונבורדינג + נחיתה) ───────────────┘  │  │  │  │
                                               ↓  │  │  │
פאזה 6 (תקשורת) ───────────────────────────────┘  │  │  │
                                                   ↓  │  │
פאזה 7 (השקה) ──────────────────────────────────────┘  │
```

**כלל:** אסור להתחיל פאזה לפני שהפאזה שלפניה עמדה בהגדרת ה-Done שלה.

---

## 7. מה חייב לבוא לפני מה

| מה נבנה | מה חייב לבוא לפניו |
|---------|-------------------|
| כל מודול | פאזה 0 (schema + RLS) |
| דשבורד חי | עסקאות + הכנסות אמיתיות |
| תקציב | עסקאות עם `category` מלא |
| הוצאות קבועות | עסקאות עם `recurring_id` + `status` |
| מטרות | עסקאות עם `goal_id` + `saving` type |
| הרשאות ילד | accounts + account_members + pending_approval |
| אונבורדינג מלא | user_profiles + account_settings |
| דף נחיתה מלא | אונבורדינג עובד מקצה לקצה |
| דוחות | כל הנתונים המרכזיים אמיתיים |
| בוט | עסקאות CRUD עובד מלא |

---

## 8. פאזה 0 — מיגרציה ובסיס DB

### מטרה
להכין את תשתית הנתונים שעליה כל שאר הפאזות תלויות.

### משימות

**8א' — שאלת שם הטבלה (החלטה נדרשת)**
- האם לשנות את `transactions` ל-`financial_movements`?
- אם כן — migration עם rename + עדכון כל קוד הקיים
- אם לא — להמשיך עם `transactions` ולהוסיף שדות

**8ב' — הוספת שדות חסרים לטבלת עסקאות**

שדות להוספה:
- `type` — enum: `income` / `expense` / `saving` / `transfer`
- `status` — enum: `actual` / `planned` / `expected` / `pending_approval` / `simulation` / `rejected` / `cancelled`
- `source` — enum: `manual` / `voice` / `chat` / `recurring`
- `account_id` — uuid (לעתיד, כשיהיה accounts table)
- `recurring_id` — uuid nullable
- `goal_id` — uuid nullable
- `submitted_by` — uuid nullable
- `approved_by` — uuid nullable
- `approved_at` — timestamp nullable
- `rejection_note` — text nullable

**8ג' — טבלאות חדשות**
- `accounts` — ראו data-model-spec-v1
- `account_members` — ראו data-model-spec-v1
- `user_profiles` — ראו data-model-spec-v1
- `account_settings` — ראו data-model-spec-v1
- `user_taxonomy` — ראו data-model-spec-v1

**8ד' — RLS**
- עדכון RLS על עסקאות: מ-`user_id = auth.uid()` → `account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())`
- RLS מלא על כל טבלה חדשה

**8ה' — ערכי ברירת מחדל**
- כל עסקה קיימת ב-DB מקבלת `type = 'expense'`, `status = 'actual'`, `source = 'manual'`

### הגדרת Done לפאזה 0
- [ ] כל הטבלות קיימות ב-Supabase
- [ ] RLS מוגדר ונבדק על כל טבלה
- [ ] עסקאות קיימות לא נשברו לאחר migration
- [ ] `npm run build` עובר ללא שגיאות TypeScript

---

## 9. פאזה 1 — ליבת הנתונים

### מטרה
חיבור כל הנתונים המרכזיים לנתונים אמיתיים. המשתמש יוכל לראות דשבורד חי.

### משימות

**9א' — TransactionsPage — עריכה (Edit)**
- פאנל צד לעריכת עסקה קיימת
- כל שדה ניתן לעריכה
- שמירה ב-Supabase + עדכון UI מיידי

**9ב' — TransactionsPage — סינון type**
- הוספת פילטר לפי `type` (הכל / הוצאה / הכנסה / חיסכון / העברה)
- `transfer` מסוים מסיכום הבר

**9ג' — IncomesPage — חיבור אמיתי**
- fetch: `financial_movements` (או `transactions`) עם `type = 'income'`
- הוספה, עריכה, מחיקה
- פירוט לפי מקור (שדה `sub_category` או שדה ייעודי)

**9ד' — DashboardPage — חיבור אמיתי**
- KPI Cards: הכנסות / הוצאות / תזרים נטו — מנתונים אמיתיים
- הון נטו: `₪—` עד שיהיו נכסים / הלוואות (פאזה 3)
- גרף בר: 6 חודשים אמיתיים
- גרף דונאט: קטגוריות אמיתיות
- עסקאות אחרונות: 5 אחרונות אמיתיות
- מחיקת כל hardcoded mock data

**9ה' — ציון בריאות — חישוב בסיסי**
- חישוב client-side לפי 4 תחומים (ראו dashboard-spec-v1)
- מוצג אם יש מספיק נתונים (הכנסות + הוצאות > 0)

**9ו' — צבעי הוצאות — תיקון**
- כל הוצאה בכל מסך בכל ווידג'ט: אדום `#E53E3E`
- כחול שמור לממשק בלבד

### הגדרת Done לפאזה 1
- [ ] עריכת עסקה עובדת מקצה לקצה
- [ ] IncomesPage מחובר לנתונים אמיתיים
- [ ] Dashboard מציג נתונים אמיתיים — אפס mock data
- [ ] הוצאות: אדום בכל מקום; הכנסות: ירוק בכל מקום
- [ ] `npm run build` עובר

---

## 10. פאזה 2 — מודולי ניהול

### מטרה
השלמת מודולי הניהול השוטף: תקציב, הוצאות קבועות, הגדרות.

### משימות

**10א' — BudgetPage**
- יצירת טבלת `budgets` ב-Supabase + RLS
- הגדרת תקציב לפי קטגוריה + חודש
- תצוגת טבלה: מתוכנן / בפועל / הפרש / %
- סטטוס: ירוק / כתום / אדום
- העתקת תקציב מחודש קודם
- חיבור ל-DashboardPage (ווידג'ט סטטוס תקציב)

**10ב' — FixedExpensesPage**
- יצירת טבלת `recurring_expenses` + RLS
- CRUD: הוספה / עריכה / מחיקה
- אישור חודשי: `expected` → `actual`
- חיבור ל-`financial_movements` דרך `recurring_id`

**10ג' — SettingsPage**
- שמירת שם תצוגה, מטבע ב-`user_profiles` + `account_settings`
- הגדרות התראות ב-`notification_preferences`
- ניהול טקסונומיה אישית: הסתרת קטגוריות / הוספת קטגוריות
- ניהול אמצעי תשלום: הסתרה / הוספה

### הגדרת Done לפאזה 2
- [ ] תקציב: הגדרה + מעקב + השוואה לנתונים אמיתיים
- [ ] הוצאות קבועות: CRUD + אישור חודשי עובד
- [ ] הגדרות: כל שינוי נשמר ב-Supabase
- [ ] Dashboard ווידג'ט תקציב: נתונים אמיתיים

---

## 11. פאזה 3 — מודולים פיננסיים

### מטרה
בניית המודולים של הון, חובות, ומטרות — שמשלימים את התמונה הפיננסית.

### משימות

**11א' — LoansPage**
- יצירת טבלת `loans` + RLS
- CRUD מלא
- חישוב לוח סילוקין client-side
- טיפ: איזו הלוואה לסגור קודם
- חיבור ל-KPI "הון נטו" בדשבורד

**11ב' — AssetsPage**
- יצירת טבלת `assets` + RLS
- CRUD מלא + עדכון שווי ידני
- חיבור ל-KPI "הון נטו" בדשבורד

**11ג' — GoalsPage**
- יצירת טבלת `goals` + RLS
- CRUD מלא + פרוגרס בר
- קישור הפקדות: `financial_movements` עם `type = 'saving'` + `goal_id`
- חגיגה ויזואלית ב-100%
- חיבור ל-Dashboard ווידג'ט מטרות

**11ד' — Dashboard — השלמה**
- KPI הון נטו: נכסים − הלוואות (אמיתי)
- ווידג'ט הלוואות: סיכום + "תשלום קרוב"
- ווידג'ט מטרות: עם נתונים אמיתיים
- ציון בריאות: תחום חובות + תחום מטרות מחוברים

### הגדרת Done לפאזה 3
- [ ] הלוואות: CRUD + amortization עובד
- [ ] נכסים: CRUD + שווי מעודכן
- [ ] מטרות: CRUD + הפקדות מקושרות
- [ ] Dashboard: כל 4 KPI Cards מחוברים לנתונים אמיתיים
- [ ] ציון בריאות: מחושב מ-4 תחומים אמיתיים

---

## 12. פאזה 4 — חשבונות מרובים והרשאות

### מטרה
הפעלת חשבון זוגי ומשפחתי עם מבנה הרשאות מלא.

### משימות

**12א' — account structure**
- יצירת `accounts` + `account_members` + RLS מלא
- migration: קישור כל עסקה קיימת ל-`account_id` של ה-owner
- עדכון כל ה-queries ב-app: מ-`user_id` → `account_id`

**12ב' — חשבון זוגי**
- זרם הזמנת שותף: שליחת token / magic link לאימייל
- מסך "ממתין לאישור" עד הצטרפות
- toggle "לפי חבר" בדשבורד
- RLS: שני חברים עם גישה שווה

**12ג' — חשבון משפחתי + הרשאות ילד**
- הוספת ילד לחשבון (שם, תפקיד `child`)
- ברירת מחדל: הגשה בלבד → `pending_approval`
- מצב מתקדם: בקשת עריכה/ביטול → `pending_approval`
- `visibility_config`: הורה מגדיר מה הילד רואה
- UI ילד: דשבורד מוגבל

**12ד' — ווידג'ט אישורים**
- תצוגת כל ה-`pending_approval` לאישור / דחייה
- Badge על ניווט "אישורים"
- `audit_log`: רישום אישור / דחייה

**12ה' — `audit_log`**
- טבלה + RLS
- רישום: create / update / delete / approve / reject על תנועות

### הגדרת Done לפאזה 4
- [ ] חשבון זוגי: הזמנה + הצטרפות + גישה שווה
- [ ] חשבון משפחתי: הוספת ילד + הגבלות
- [ ] ילד מגיש תנועה → pending → הורה מאשר/דוחה
- [ ] ווידג'ט אישורים עובד
- [ ] `audit_log` רושם פעולות

---

## 13. פאזה 5 — אונבורדינג ודף נחיתה

### מטרה
יצירת חוויית כניסה ראשונה מלאה ודף נחיתה שיווקי אמיתי.

### משימות

**13א' — OnboardingPage**
- שלב 1: בחירת סוג חשבון (אישי / זוגי / משפחתי)
- שלב 2: שאלון פרופיל (8 שאלות) + שמירה ב-`user_profiles.profiling_answers`
- שלב 3: בחירת שיטת הזנה מועדפת
- שלב 4: סיור מודרך (4 עצירות, ניתן לדלג)
- שלב 5: צ'קליסט פתיחה + שמירת מצב ב-`user_profiles.checklist_completed_items`
- שמירת `onboarding_step` לצורך המשך מנקודת העצירה

**13ב' — LandingPage — שדרוג**
- כותרת ראשית + כותרת משנה (העתק הסופי)
- שאלון פרופיל מוטמע (מועבר לאונבורדינג אם כבר נרשם)
- מקום לוידאו embed (YouTube / Vimeo — כשהוידאו יהיה מוכן)
- 3–5 כרטיסי יתרון
- אותות אמון ואבטחה
- CTA ראשי + CTA משני
- RTL מלא, עיצוב פרימיום

**13ג' — Personalization**
- דשבורד מראה תובנה אישית ראשונה לפי תשובות הפרופיל
- צ'קליסט מסודר לפי עדיפויות שעלו מהפרופיל

### הגדרת Done לפאזה 5
- [ ] אונבורדינג: 5 שלבים עובדים, מצב נשמר
- [ ] שאלון פרופיל: תשובות נשמרות ב-Supabase
- [ ] LandingPage: תוכן אמיתי, אין placeholder
- [ ] משתמש חדש עובר את כל הזרם מ-Landing → Signup → Onboarding → Dashboard

---

## 14. פאזה 6 — תקשורת ואוטומציה

### מטרה
דוחות, התראות, ובוט — שלב אחרי שכל הנתונים יציבים.

### משימות

**14א' — דוחות**
- דף דוח בתוך האפליקציה (חודשי ראשון)
- יצירת PDF ממותג (ספק: לא נעול עדיין)
- שליחת אימייל עם PDF (ספק: לא נעול עדיין)
- שמירת `reports` ב-DB

**14ב' — התראות**
- תזכורת לפני יום חיוב הוצאה קבועה
- התראה על pending_approval לאישור
- (ספק push / email: לא נעול)

**14ג' — בוט בסיסי**
- פאנל צ'אט נפתח מ-sidebar / FAB
- הזנת עסקה בשפה חופשית → כרטיס אישור → שמירה ב-`financial_movements`
- שאילתות פשוטות: "מה הוצאתי על מסעדות החודש?"
- (מנוע LLM: לא נעול)

### הגדרת Done לפאזה 6
- [ ] דוח חודשי: מוצג בתוך האפליקציה
- [ ] PDF: ניתן להורדה
- [ ] אימייל דוח: נשלח לכתובת הרשומה
- [ ] בוט: הזנת עסקה פשוטה עובדת מקצה לקצה

---

## 15. פאזה 7 — השקה

### מטרה
הכנת המוצר לשימוש ציבורי: billing, analytics, hardening.

### משימות
- מערכת סבסקריפשן (ספק: לא נעול — Stripe / אחר)
- First charge approval flow (אישור מפורש של המשתמש)
- Analytics פנימי (מה משתמשים עושים)
- Error monitoring (Sentry או דומה)
- Performance review: זמני טעינה, query optimization
- אבטחה: rate limiting, input sanitization, RLS audit
- גיבוי נתונים: מדיניות

### הגדרת Done לפאזה 7
- [ ] Billing: subscription flow מקצה לקצה, אישור מפורש לפני חיוב
- [ ] Analytics: events tracking בסיסי
- [ ] Error monitoring: Sentry או דומה מחובר
- [ ] RLS audit: כל טבלה נבדקה ידנית

---

## 16. QA ורגרסיה לפי פאזה

### פאזה 0
- [ ] עסקאות קיימות לא נשברו לאחר migration
- [ ] RLS: user_id לא יכול לראות נתוני user_id אחר
- [ ] שדות חדשים: ערכי ברירת מחדל נכונים

### פאזה 1
- [ ] הוספת עסקה → מופיעה מיד בדשבורד
- [ ] עריכת עסקה → נשמרת ומתעדכנת בכל מקום
- [ ] מחיקת עסקה → נעלמת מדשבורד + רשימה
- [ ] הכנסה: ירוק בכל מקום; הוצאה: אדום בכל מקום

### פאזה 2
- [ ] תקציב מוגדר → מוצג נכון בדשבורד
- [ ] חריגת תקציב → אדום, מוצגת נכון
- [ ] הוצאה קבועה → `expected` → `actual` לאחר אישור

### פאזה 3
- [ ] הלוואה חדשה → מוצגת ב-KPI הון נטו
- [ ] מטרה חדשה → הפקדה מקושרת → % מתעדכן
- [ ] ציון בריאות: מחושב נכון לפי 4 תחומים

### פאזה 4
- [ ] ⚠️ ילד לא יכול לשמור תנועה ישירה — חייב `pending_approval`
- [ ] ⚠️ הורה מאשר → הופך ל-`actual` ומופיע ב-KPI
- [ ] ⚠️ RLS: ילד לא יכול לגשת לנתוני חשבון שאינו חבר בו

### פאזה 5
- [ ] אונבורדינג: מצב נשמר בין sessions
- [ ] שאלון: תשובות גלויות ב-Settings לעריכה

### פאזות 6–7
- [ ] דוח חודשי: כל הנתונים נכונים
- [ ] Billing: לא מתבצע חיוב ללא אישור מפורש
- [ ] Error monitoring: כל שגיאת production מתועדת

---

## 17. הגדרת Done — כללית לכל פאזה

כדי שפאזה תחשב "Done" חייבים:

1. כל המשימות בפאזה מסומנות כהשלמות
2. `npm run build` עובר ללא שגיאות TypeScript
3. אין mock data בעמודים שחוברו לנתונים אמיתיים
4. RLS נבדק ידנית לפחות ל-2 users שונים
5. בדיקה ויזואלית ב-mobile (375px) וב-desktop (1280px)
6. אין errors ב-console בזמן שימוש רגיל

---

## 18. מה ב-V1 מול מה יכול לחכות ל-V1.1

### V1 חובה

| פיצ'ר | פאזה |
|-------|------|
| Auth מלא | ✅ קיים |
| עסקאות CRUD מלא | 1 |
| הכנסות CRUD | 1 |
| Dashboard חי | 1 |
| תקציב | 2 |
| הוצאות קבועות | 2 |
| הגדרות | 2 |
| הלוואות | 3 |
| נכסים | 3 |
| מטרות | 3 |
| חשבון זוגי + הרשאות | 4 |
| חשבון משפחתי + ילדים | 4 |
| אונבורדינג מלא | 5 |
| LandingPage אמיתי | 5 |

### V1.1 — יכול לחכות

| פיצ'ר | סיבה |
|-------|------|
| דוחות PDF + אימייל | ספק לא נעול, תלוי Phase 6 |
| בוט / צ'אט | מנוע לא נעול, תלוי Phase 6 |
| Calculators מחוברים לנתונים | Phase 4 נדרש לפני |
| Guides (מדריכים) | תוכן, לא קוד — ניתן לאחר launch |
| Billing / Subscription | Phase 7 |
| Analytics | Phase 7 |
| ייבוא נתונים (Excel) | לא הוגדר בV1 |
| Google SSO | תלוי בהחלטת Auth |

---

## 19. ספרינט קידוד ראשון מומלץ — לאחר מסמך זה

### מה לעשות ראשון (סדר מדויק)

**יום 1–2: פאזה 0 — migration ו-schema**
1. הוספת שדות חסרים לטבלת `transactions` (`type`, `status`, `source`, `account_id`)
2. ערכי ברירת מחדל לשורות קיימות: `type='expense'`, `status='actual'`
3. יצירת `accounts` + `account_members` + `user_profiles` + `account_settings`
4. RLS על כל הטבלות החדשות
5. עדכון TypeScript types לכל הטבלות

**יום 3–4: פאזה 1 — עריכת עסקה**
1. פאנל צד לעריכה ב-TransactionsPage
2. שמירה ב-Supabase + עדכון UI

**יום 5: פאזה 1 — IncomesPage**
1. fetch אמיתי: `type = 'income'`
2. הוספה, עריכה, מחיקה

**יום 6–7: פאזה 1 — DashboardPage**
1. החלפת כל hardcoded mock data בנתונים אמיתיים
2. KPI Cards: הכנסות, הוצאות, תזרים (הון נטו ישאר `—`)
3. גרף בר + דונאט: נתונים אמיתיים
4. עסקאות אחרונות: אמיתיות
5. תיקון צבעים: אדום להוצאות בכל מקום

**תוצאה צפויה בסוף ספרינט ראשון:**
- מוצר עם auth + CRUD מלא לעסקאות + הכנסות + dashboard חי
- אפס mock data בעמודים שנגענו בהם

---

## 20. החלטות פתוחות שמצריכות אישור לפני יישום

| # | שאלה | מחסום ל |
|---|------|---------|
| 1 | שם הטבלה: `transactions` → `financial_movements`? | פאזה 0 |
| 2 | ציון בריאות: client-side / server-side / cached? | פאזה 1 |
| 3 | מנגנון הזמנה: token בDB / magic link / קוד קצר? | פאזה 4 |
| 4 | `user_taxonomy`: שיתוף לכל חברי חשבון / פרטי לחבר? | פאזה 2 |
| 5 | מי יוצר תנועות `expected` מהוצאות קבועות: cron / trigger / ידנית? | פאזה 2 |
| 6 | האם שיחות בוט נשמרות ב-DB? | פאזה 6 |
| 7 | ספק אימייל לדוחות: Resend / SendGrid / אחר? | פאזה 6 |
| 8 | ספק PDF: server-side / client-side? | פאזה 6 |
| 9 | מנוע בוט: ספק LLM? | פאזה 6 |
| 10 | ספק billing: Stripe / אחר? | פאזה 7 |
| 11 | Google SSO: V1 או V1.1? | פאזה 0 / 7 |
| 12 | גיל מינימלי לחבר ילד + UI שונה לפי גיל? | פאזה 4 |
