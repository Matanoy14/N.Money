> ⚠️ HISTORICAL — Superseded by DATA_MODEL.md. Key difference: table is now `financial_movements` (not `transactions`). Use DATA_MODEL.md for all implementation work.

> This document defines the approved V1 data model and permissions architecture for N.Money.

---

# מפרט מודל נתונים והרשאות V1 — N.Money

---

## 1. מטרת מסמך זה

מסמך זה מגדיר את ארכיטקטורת הנתונים המלאה של N.Money V1 — הישויות, הקשרים ביניהן, לוגיקת ההרשאות, וכללי הנראות — כך שיישום עתידי יהיה עקבי, בטוח, וללא סתירות פנימיות.

**מה המסמך לא כולל:**
- קוד SQL
- הגדרות Supabase ספציפיות
- schema migrations

---

## 2. רשימת ישויות ליבה

| ישות | שם לוגי | תיאור |
|------|----------|-------|
| חשבון | `accounts` | יחידת הניהול — אישי / זוגי / משפחתי |
| משתמש | `users` (Supabase Auth) | זהות המשתמש, אימות |
| חבר חשבון | `account_members` | קשר בין משתמש לחשבון + תפקיד |
| תנועה פיננסית | `financial_movements` | ישות קנונית אחת לכל תנועת כסף |
| תקציב | `budgets` | תקציב חודשי לפי קטגוריה |
| הוצאה קבועה | `recurring_expenses` | הגדרת הוצאה חוזרת חודשית |
| הלוואה | `loans` | הלוואות והתחייבויות |
| נכס | `assets` | נכסים פיננסיים ורכוש |
| מטרה | `goals` | יעד פיננסי עם התקדמות |
| פרופיל משתמש | `user_profiles` | תשובות שאלון, העדפות, סוג עוסק |
| הגדרות חשבון | `account_settings` | העדפות דשבורד, מטבע, התראות |
| טקסונומיה אישית | `user_taxonomy` | קטגוריות / תת-קטגוריות / אמצעי תשלום שהמשתמש הוסיף/הסתיר |
| דוח | `reports` | מטה-דטה על דוחות שנוצרו |
| העדפות אימייל | `notification_preferences` | תדירות ותוכן התראות |
| היסטוריית שינויים | `audit_log` | רישום שינויים לצורך ביקורת |

---

## 3. מבנה חשבון

### 3א' — חשבון אישי (`type = 'personal'`)

- בעלים יחיד (`owner`)
- כל הנתונים שייכים לאותו `account_id`
- אין הזמנות, אין הרשאות מרובות
- RLS: רק ה-`owner` ניגש לנתונים

### 3ב' — חשבון זוגי (`type = 'couple'`)

- `owner` אחד + `partner` אחד
- שניהם עם הרשאות שוות ומלאות
- `owner` מזמין `partner` באמצעות אימייל
- עד השלמת ההזמנה: החשבון פעיל ל-`owner` בלבד
- RLS: גישה לכל נתוני החשבון לשני החברים

### 3ג' — חשבון משפחתי (`type = 'family'`)

- `owner` אחד (ההורה הראשון שנרשם)
- `partner` אחד אופציונלי (בן/בת זוג — הרשאות שוות ל-`owner`)
- ילדים: כמות לא מוגבלת עם תפקיד `child`
- RLS: ראו סעיף 20 — כללי נראות לפי תפקיד

---

## 4. משתמשים, חברי חשבון, וקשרים

### `users` (Supabase Auth)

שדות:
- `id` (uuid — auth.users.id)
- `email`
- `created_at`

### `account_members`

טבלת חיבור בין `users` ל-`accounts`.

שדות:

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | מזהה |
| `account_id` | uuid → accounts | החשבון |
| `user_id` | uuid → auth.users | המשתמש |
| `role` | enum | `owner` / `partner` / `child` |
| `display_name` | text | שם תצוגה בתוך החשבון |
| `avatar_url` | text | אופציונלי |
| `invited_by` | uuid → users | מי הזמין |
| `invited_at` | timestamp | |
| `joined_at` | timestamp | מתי הצטרף בפועל |
| `status` | enum | `active` / `pending_invite` / `removed` |
| `child_advanced_mode` | boolean | האם מצב מתקדם הופעל עבור ילד |
| `visibility_config` | jsonb | מה הילד רואה (הורה מגדיר) |
| `created_at` | timestamp | |

