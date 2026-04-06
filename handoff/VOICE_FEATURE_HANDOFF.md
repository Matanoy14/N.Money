# Voice-to-Data Expense Feature — Continuation Handoff

**Date:** 2026-04-03
**Status:** Partially complete — parser done, UI and integration still to build.
**Context:** Session ended at 93% context. No broken state — nothing partially wired.

---

## 1. COMPLETED

### `src/lib/voiceParser.ts` (NEW — fully written, not yet TypeScript-checked)

Pure parsing module. No side effects. No API calls. No UI.

**Exported interface:**
```ts
export interface ParsedExpense {
  amount: number | null;
  description: string;
  category: string;          // EXPENSE_CATEGORIES id, or '' if unknown
  date: string;              // YYYY-MM-DD
  paymentMethod: string;     // 'credit' | 'transfer' | 'cash' | 'bit' | 'standing'
  paymentSourceId: string | null;
  attributedToType: 'shared' | 'member' | null;
  attributedToMemberId: string | null;
  fieldsFound: ('amount' | 'category' | 'date' | 'payment' | 'attribution')[];
  rawText: string;
}
```

**Exported function:**
```ts
export function parseExpenseText(
  text: string,
  ctx: { members: Array<{ id: string; name: string }>, paymentSources: Array<{ id: string; name: string; type: string }> }
): ParsedExpense
```

**Internal functions (not exported):**
- `extractAmount(text)` — regex patterns + Hebrew number words
- `extractDate(text)` — אתמול / לפני יומיים / DD/MM / defaults to today
- `inferCategory(text)` — keyword → category ID map (covers all 16 EXPENSE_CATEGORIES IDs)
- `inferPayment(text, sources)` — named source match → generic keyword match
- `inferAttribution(text, members)` — member name match + משותף/שלנו
- `buildDescription(text)` — strips amount/filler words, returns cleaned text

**Test phrases that should work:**
```
"קניתי בסופר ב-350 שקל"           → amount:350, category:'food', description:'בסופר'
"שילמתי שכירות 4000 היום"          → amount:4000, category:'housing', date:today, description:'שכירות'
"הוצאתי 120 על מונית"               → amount:120, category:'transport', description:'על מונית'
"קניתי לילדים בגדים ב-500"          → amount:500, category:'children', description:'לילדים בגדים'
"שילמתי בויזה של מתן 240 למסעדה"   → amount:240, category:'entertainment', payment:'credit', description:'למסעדה'
```

---

## 2. FILES ALREADY CHANGED

| File | Status | Notes |
|------|--------|-------|
| `src/lib/voiceParser.ts` | NEW — complete | Not yet tsc-checked |
| `src/components/expenses/VoiceExpenseButton.tsx` | NOT CREATED | Next session |
| `src/components/expenses/VariableExpensesTab.tsx` | NOT MODIFIED | Next session |
| `docs/MODULE_STATUS.md` | NOT UPDATED | Update after integration complete |
| `docs/CHANGELOG.md` | NOT UPDATED | Update after integration complete |

---

## 3. STILL TO BUILD

### A. `src/components/expenses/VoiceExpenseButton.tsx` (NEW)

Self-contained component. Handles all Speech API logic and recording states.

**Props:**
```ts
interface VoiceExpenseButtonProps {
  onTranscript: (text: string) => void;  // called with final transcript
  disabled?: boolean;
}
```

**Internal states:** `'idle' | 'recording' | 'unsupported'`

**Browser support check (run once on mount):**
```ts
const SpeechRecognitionAPI =
  (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition) as
  typeof SpeechRecognition | undefined;
const supported = !!SpeechRecognitionAPI;
```

**Recording setup:**
```ts
const rec = new SpeechRecognitionAPI();
rec.lang = 'he-IL';
rec.continuous = false;
rec.interimResults = true;
rec.maxAlternatives = 1;

rec.onresult = (e) => {
  const transcript = Array.from(e.results)
    .map(r => r[0].transcript).join('');
  setInterimText(transcript);
  if (e.results[0].isFinal) {
    onTranscript(transcript);
    setStatus('idle');
  }
};
rec.onerror = () => setStatus('idle');
rec.onend = () => setStatus('idle');
```

**Visual design:**
- `idle`: blue mic button `🎤` with label "הכתב בקול", `w-8 h-8 rounded-full bg-[#1E56A0] text-white`
- `recording`: pulsing red dot + interim text below + "עצור" button. Pulse: `animate-pulse` class on outer ring. Color: `bg-red-500`
- `unsupported`: greyed mic button, `title="לא נתמך בדפדפן זה — השתמש ב-Chrome או Safari"`, `opacity-40 cursor-not-allowed`

**Render structure (idle state):**
```tsx
<button onClick={startRecording} disabled={disabled}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
  style={{ backgroundColor: '#1E56A0', color: '#fff' }}>
  <span>🎤</span> הכתב בקול
</button>
```

