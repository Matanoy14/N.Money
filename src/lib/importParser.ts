/**
 * importParser.ts — Unified CSV + XLSX import parser for N.Money
 *
 * Parses .xlsx, .xls, and .csv files into normalized ImportRow arrays.
 * Auto-detects column positions from common Hebrew/English header names.
 * Falls back to manual column mapping if required columns are not found.
 */

import type { PaymentSource } from './paymentMethods';
import { SOURCE_TYPE_TO_PM } from './paymentMethods';
import { EXPENSE_CATEGORIES } from './categories';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColMap {
  dateIdx:   number;  // -1 = not detected
  amountIdx: number;
  typeIdx:   number;
  descIdx:   number;
  catIdx:    number;
  pmIdx:     number;
  notesIdx:  number;
}

export interface ParsedFile {
  headers: string[];
  rows:    string[][];
  error?:  string;
}

export interface ImportRow {
  raw:            string[];
  date:           string;
  type:           'expense' | 'income';
  description:    string;
  amount:         number;
  category:       string;
  payment_method: string;
  notes:          string;
  valid:          boolean;
  errors:         string[];
}

// ── File Parsing ─────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSX(file);
  }
  return parseCSV(file);
}

async function parseXLSX(file: File): Promise<ParsedFile> {
  try {
    // Dynamic import keeps xlsx out of the initial bundle
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false, dateNF: 'yyyy-mm-dd' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { headers: [], rows: [], error: 'הגיליון הראשון ריק' };

    const data = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    // Skip leading empty rows
    const firstNonEmpty = data.findIndex((r: string[]) => r.some((c: unknown) => String(c ?? '').trim()));
    if (firstNonEmpty < 0) return { headers: [], rows: [], error: 'הקובץ ריק' };

    const headers = (data[firstNonEmpty] as unknown[]).map((c) => String(c ?? '').trim());
    const rows: string[][] = (data.slice(firstNonEmpty + 1) as unknown[][])
      .filter((r: unknown[]) => r.some((c) => String(c ?? '').trim()))
      .map((r: unknown[]) => headers.map((_, i) => String((r as unknown[])[i] ?? '').trim()));

    return { headers, rows };
  } catch {
    return { headers: [], rows: [], error: 'שגיאה בקריאת קובץ ה-Excel — ייתכן שהקובץ פגום' };
  }
}

async function parseCSV(file: File): Promise<ParsedFile> {
  try {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(String(e.target?.result ?? '').replace(/^\uFEFF/, ''));
      reader.onerror = () => reject(new Error('read error'));
      reader.readAsText(file, 'UTF-8');
    });
    const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return { headers: [], rows: [], error: 'הקובץ ריק או אין שורות נתונים' };
    const headers = splitCSVRow(lines[0]);
    const rows    = lines.slice(1, 1001).map(splitCSVRow);
    return { headers, rows };
  } catch {
    return { headers: [], rows: [], error: 'שגיאה בקריאת הקובץ' };
  }
}

function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let inQ = false;
  let cur = '';
  for (const ch of line) {
    if (ch === '"')          { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else                     { cur += ch; }
  }
  result.push(cur.trim());
  return result.map((c) => c.replace(/^"|"$/g, '').trim());
}

// ── Column Auto-Detection ────────────────────────────────────────────────────

export function detectColMap(headers: string[]): ColMap {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const find = (...kws: string[]) =>
    lc.findIndex((h) => kws.some((k) => h.includes(k.toLowerCase())));

  return {
    dateIdx:   find('date', 'תאריך', 'datum', 'תאריך ערך', 'value date', 'transaction date'),
    amountIdx: find('amount', 'סכום', 'sum', 'price', 'מחיר', 'total', 'כסף',
                    'credit', 'זיכוי', 'debit', 'חיוב', 'שקל', 'nis', 'inr', 'eur', 'usd'),
    typeIdx:   find('type', 'סוג', 'direction', 'כיוון', 'in/out', 'תנועה', 'תיאור סוג'),
    descIdx:   find('description', 'תיאור', 'memo', 'detail', 'פרטים', 'name',
                    'שם', 'עסק', 'מוסד', 'payee', 'narrative', 'beneficiary'),
    catIdx:    find('category', 'קטגוריה', 'cat', 'topic', 'נושא', 'classification', 'tag'),
    pmIdx:     find('payment', 'תשלום', 'אמצעי', 'source', 'מקור', 'method',
                    'card', 'כרטיס', 'account', 'חשבון', 'instrument'),
    notesIdx:  find('notes', 'הערות', 'remarks', 'comment', 'הערה', 'note', 'info'),
  };
}

/** Returns true if the two required columns (date, amount) were detected */
export function requiredDetected(map: ColMap): boolean {
  return map.dateIdx >= 0 && map.amountIdx >= 0;
}

// ── Row Building ─────────────────────────────────────────────────────────────