### `accounts`

שדות:

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | מזהה |
| `type` | enum | `personal` / `couple` / `family` |
| `name` | text | שם תצוגה (לדוגמה: "המשפחה שלי") |
| `currency` | text | ברירת מחדל: `ILS` |
| `created_at` | timestamp | |
| `created_by` | uuid → users | ה-`owner` המייסד |

### קשרים מרכזיים

```
users ←── account_members ──→ accounts
                │
           (role, status, visibility_config)
```

- משתמש יכול להיות חבר ביותר מחשבון אחד (לדוגמה: ילד בחשבון משפחה + חשבון אישי עצמאי בעתיד)
- כל תנועה פיננסית שייכת ל-`account_id` ול-`user_id` (מי הזין)

---

## 5. תפקידים והרשאות

### טבלת הרשאות מלאה

| פעולה | owner | partner | child (ברירת מחדל) | child (מצב מתקדם) |
|-------|-------|---------|-------------------|-------------------|
| קריאת כל נתוני החשבון | ✓ | ✓ | לפי `visibility_config` | לפי `visibility_config` |
| הוספת תנועה (`actual`) | ✓ | ✓ | ✗ | ✗ |
| הגשת תנועה (`pending_approval`) | — | — | ✓ | ✓ |
| עריכת תנועה קיימת | ✓ | ✓ | ✗ | ✗ |
| בקשת עריכה / ביטול | — | — | ✗ | ✓ (→ pending) |
| מחיקת תנועה | ✓ | ✓ | ✗ | ✗ |
| אישור / דחיית pending | ✓ | ✓ | ✗ | ✗ |
| ניהול תקציב | ✓ | ✓ | ✗ | ✗ |
| ניהול הוצאות קבועות | ✓ | ✓ | ✗ | ✗ |
| ניהול הלוואות | ✓ | ✓ | ✗ | ✗ |
| ניהול נכסים | ✓ | ✓ | ✗ | ✗ |
| ניהול מטרות | ✓ | ✓ | ✗ | ✗ |
| הזמנת חברים | ✓ | ✓ | ✗ | ✗ |
| שינוי הרשאות ילד | ✓ | ✓ | ✗ | ✗ |
| עריכת הגדרות חשבון | ✓ | ✓ | ✗ | ✗ |

### כלל מוחלט — ילד

> ילד לעולם אינו מבצע שינוי ישיר על נתוני האמת. כל פעולה של ילד נכנסת לסטטוס `pending_approval` ומחכה לאישור `owner` או `partner`. אין יוצא מן הכלל.

---

## 6. מודל האישורים

### מצבים אפשריים לתהליך אישור

| סטטוס | מי יוצר | מי מטפל | משמעות |
|--------|---------|---------|--------|
| `pending_approval` | ילד (הגשה) | owner / partner | ממתין לאישור |
| `actual` | owner / partner (אישור) | — | אושר ונכנס לנתוני אמת |
| `rejected` | owner / partner (דחייה) | — | נדחה, לא נכנס לנתונים |
| `cancelled` | כל מי שהגיש (לפני אישור) | — | בוטל על ידי המגיש |

### תהליך אישור תנועה של ילד

```
ילד מגיש תנועה
  → נוצרת תנועה עם status = 'pending_approval'
  → הורה מקבל badge / התראה
  → הורה רואה בווידג'ט האישורים
  → הורה לוחץ "אשר" → status = 'actual'
  → הורה לוחץ "דחה" → status = 'rejected' + optional note
```

### תהליך בקשת עריכה / ביטול (מצב מתקדם)

```
ילד לוחץ "בקש עריכה" על תנועה קיימת
  → נוצרת רשומת approval_request עם הפרטים המבוקשים
  → status של רשומת הבקשה = 'pending_approval'
  → ההורה מאשר → השינוי מוחל על התנועה המקורית
  → ההורה דוחה → התנועה המקורית לא משתנה
```