**Render structure (recording state):**
```tsx
<div className="flex flex-col gap-1">
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
    <span className="text-xs text-red-600 font-semibold">מקשיב...</span>
    <button onClick={stopRecording} className="text-xs text-gray-500 hover:text-gray-700 underline">עצור</button>
  </div>
  {interimText && (
    <p className="text-xs text-gray-500 italic max-w-[280px] truncate">"{interimText}"</p>
  )}
</div>
```

**Render structure (unsupported):**
```tsx
<button disabled title="לא נתמך בדפדפן זה — השתמש ב-Chrome או Safari"
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold opacity-40 cursor-not-allowed"
  style={{ backgroundColor: '#6B7280', color: '#fff' }}>
  <span>🎤</span> הכתב בקול
</button>
```

---

### B. `src/components/expenses/VariableExpensesTab.tsx` — modifications

**Imports to add (top of file):**
```ts
import VoiceExpenseButton from './VoiceExpenseButton';
import { parseExpenseText, ParsedExpense } from '../../lib/voiceParser';
```

**State to add (after existing UI state):**
```ts
const [voiceParsed, setVoiceParsed] = useState<ParsedExpense | null>(null);
```

**Handler to add (after `handleEdit`):**
```ts
const handleVoiceTranscript = (text: string) => {
  const parsed = parseExpenseText(text, {
    members: members.map(m => ({ id: m.id, name: m.name })),
    paymentSources: paymentSources.map(s => ({ id: s.id, name: s.name, type: s.type })),
  });
  setVoiceParsed(parsed);

  // Populate form fields — only override non-empty parsed values
  if (parsed.description)                setTxDescription(parsed.description);
  if (parsed.amount !== null)            setTxAmount(String(parsed.amount));
  if (parsed.category)                   setTxCategory(parsed.category);
  if (parsed.date)                       setTxDate(parsed.date);
  if (parsed.paymentSourceId) {
    setTxSourceId(parsed.paymentSourceId);
    setTxPayment(parsed.paymentMethod);
  } else if (parsed.fieldsFound.includes('payment')) {
    setTxPayment(parsed.paymentMethod);
    setTxSourceId(null);
  }
  if ((isCouple || isFamily) && parsed.attributedToType) {
    setTxAttrType(parsed.attributedToType as 'shared' | 'member');
    setTxAttrMemberId(parsed.attributedToMemberId);
  }
};
```

**In the drawer JSX — inside the `<div className="flex items-center justify-between mb-6">` header:**
Add VoiceExpenseButton to the right of the title, left of the close button:
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-lg font-bold text-gray-900">
    {editingMovement ? 'עריכת הוצאה' : 'הוספת הוצאה'}
  </h2>
  <div className="flex items-center gap-2">
    {!editingMovement && (
      <VoiceExpenseButton onTranscript={handleVoiceTranscript} />
    )}
    <button onClick={() => { setShowAddPanel(false); resetForm(); }}
      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
      ✕
    </button>
  </div>
</div>
```

NOTE: Voice button only shown when adding (not editing) — `!editingMovement`.

**After the drawer header, add the parsed result preview bar (only when voiceParsed is set):**
```tsx
{voiceParsed && (
  <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl mb-4"
    style={{ backgroundColor: '#EBF1FB', border: '1px solid #1E56A020' }}>
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-500 font-medium">מה הבנתי:</span>
      {voiceParsed.amount !== null && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-[#E53E3E]">
          ₪{voiceParsed.amount}
        </span>
      )}
      {voiceParsed.category && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-700">
          {/* category name */}
          {EXPENSE_CATEGORIES.find(c => c.id === voiceParsed.category)?.name ?? voiceParsed.category}
        </span>
      )}
      {voiceParsed.fieldsFound.includes('date') && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-500">
          {formatDate(voiceParsed.date)}
        </span>
      )}
    </div>
    <button onClick={() => setVoiceParsed(null)}
      className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">
      ✕
    </button>
  </div>
)}
```

**Add EXPENSE_CATEGORIES import to VariableExpensesTab.tsx** (it already has the import from categories):
Check line 8 — already imports `EXPENSE_CATEGORIES, SUBCATEGORIES`. Good, no change needed.

**Reset voiceParsed when form is reset:**
```ts
const resetForm = () => {
  // ... existing resets ...
  setVoiceParsed(null);  // ADD THIS LINE
};
```

---

## 4. EXACT INTEGRATION PLAN

```
User taps "הכתב בקול"
  → VoiceExpenseButton: SpeechRecognition starts, lang=he-IL
  → recording state: red pulsing dot + interim text shown
  → user speaks: "קניתי בסופר ב-350 שקל"
  → SpeechRecognition.onresult (isFinal=true)
  → VoiceExpenseButton calls: onTranscript("קניתי בסופר ב-350 שקל")

