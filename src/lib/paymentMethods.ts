export const PAYMENT_METHODS = [
  { id: 'credit',   name: 'כרטיס אשראי',  color: '#6366F1' },
  { id: 'transfer', name: 'העברה בנקאית', color: '#8B5CF6' },
  { id: 'cash',     name: 'מזומן',         color: '#22C55E' },
  { id: 'bit',      name: 'ביט / Paybox',  color: '#0EA5E9' },
  { id: 'standing', name: 'הוראת קבע',    color: '#F59E0B' },
] as const;

// Aliases for legacy stored values:
const PM_ALIASES: Record<string, string> = {
  debit:             'credit',
  digital:           'bit',
  bank:              'transfer',
  'כרטיס אשראי':    'credit',
  'העברה בנקאית':   'transfer',
  'מזומן':            'cash',
  'הוראת קבע':       'standing',
  'אחר':              'credit',
};

export const getPaymentMethod = (id: string) => {
  const canonical = PM_ALIASES[id] ?? id;
  return PAYMENT_METHODS.find(p => p.id === canonical) ?? PAYMENT_METHODS[0];
};

// ─── Payment Sources (named cards / accounts) ─────────────────────────────────

export interface PaymentSource {
  id: string;
  name: string;
  type: string;  // 'credit' | 'bank' | 'bit' | 'paybox' | 'cash'
  color: string;
}

/** Preset color palette for source creation */
export const SOURCE_COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#F59E0B', '#F97316', '#0EA5E9', '#78716C',
  '#C026D3', '#71717A',
];

/** User-facing source type labels */
export const SOURCE_TYPES: { id: string; name: string; icon: string; hint: string }[] = [
  { id: 'credit',   name: 'כרטיס אשראי',  icon: '💳', hint: 'ויזה, מאסטרקארד, אמקס' },
  { id: 'bank',     name: 'חשבון בנק',    icon: '🏦', hint: 'עו״ש, חשבון ניהול' },
  { id: 'transfer', name: 'העברה בנקאית', icon: '🔄', hint: 'העברות ישירות' },
  { id: 'bit',      name: 'ביט',          icon: '📲', hint: 'תשלומים בנייד' },
  { id: 'paybox',   name: 'Paybox',       icon: '📲', hint: 'תשלומים בנייד' },
  { id: 'cash',     name: 'מזומן',        icon: '💵', hint: 'תשלום פיזי' },
];

/** Maps a source type to the canonical payment_method stored in DB */
export const SOURCE_TYPE_TO_PM: Record<string, string> = {
  credit:   'credit',
  bank:     'transfer',
  transfer: 'transfer',
  bit:      'bit',
  paybox:   'bit',
  cash:     'cash',
  // legacy backward compat
  debit:    'credit',
  digital:  'bit',
};

/** Legacy source type label aliases (for rows created before type list update) */
const SOURCE_TYPE_ALIASES: Record<string, string> = {
  debit:   'credit',
  digital: 'bit',
  // 'bank' is still valid — now labelled 'חשבון בנק' (was 'חשבון עו״ש')
};

/** Returns the Hebrew label for a source type, handling legacy values gracefully */
export const getSourceTypeLabel = (type: string): string => {
  const canonical = SOURCE_TYPE_ALIASES[type] ?? type;
  return SOURCE_TYPES.find(t => t.id === canonical)?.name ?? type;
};

/**
 * Resolve display name + color for a transaction/movement.
 * Prefers a named payment source when payment_source_id is present;
 * falls back to the legacy payment_method type string.
 */
export const resolvePaymentDisplay = (
  payment_source_id: string | null | undefined,
  payment_method: string,
  sources: PaymentSource[],
): { name: string; color: string } => {
  if (payment_source_id) {
    const src = sources.find(s => s.id === payment_source_id);
    if (src) return { name: src.name, color: src.color };
  }
  const pm = getPaymentMethod(payment_method);
  return { name: pm.name, color: pm.color };
};