### שדות נוספים על `financial_movements` לתמיכה באישורים

| שדה | תיאור |
|-----|-------|
| `submitted_by` | user_id של מי שהגיש (ילד) |
| `approved_by` | user_id של המאשר |
| `approved_at` | זמן האישור |
| `rejection_note` | הסבר אופציונלי לדחייה |

---

## 7. מודל תנועות פיננסיות (`financial_movements`)

### עיקרון קנוני

כל ערך כספי במערכת — הכנסה, הוצאה, חיסכון, העברה — הוא שורה אחת ב-`financial_movements`. אין טבלאות נפרדות לסוגים שונים.

### שדות מלאים

| שדה | סוג | חובה | תיאור |
|-----|-----|------|-------|
| `id` | uuid | ✓ | מזהה ייחודי |
| `account_id` | uuid → accounts | ✓ | החשבון |
| `user_id` | uuid → users | ✓ | מי הזין |
| `submitted_by` | uuid → users | — | מי הגיש (ילד) |
| `approved_by` | uuid → users | — | מי אישר |
| `approved_at` | timestamp | — | |
| `rejection_note` | text | — | הסבר דחייה |
| `type` | enum | ✓ | `income` / `expense` / `saving` / `transfer` |
| `status` | enum | ✓ | ראו סעיף 8 |
| `amount` | numeric | ✓ | חיובי תמיד |
| `currency` | text | ✓ | ברירת מחדל: `ILS` |
| `date` | date | ✓ | תאריך התנועה |
| `description` | text | ✓ | תיאור חופשי |
| `category` | text | — | שם קטגוריה |
| `sub_category` | text | — | שם תת-קטגוריה |
| `payment_method` | text | — | אמצעי תשלום |
| `source` | enum | ✓ | `manual` / `voice` / `chat` / `recurring` |
| `recurring_id` | uuid → recurring_expenses | — | קשר להוצאה קבועה |
| `goal_id` | uuid → goals | — | קשר למטרה (עבור saving) |
| `transfer_to_account` | uuid → accounts | — | יעד העברה (עבור transfer) |
| `notes` | text | — | הערות נוספות |
| `is_simulation` | boolean | ✓ | ברירת מחדל: false |
| `created_at` | timestamp | ✓ | |
| `updated_at` | timestamp | ✓ | |

### כלל `amount`

`amount` הוא תמיד מספר חיובי. הסימן (חיוב/זיכוי) נגזר מהשדה `type` ומההקשר:
- `income` → נכנס (זיכוי)
- `expense` / `saving` → יוצא (חיוב)
- `transfer` → ניטרלי לצורך KPI

---

## 8. לוגיקת סטטוס תנועה

### ערכי `status` וזרימה

```
planned ──────────────────────────────→ actual
                                         ↑
expected ──→ (אישור חודשי של הורה) ──→ actual
                                         ↑
[ילד מגיש] → pending_approval ──────→ actual (הורה אישר)
                                  └──→ rejected (הורה דחה)
                                  └──→ cancelled (ילד ביטל לפני אישור)

actual ──→ cancelled (owner/partner מחק)
```

### הגדרה לכל סטטוס

| סטטוס | מי יוצר | משפיע על KPI? | תיאור |
|--------|---------|-------------|-------|
| `planned` | owner / partner | ✗ | תוכנן, טרם בוצע |
| `expected` | מחזוריות אוטומטית | ✗ | הוצאה קבועה ממתינה לאישור חודשי |
| `actual` | כולם (לאחר אישור) | ✓ | בוצע בפועל — נכנס לחישובים |
| `pending_approval` | ילד | ✗ | ממתין לאישור הורה |
| `simulation` | מחשבונים | ✗ | חישוב היפותטי |
| `rejected` | הורה / מאשר | ✗ | נדחה |
| `cancelled` | כל מי שיוצר | ✗ | בוטל |