VariableExpensesTab.handleVoiceTranscript("קניתי בסופר ב-350 שקל")
  → parseExpenseText(text, { members, paymentSources })
  → returns: { amount:350, category:'food', description:'בסופר', date:today, fieldsFound:['amount','category'], ... }
  → setTxAmount('350')
  → setTxDescription('בסופר')
  → setTxCategory('food')
  → setTxDate(today)
  → setVoiceParsed(parsed)

Drawer renders:
  → "מה הבנתי:" chip row: [₪350] [מזון וקניות]
  → Form fields are now populated
  → User can edit freely before saving
  → Save button works exactly as before — no change to save flow
```

---

## 5. RISKS / EDGE CASES

| Risk | Mitigation |
|------|-----------|
| `SpeechRecognition` not in `window` (Firefox, some Android) | Check on mount, render unsupported state |
| `webkitSpeechRecognition` needs `(window as any)` cast | Done in the component |
| Hebrew recognition accuracy varies by device/browser | Parser is tolerant; unclear fields left at defaults |
| `rec.onend` fires without `onresult` (user said nothing / noise) | `setStatus('idle')`, no `onTranscript` call, no form population |
| Multiple rapid taps on mic button | Store rec in `useRef`, call `rec.abort()` before starting new session |
| Voice used while editing (not just adding) | Button hidden when `editingMovement` is set |
| Amount parsing: "1,500" vs "1.500" | `replace(/[,.']/g, '')` strips all separators |
| Category inference: no match found | `category` returns `''`, form category stays at user's previous selection |
| Attribution: member name not in text | Returns `null`, form attribution unchanged |
| `rec` instance lifecycle: must be recreated each time | Create inside `startRecording`, do NOT store as module-level |
| HTTPS required | Web Speech API requires HTTPS in production. Localhost works. |

---

## 6. TYPECHECK STATUS

**Not yet run.** `voiceParser.ts` was written but `npx tsc --noEmit` was not executed before session ended.

**Expected TypeScript issues to watch for:**
1. `window.SpeechRecognition` — may require `(window as any).SpeechRecognition` if TS lib doesn't include it
2. `webkitSpeechRecognition` — definitely needs `(window as any).webkitSpeechRecognition`
3. `ParsedExpense.attributedToType` typed as `'shared' | 'member' | null` — when passing to `setTxAttrType` which expects `'shared' | 'member'`, guard with `if (parsed.attributedToType)` (already in plan above)
4. `EXPENSE_CATEGORIES` import in VariableExpensesTab — already present, no issue

**Run after all files are created:**
```bash
npx tsc --noEmit
```

---

## 7. COPY-PASTE PROMPT FOR NEXT SESSION

```
Use docs/MASTER_CONTEXT.md as source of truth.
Use docs/MODULE_STATUS.md for current module state.
Use docs/PRODUCT_DECISIONS.md for locked decisions.
Use docs/UI_UX_RULES.md for RTL/UI hierarchy rules.
Use handoff/SESSION_CHECKPOINT.md and handoff/VOICE_FEATURE_HANDOFF.md for continuity.

Context:
- The Expenses module voice-to-data feature is partially complete.
- Read handoff/VOICE_FEATURE_HANDOFF.md first — it contains the exact implementation plan.
- Do NOT redesign the feature. Do NOT restart from scratch. Continue exactly from where it stopped.

What is already done:
- src/lib/voiceParser.ts — created and complete (Hebrew expense text parser, pure module)

What must be built now (in this order):
1. src/components/expenses/VoiceExpenseButton.tsx — mic button component (exact spec in handoff)
2. Modify src/components/expenses/VariableExpensesTab.tsx — wire button + form population (exact integration plan in handoff)
3. Run npx tsc --noEmit and fix any type errors
4. Update docs/CHANGELOG.md, docs/MODULE_STATUS.md, handoff/SESSION_CHECKPOINT.md

Critical rules:
- Follow the exact implementation plan in VOICE_FEATURE_HANDOFF.md
- Voice button only shown when adding new expense (not editing)
- User must always review/edit before save — no auto-save
- voiceParser output populates form state; all fields remain editable
- No fake AI posture — what was parsed is shown clearly as "מה הבנתי:"
- Browser support check on mount; unsupported state is a greyed-out disabled button
- Use lang='he-IL' for SpeechRecognition
- SpeechRecognition instance created inside startRecording (not module-level)
- webkitSpeechRecognition needs (window as any) cast for TypeScript
- attributedToType is only applied if (isCouple || isFamily)

After implementing, return:

VOICE FEATURE IMPLEMENTATION REPORT
1. FILES CHANGED
2. INTEGRATION SUMMARY
3. BROWSER SUPPORT NOTES
4. REGRESSION RESULTS (tsc --noEmit output)
5. WHAT TO TEST
```