export function buildImportRows(
  headers: string[],
  rows: string[][],
  map: ColMap,
  sources: PaymentSource[],
): ImportRow[] {
  return rows.map((r) => {
    const errors: string[] = [];
    const get = (idx: number) => (idx >= 0 && idx < r.length ? (r[idx] ?? '') : '');

    // ── Date ─────────────────────────────────────────────────────────────────
    let date = get(map.dateIdx).trim();
    // Normalize common date formats → YYYY-MM-DD
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
      const [d, m, y] = date.split('/');
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(date)) {
      const [d, m, y] = date.split('.');
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(date)) {
      const [d, m, y] = date.split('-');
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Excel serial date (e.g. "45000")
    if (/^\d{4,6}$/.test(date)) {
      try {
        const ms = (parseInt(date, 10) - 25569) * 86400000;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
      } catch { /* keep as-is */ }
    }
    if (!date)                              errors.push('חסר תאריך');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`תאריך לא תקין: "${get(map.dateIdx)}"`);

    // ── Amount ────────────────────────────────────────────────────────────────
    const rawAmt   = get(map.amountIdx);
    // Strip currency symbols, LTR/RTL marks, thousands separators
    const cleanAmt = rawAmt.replace(/[₪,$€£\s,\u200f\u200e\u00a0]/g, '');
    const rawNum   = parseFloat(cleanAmt);
    const amount   = isNaN(rawNum) ? 0 : Math.abs(rawNum);
    if (!rawAmt.trim())    errors.push('חסר סכום');
    else if (isNaN(rawNum)) errors.push(`סכום לא תקין: "${rawAmt}"`);
    else if (amount === 0) errors.push('סכום לא יכול להיות אפס');

    // ── Type ──────────────────────────────────────────────────────────────────
    const rawType = get(map.typeIdx).toLowerCase();
    const type: 'expense' | 'income' =
      rawType.includes('income') || rawType.includes('הכנסה') ||
      rawType.includes('credit') || rawType.includes('זיכוי') ||
      rawType === 'in'
        ? 'income' : 'expense';

    // ── Category + payment method ─────────────────────────────────────────────
    const category       = inferCategory(get(map.catIdx));
    const payment_method = inferPaymentMethod(get(map.pmIdx), sources);

    return {
      raw: r,
      date,
      type,
      description:    get(map.descIdx) || 'ייבוא',
      amount,
      category,
      payment_method,
      notes:          get(map.notesIdx),
      valid:          errors.length === 0,
      errors,
    };
  });
}

// ── Category Inference ───────────────────────────────────────────────────────

// [categoryId, pipe-separated Hebrew/English keywords]
const CATEGORY_KEYWORDS: [string, string][] = [
  ['housing',       'בית ודיור|שכירות|משכנתא|ארנונה|חשמל|מים|גז|ועד בית|housing'],
  ['food',          'מזון|סופרמרקט|מכולת|ירקן|מאפייה|food|grocery|supermarket|שופרסל|רמי לוי|מגה'],
  ['entertainment', 'מסעדה|מסעדות|בילוי|קפה|בית קפה|משלוח|restaurant|cafe|entertainment|אוכל בחוץ'],
  ['transport',     'רכב|תחבורה|דלק|חניה|אוטובוס|רכבת|מונית|uber|bolt|transport|car|fuel'],
  ['communication', 'סלולר|אינטרנט|טלפון|נטפליקס|ספוטיפיי|תקשורת|communication|telecom|cellular'],
  ['health',        'בריאות|רופא|תרופות|קופת חולים|שיניים|health|pharmacy|doctor|medical'],
  ['fitness',       'כושר|חדר כושר|ספורט|fitness|gym|sport'],
  ['clothing',      'ביגוד|בגדים|נעליים|clothing|fashion|shoes'],
  ['children',      'ילדים|גן|בית ספר|צהרון|חוגים|children|kids|kindergarten'],
  ['education',     'חינוך|שכר לימוד|קורס|education|university|college|course'],
  ['travel',        'נסיעה|חופשה|טיסה|מלון|תיירות|travel|flight|hotel|booking'],
  ['pets',          'חיות|כלב|חתול|וטרינר|pets|vet|pet'],
  ['gifts',         'מתנות|אירוע|מתנה|gift|event|donation'],
  ['insurance',     'ביטוח|insurance'],
  ['grooming',      'טיפוח|ספר|קוסמטיקה|grooming|beauty|haircut'],
];

export function inferCategory(rawValue: string): string {
  if (!rawValue) return 'other';
  const v = rawValue.trim();
  // 1. Exact id match
  if (EXPENSE_CATEGORIES.find((c) => c.id === v.toLowerCase())) return v.toLowerCase();
  // 2. Hebrew name match
  const byName = EXPENSE_CATEGORIES.find((c) => c.name === v);
  if (byName) return byName.id;
  // 3. Keyword scan
  const lower = v.toLowerCase();
  for (const [id, kws] of CATEGORY_KEYWORDS) {
    if (kws.split('|').some((k) => lower.includes(k))) return id;
  }
  return 'other';
}

// ── Payment Method Inference ─────────────────────────────────────────────────

const PM_KEYWORDS: [string, string][] = [
  ['credit',   'אשראי|credit|ויזה|visa|מאסטר|mastercard|אמקס|amex|כרטיס'],
  ['transfer', 'העברה|transfer|bank|בנק|עו"ש|עוש|iban|wire'],
  ['bit',      'ביט|bit|paybox|פייבוקס'],
  ['cash',     'מזומן|cash'],
  ['standing', 'קבע|standing|direct debit|הוראת קבע'],
];

export function inferPaymentMethod(rawValue: string, sources: PaymentSource[]): string {
  if (!rawValue) return 'credit';
  const v = rawValue.trim().toLowerCase();
  // 1. Match a named payment source
  const src = sources.find((s) => {
    const sn = s.name.toLowerCase();
    return sn.length >= 2 && (sn.includes(v) || v.includes(sn));
  });
  if (src) return SOURCE_TYPE_TO_PM[src.type] ?? 'credit';
  // 2. Canonical value passed directly
  if (['credit', 'transfer', 'cash', 'bit', 'standing'].includes(v)) return v;
  // 3. Keyword map
  for (const [pm, kws] of PM_KEYWORDS) {
    if (kws.split('|').some((k) => v.includes(k))) return pm;
  }
  return 'credit';
}