**כלל דשבורד:** KPI Cards, גרפים, ציון בריאות — מחושבים רק מתנועות עם `status = 'actual'` ו-`is_simulation = false`.

---

## 9. כללי קישור טקסונומיה

### קטגוריה ותת-קטגוריה

- קטגוריות ותת-קטגוריות **אינן** טבלה נפרדת ב-V1 — הן ערכי טקסט חופשיים בשדות `category` ו-`sub_category`
- הטקסונומיה המוגדרת ב-`docs/taxonomy-v1.md` היא **רשימת ברירת מחדל** — מוצגת ב-UI כ-dropdown מוגדר מראש
- המשתמש יכול לבחור מהרשימה או להקליד ידנית (קטגוריה מותאמת אישית)

### `user_taxonomy`

טבלה לשמירת התאמות אישיות לכל `account_member`:

| שדה | תיאור |
|-----|-------|
| `id` | uuid |
| `account_id` | uuid |
| `user_id` | uuid |
| `type` | `category` / `sub_category` / `payment_method` |
| `action` | `add` / `hide` |
| `value` | הערך (שם הקטגוריה / אמצעי התשלום) |
| `parent_category` | עבור תת-קטגוריה — לאיזו קטגוריה היא שייכת |
| `created_at` | timestamp |

### אמצעי תשלום

- רשימת ברירת מחדל מוגדרת ב-`docs/taxonomy-v1.md`
- מאוחסן בשדה `payment_method` כטקסט
- המשתמש יכול להסתיר / להוסיף דרך `user_taxonomy`

---

## 10. מודל תקציב (`budgets`)

### עיקרון
תקציב מוגדר לפי חשבון + חודש + קטגוריה. ניתן להגדיר תקציב ברמת קטגוריה ראשית, תת-קטגוריה, או שניהם.

### שדות

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | |
| `account_id` | uuid → accounts | |
| `month` | date | תמיד יום 1 לחודש (לדוגמה: `2026-03-01`) |
| `category` | text | שם קטגוריה |
| `sub_category` | text | אופציונלי |
| `planned_amount` | numeric | הסכום המתוכנן |
| `currency` | text | ברירת מחדל: `ILS` |
| `created_by` | uuid → users | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### חישוב בפועל

"בפועל" = Σ `financial_movements` עם `category` תואם + `status = 'actual'` + `date` בחודש + `type IN ('expense', 'saving')`

החישוב מתבצע בזמן ריצה — לא נשמר בטבלה.

---

## 11. מודל הוצאות קבועות (`recurring_expenses`)

### עיקרון
הוצאה קבועה היא **הגדרה** — לא עצמה תנועה. בתחילת כל חודש נוצרות ממנה תנועות בסטטוס `expected`, שהורה מאשר להפוך ל-`actual`.

### שדות

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | |
| `account_id` | uuid | |
| `created_by` | uuid → users | |
| `name` | text | שם ההוצאה |
| `category` | text | |
| `sub_category` | text | אופציונלי |
| `payment_method` | text | |
| `amount` | numeric | |
| `currency` | text | |
| `billing_day` | integer | יום בחודש (1–31) |
| `status` | enum | `active` / `paused` / `cancelled` |
| `start_date` | date | מתי מתחילה |
| `end_date` | date | אופציונלי — מתי מסתיימת |
| `notes` | text | |
| `created_at` | timestamp | |

### יצירת תנועות מחזוריות

בתחילת כל חודש: עבור כל `recurring_expense` עם `status = 'active'`, נוצרת תנועה ב-`financial_movements` עם:
- `type = 'expense'`
- `status = 'expected'`
- `recurring_id` = ה-`id` של ההגדרה

מי שמחליט מתי/איך זה מתרחש (cron / trigger / ידנית) — ייקבע בפאזת היישום.

---

## 12. מודל הלוואות (`loans`)

