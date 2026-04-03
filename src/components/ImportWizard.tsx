/**
 * ImportWizard.tsx — Multi-step Excel/CSV import wizard for N.Money
 *
 * Steps: upload → (column mapping if auto-detect fails) → preview → done
 * Uses importParser.ts for all parsing/validation logic.
 */

import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { PaymentSource } from '../lib/paymentMethods';
import {
  parseFile, detectColMap, requiredDetected, buildImportRows,
} from '../lib/importParser';
import type { ColMap, ImportRow } from '../lib/importParser';

interface Props {
  accountId: string | null;
  userId: string | undefined;
  paymentSources: PaymentSource[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'done';

const COLUMN_LABELS: { key: keyof ColMap; label: string; required: boolean }[] = [
  { key: 'dateIdx',   label: 'תאריך',       required: true  },
  { key: 'amountIdx', label: 'סכום',        required: true  },
  { key: 'typeIdx',   label: 'סוג (הוצאה/הכנסה)', required: false },
  { key: 'descIdx',   label: 'תיאור',       required: false },
  { key: 'catIdx',    label: 'קטגוריה',     required: false },
  { key: 'pmIdx',     label: 'אמצעי תשלום', required: false },
  { key: 'notesIdx',  label: 'הערות',       required: false },
];

const ImportWizard: React.FC<Props> = ({ accountId, userId, paymentSources }) => {
  const [step, setStep]         = useState<Step>('upload');
  const [parsing, setParsing]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rawRows, setRawRows]   = useState<string[][]>([]);
  const [colMap, setColMap]     = useState<ColMap>({
    dateIdx: -1, amountIdx: -1, typeIdx: -1,
    descIdx: -1, catIdx: -1, pmIdx: -1, notesIdx: -1,
  });

  const [rows, setRows]           = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: File upload ──────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setError(null);
    const parsed = await parseFile(file);
    setParsing(false);
    if (parsed.error) { setError(parsed.error); return; }
    if (parsed.headers.length === 0) { setError('הקובץ ריק'); return; }

    setFileName(file.name);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);

    const detected = detectColMap(parsed.headers);
    setColMap(detected);