### שדות

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | |
| `account_id` | uuid | |
| `created_by` | uuid → users | |
| `name` | text | שם ההלוואה |
| `lender` | text | שם המלווה |
| `loan_type` | enum | `mortgage` / `bank` / `non_bank` / `credit_line` / `private` / `leasing` / `other` |
| `original_amount` | numeric | סכום מקורי |
| `current_balance` | numeric | יתרה נוכחית |
| `monthly_payment` | numeric | תשלום חודשי |
| `interest_rate` | numeric | ריבית שנתית (%) |
| `months_remaining` | integer | חודשים שנותרו |
| `start_date` | date | תחילת ההלוואה |
| `end_date` | date | תאריך סיום משוער |
| `status` | enum | `active` / `completed` / `frozen` |
| `currency` | text | |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### חישוב לוח סילוקין

מחושב בזמן ריצה לפי `current_balance` + `interest_rate` + `monthly_payment`. לא נשמר בטבלה.

---

## 13. מודל נכסים (`assets`)

### שדות

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | |
| `account_id` | uuid | |
| `created_by` | uuid → users | |
| `name` | text | שם הנכס |
| `asset_type` | enum | `real_estate` / `vehicle` / `keren_hishtalmut` / `kupat_gemel` / `pension` / `investment_portfolio` / `liquid_savings` / `other` |
| `current_value` | numeric | שווי נוכחי |
| `purchase_value` | numeric | עלות רכישה / שווי בסיס |
| `currency` | text | |
| `last_updated` | date | מתי עודכן השווי לאחרונה |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### חישוב הון נטו

`הון נטו = Σ current_value (assets) − Σ current_balance (loans active)`

מחושב בזמן ריצה.

---

## 14. מודל מטרות (`goals`)

### שדות

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid | |
| `account_id` | uuid | |
| `created_by` | uuid → users | |
| `assigned_to_member` | uuid → account_members | אופציונלי — מטרה לחבר ספציפי (ילד) |
| `name` | text | שם המטרה |
| `goal_type` | enum | `personal` / `couple` / `family` / `child` |
| `target_amount` | numeric | |
| `saved_amount` | numeric | סכום שנחסך עד כה |
| `monthly_contribution` | numeric | הפקדה חודשית מתוכננת |
| `target_date` | date | אופציונלי |
| `priority` | enum | `high` / `normal` / `low` |
| `status` | enum | `active` / `completed` / `paused` / `archived` |
| `currency` | text | |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### קישור הפקדות

תנועה מסוג `saving` עם `goal_id` מקושרת למטרה.
`saved_amount` = Σ `financial_movements` עם `goal_id` תואם + `status = 'actual'` + `type = 'saving'`.

---

## 15. מודל דוחות והעדפות אימייל

### `reports`

| שדה | תיאור |
|-----|-------|
| `id` | uuid |
| `account_id` | uuid |
| `report_type` | `weekly` / `monthly` / `annual` |
| `period_start` | date |
| `period_end` | date |
| `generated_at` | timestamp |
| `pdf_url` | כתובת ה-PDF שנוצר (אחסון פנימי) |
| `sent_by_email` | boolean |
| `sent_at` | timestamp |

### `notification_preferences`

| שדה | תיאור |
|-----|-------|
| `id` | uuid |
| `account_member_id` | uuid → account_members |
| `weekly_report_enabled` | boolean |
| `monthly_report_enabled` | boolean |
| `annual_report_enabled` | boolean |
| `report_email` | text — כתובת לשליחת דוחות |
| `reminder_before_billing_day` | integer — כמה ימים לפני |
| `pending_approvals_notify` | boolean |
| `updated_at` | timestamp |

---

## 16. מודל פרופיל ואונבורדינג

### `user_profiles`

| שדה | סוג | תיאור |
|-----|-----|-------|
| `id` | uuid → users | אותו id כמו ה-user |
| `account_id` | uuid | החשבון הראשי |
| `display_name` | text | |
| `employment_type` | enum | `salaried` / `self_employed` / `other` |
| `onboarding_completed` | boolean | |
| `onboarding_step` | integer | שלב שבו עצר (לשמירת מצב) |
| `profiling_answers` | jsonb | תשובות שאלון הפרופיל |
| `preferred_input_method` | enum | `manual` / `voice` / `chat` / `mixed` |
| `checklist_completed_items` | jsonb | array של פריטי צ'קליסט שהושלמו |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `account_settings`