    if (requiredDetected(detected)) {
      const built = buildImportRows(parsed.headers, parsed.rows, detected, paymentSources);
      setRows(built);
      setStep('preview');
    } else {
      setStep('mapping');
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const lines = [
      'תאריך,סוג,קטגוריה,תיאור,סכום,אמצעי תשלום,הערות',
      '2024-01-15,הוצאה,מזון,סופרמרקט,250,credit,',
      '2024-01-20,הכנסה,income,משכורת,8000,transfer,',
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nmoney-import-template.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Step 2: Column mapping ───────────────────────────────────────────────

  const handleColChange = (key: keyof ColMap, value: string) => {
    setColMap(prev => ({ ...prev, [key]: parseInt(value, 10) }));
  };

  const handleApplyMapping = () => {
    if (!requiredDetected(colMap)) {
      setError('יש לבחור לפחות עמודות תאריך וסכום');
      return;
    }
    setError(null);
    const built = buildImportRows(headers, rawRows, colMap, paymentSources);
    setRows(built);
    setStep('preview');
  };

  // ── Step 3: Confirm import ───────────────────────────────────────────────

  const handleImport = async () => {
    if (!userId || !accountId) return;
    const valid = rows.filter(r => r.valid);
    if (!valid.length) return;
    setImporting(true); setError(null);

    const inserts = valid.map(r => ({
      user_id: userId,
      account_id: accountId,
      date: r.date,
      type: r.type,
      category: r.category || (r.type === 'income' ? 'income' : 'other'),
      description: r.description || 'ייבוא',
      amount: r.amount,
      payment_method: r.payment_method || 'credit',
      notes: r.notes || null,
      status: 'actual',
      source: 'import',
    }));

    const { error: dbErr } = await supabase.from('financial_movements').insert(inserts);
    setImporting(false);
    if (dbErr) { setError(`שגיאת ייבוא: ${dbErr.message}`); return; }
    setImportedCount(valid.length);
    setStep('done');
  };

  const handleReset = () => {
    setStep('upload'); setError(null); setFileName(null);
    setHeaders([]); setRawRows([]); setRows([]);
    setColMap({ dateIdx: -1, amountIdx: -1, typeIdx: -1, descIdx: -1, catIdx: -1, pmIdx: -1, notesIdx: -1 });
    setImportedCount(0);
  };

  // ── UI helpers ───────────────────────────────────────────────────────────

  const validCount   = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  const stepLabels = [
    { n: 1, label: 'בחר קובץ',    active: step === 'upload'  },
    { n: 2, label: 'מיפוי עמודות', active: step === 'mapping' },
    { n: 3, label: 'תצוגה מקדימה', active: step === 'preview' },
    { n: 4, label: 'סיום',         active: step === 'done'    },
  ].filter(s => step !== 'mapping' ? s.n !== 2 : true); // hide mapping step when not needed

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 border border-gray-200 rounded-xl">

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="flex items-center gap-2 mb-4 text-xs">
          {stepLabels.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`flex items-center gap-1.5 font-semibold ${s.active ? 'text-[#1E56A0]' : 'text-gray-300'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${s.active ? 'bg-[#1E56A0] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}
                </span>
                {s.label}
              </div>
              {i < stepLabels.length - 1 && <span className="text-gray-200 font-light">›</span>}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-3 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm mb-1">ייבוא עסקאות מ-Excel</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              יש לך עסקאות קיימות ב-Excel, Google Sheets, או קובץ CSV? ייבא אותן ל-N.Money בכמה שלבים פשוטים.
            </p>
          </div>

          {/* Supported formats */}
          <div className="flex gap-2 text-xs">
            {['.xlsx', '.xls', '.csv'].map(f => (
              <span key={f} className="px-2 py-1 bg-gray-100 text-gray-600 rounded font-semibold">{f}</span>
            ))}
          </div>

          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="font-semibold text-gray-600">רשימת עמודות נדרשות:</p>
            <p>• <strong>תאריך</strong> ו-<strong>סכום</strong> — חובה</p>
            <p>• תיאור, סוג, קטגוריה, אמצעי תשלום — אופציונלי</p>
            <p>• N.Money יזהה את שמות העמודות בעברית ובאנגלית אוטומטית</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className={`cursor-pointer ${parsing ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={parsing}
              />
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold hover:opacity-90 cursor-pointer transition"
                style={{ backgroundColor: '#1E56A0', color: '#fff' }}>
                {parsing ? 'טוען...' : '📂 בחר קובץ'}
              </span>
            </label>
            <button onClick={handleDownloadTemplate}
              className="text-sm text-[#1E56A0] font-semibold hover:underline whitespace-nowrap">
              הורד תבנית לדוגמה ↓
            </button>
          </div>

          {fileName && !parsing && (
            <p className="text-sm text-gray-600 truncate">קובץ נבחר: <strong>{fileName}</strong></p>
          )}
        </div>
      )}

      {/* ── STEP 2: Column mapping ── */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm mb-1">מיפוי עמודות</p>
            <p className="text-sm text-gray-500">לא זוהו עמודות תאריך/סכום אוטומטית. מפה אותן ידנית:</p>
          </div>

          {/* Mini header preview */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                      [{i}] {h || '(ריק)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 2).map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-gray-600 max-w-[120px] truncate">{cell || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COLUMN_LABELS.map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {label}{required && <span className="text-red-400 mr-1">*</span>}
                </label>
                <select
                  value={colMap[key]}
                  onChange={e => handleColChange(key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1E56A0]">
                  <option value="-1">— לא נמפה —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>[{i}] {h || '(ריק)'}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleApplyMapping}
              className="px-5 py-2.5 text-white text-sm font-semibold rounded-[10px] hover:opacity-90 transition"
              style={{ backgroundColor: '#1E56A0' }}>
              המשך לתצוגה מקדימה ›
            </button>
            <button onClick={handleReset}
              className="text-sm text-gray-400 hover:text-gray-600 font-semibold">
              ← בחר קובץ אחר
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview ── */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                <span className="text-[#00A86B]">{validCount} שורות תקינות</span>
                {invalidCount > 0 && (
                  <span className="text-red-400 font-normal mr-2">· {invalidCount} שגויות יידולגו</span>
                )}
              </p>
              {fileName && <p className="text-xs text-gray-400 mt-0.5">{fileName}</p>}
            </div>
            <button onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
              ← בחר קובץ אחר
            </button>
          </div>

          {validCount === 0 && (
            <div className="mb-3 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
              לא נמצאו שורות תקינות לייבוא
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">תאריך</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">תיאור</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">סוג</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">סכום</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">קטגוריה</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${!row.valid ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.date || '—'}</td>
                    <td className="px-3 py-1.5 max-w-[120px] truncate">{row.description || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{row.type === 'income' ? 'הכנסה' : 'הוצאה'}</td>
                    <td className="px-3 py-1.5 font-semibold whitespace-nowrap">
                      {row.amount ? `₪${row.amount.toLocaleString('he-IL')}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{row.category || '—'}</td>
                    <td className="px-3 py-1.5">
                      {row.valid
                        ? <span className="text-[#00A86B] font-bold">✓</span>
                        : <span className="text-red-400 font-bold" title={row.errors.join(', ')}>✕</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 15 && (
              <p className="text-xs text-gray-400 text-center py-2">ועוד {rows.length - 15} שורות...</p>
            )}
          </div>

          {/* Show first few errors for invalid rows */}
          {invalidCount > 0 && (
            <div className="mb-3 text-xs text-gray-400 space-y-0.5">
              {rows.filter(r => !r.valid).slice(0, 3).map((r, i) => (
                <p key={i}>שורה {rows.indexOf(r) + 1}: {r.errors.join(' · ')}</p>
              ))}
              {invalidCount > 3 && <p>ועוד {invalidCount - 3} שגיאות נוספות...</p>}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="px-5 py-2.5 text-white text-sm font-semibold rounded-[10px] disabled:opacity-50 hover:opacity-90 transition"
            style={{ backgroundColor: '#1E56A0' }}>
            {importing ? 'מייבא...' : `ייבא ${validCount} עסקאות`}
          </button>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && (
        <div className="text-center py-4 space-y-3">
          <div className="text-4xl">✅</div>
          <p className="font-bold text-gray-900">הייבוא הושלם בהצלחה</p>
          <p className="text-sm text-gray-500">ייבאת <strong>{importedCount}</strong> עסקאות לחשבון</p>
          <button onClick={handleReset}
            className="mt-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold hover:bg-blue-100 transition"
            style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>
            ייבא קובץ נוסף
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportWizard;