| שדה | תיאור |
|-----|-------|
| `id` | uuid → accounts |
| `currency` | ברירת מחדל: `ILS` |
| `timezone` | ברירת מחדל: `Asia/Jerusalem` |
| `updated_at` | timestamp |

---

## 17. מודל קלט בוט/צ'אט

**בV1 הבוט הוא UI בלבד** — הוא לא מחזיק טבלת DB נפרדת לשיחות.

הזרימה:
1. משתמש כותב בצ'אט → הלוגיקה מפרשת את הכוונה
2. אם זוהתה עסקה → מוצג כרטיס עסקה לאישור מפורש
3. לאחר אישור → נוצרת תנועה ב-`financial_movements` עם `source = 'chat'`

**אין** שמירת היסטוריית שיחות ב-DB בV1. ההיסטוריה קיימת רק ב-session (בזיכרון הדפדפן). ראו סעיף 22 — החלטות פתוחות.

---

## 18. היסטוריית שינויים (`audit_log`)

### עיקרון

כל שינוי בנתוני אמת (`financial_movements` בסטטוס `actual`) נרשם ב-`audit_log`. זה לא אפשרות ביטול (Undo) — זה תיעוד לצורך שקיפות ואמינות.

### שדות

| שדה | תיאור |
|-----|-------|
| `id` | uuid |
| `account_id` | uuid |
| `actor_user_id` | מי ביצע את השינוי |
| `entity_type` | `financial_movement` / `goal` / `loan` / `asset` |
| `entity_id` | uuid של הרשומה שהשתנתה |
| `action` | `create` / `update` / `delete` / `approve` / `reject` |
| `before_snapshot` | jsonb — מצב לפני השינוי |
| `after_snapshot` | jsonb — מצב אחרי השינוי |
| `created_at` | timestamp |

### מה נרשם בV1

- יצירת תנועה חדשה (`create`)
- עריכת תנועה (`update`)
- מחיקת תנועה (`delete`)
- אישור / דחיית pending (`approve` / `reject`)

### מה לא נרשם בV1

- שינויים בהגדרות חשבון
- עדכוני פרופיל
- עדכוני תקציב

---

## 19. תלויות נתוני הדשבורד

הדשבורד מחושב **בזמן ריצה** — אין cache ייעודי בV1.

| רכיב דשבורד | טבלות נדרשות | פילטרים |
|-------------|-------------|---------|
| KPI הכנסות | `financial_movements` | type=income, status=actual, date בחודש |
| KPI הוצאות | `financial_movements` | type IN (expense, saving), status=actual, date בחודש |
| KPI תזרים נטו | `financial_movements` | הכל חוץ מ-transfer, status=actual |
| KPI הון נטו | `assets` + `loans` | assets.current_value − loans.current_balance |
| גרף בר | `financial_movements` | 6 חודשים אחרונים, status=actual |
| גרף דונאט | `financial_movements` | type=expense, status=actual, חודש נבחר |
| סטטוס תקציב | `budgets` + `financial_movements` | חודש נבחר |
| מטרות | `goals` + `financial_movements` | status=active, goal_id |
| הלוואות | `loans` | status=active |
| עסקאות אחרונות | `financial_movements` | status=actual, 5 אחרונות |
| אישורים | `financial_movements` | status=pending_approval |
| ציון בריאות | `financial_movements` + `budgets` + `loans` + `goals` | חודש נבחר |
| תובנות | `financial_movements` + `budgets` + `goals` | חישוב rule-based |

---

## 20. עקרונות RLS ונראות — רמת מוצר

### עיקרון-על

> שורה ב-DB נגישה למשתמש אם ורק אם הוא חבר פעיל (`status = 'active'`) ב-`account_members` של אותו `account_id`.

### כללי נראות לפי תפקיד

| נתון | owner | partner | child (ברירת מחדל) | child (מצב מתקדם) |
|------|-------|---------|-------------------|-------------------|
| כל התנועות (`actual`) | ✓ | ✓ | לפי `visibility_config` | לפי `visibility_config` |
| תנועות `pending_approval` | ✓ (כולל של ילדים) | ✓ | רק שלו עצמו | רק שלו עצמו |
| הכנסות | ✓ | ✓ | ✗ (ברירת מחדל) | ✗ (ברירת מחדל) |
| הלוואות | ✓ | ✓ | ✗ (ברירת מחדל) | ✗ (ברירת מחדל) |
| נכסים | ✓ | ✓ | ✗ (ברירת מחדל) | ✗ (ברירת מחדל) |
| תקציב | ✓ | ✓ | ✗ (ברירת מחדל) | ✗ (ברירת מחדל) |
| מטרות | ✓ | ✓ | רק מטרות שהוקצו לו | רק מטרות שהוקצו לו |
| `audit_log` | ✓ | ✓ | ✗ | ✗ |

### `visibility_config`

שדה jsonb ב-`account_members` שה-`owner`/`partner` מגדיר לכל ילד.

```
דוגמה (לא קוד):
{
  "show_categories": ["מזון", "בילוי", "ספורט"],
  "show_months": "current_only",
  "show_incomes": false,
  "show_loans": false,
  "show_assets": false
}
```

---

## 21. לוגיקת נתונים ריקים / חלקיים / ממתינים

### נתונים ריקים

| מצב | התנהגות |
|-----|---------|
| אין תנועות לחודש | KPI Cards מציגים `₪0` — לא שגיאה |
| אין תקציב מוגדר | ווידג'ט תקציב מציג empty state + CTA |
| אין מטרות | ווידג'ט מטרות מציג empty state + CTA |
| אין הלוואות | ווידג'ט הלוואות מוסתר לחלוטין |
| אין נכסים | KPI הון נטו מציג `—` |

### נתונים חלקיים

- אם הכנסות = 0 → ציון בריאות לא מחושב (מחסור בנתון בסיס)
- אם מטרה ללא `target_date` → "חודשים שנותרו" לא מוצג
- אם הלוואה ללא `interest_rate` → לוח סילוקין לא מחושב

### נתונים ממתינים (`pending_approval`)

- **אינם** נכנסים לחישובי KPI, גרפים, ציון בריאות
- **כן** מוצגים בווידג'ט אישורים ובפיד הילד עצמו
- **כן** רשומים ב-`audit_log` ברגע הגשה

---

## 22. החלטות פתוחות שמצריכות אישור

| # | שאלה | תחום |
|---|------|-------|
| 1 | שם הטבלה הקנוני: `financial_movements` או `transactions`? הנוכחית נקראת `transactions` | DB migration |
| 2 | האם ציון הבריאות מחושב client-side, server-side (Edge Function), או מאוחסן ומתעדכן periodically? | ארכיטקטורה |
| 3 | מי אחראי על יצירת תנועות `expected` מחוזרות בתחילת חודש — cron job, DB trigger, או פעולה ידנית? | אוטומציה |
| 4 | האם `user_taxonomy` (קטגוריות מותאמות) משותפת לכל חברי החשבון, או פרטית לכל חבר? | הרשאות |
| 5 | האם `audit_log` נשמר לצמיתות, או מנוקה לאחר תקופה? | storage |
| 6 | האם שיחות הבוט נשמרות ב-DB בV1? ואם כן — כמה זמן? | bot architecture |
| 7 | מה ספק שליחת האימייל לדוחות? | Phase 5 |
| 8 | האם PDF נוצר בצד שרת (Edge Function) או בצד לקוח? | Phase 5 |
| 9 | מה מנגנון הזמנת שותף / ילד — token בטבלת DB, magic link, או קוד קצר? | auth |
| 10 | האם משתמש יכול להיות חבר ביותר מחשבון אחד בV1? | account model |
| 11 | האם `visibility_config` של ילד מאפשר granularity ברמת קטגוריה / חודש / סכום מקסימלי? | permissions model |
| 12 | מה קורה לנתונים אם `owner` עוזב / מוחק חשבון? האם ה-`partner` הופך ל-`owner`? | edge case |
