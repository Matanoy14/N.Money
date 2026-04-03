import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../lib/formatters';
import { useAccount } from '../context/AccountContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type AssetType = 'real_estate' | 'vehicle' | 'pension' | 'study_fund' | 'investment' | 'savings' | 'other';

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  notes: string | null;
  as_of_date: string;
}

const TYPE_LABELS: Record<AssetType, string> = {
  real_estate: 'נדל״ן',
  vehicle:     'רכב',
  pension:     'פנסיה',
  study_fund:  'קרן השתלמות',
  investment:  'השקעות',
  savings:     'חסכונות',
  other:       'אחר',
};

const TYPE_COLORS: Record<AssetType, string> = {
  real_estate: '#1E56A0',
  vehicle:     '#6B7280',
  pension:     '#8B5CF6',
  study_fund:  '#00A86B',
  investment:  '#F59E0B',
  savings:     '#0EA5E9',
  other:       '#9CA3AF',
};

const ASSET_TYPES = Object.keys(TYPE_LABELS) as AssetType[];

const EMPTY_FORM = {
  name:       '',
  type:       'real_estate' as AssetType,
  value:      '',
  notes:      '',
  as_of_date: new Date().toISOString().slice(0, 10),
};

const AssetsPage: React.FC = () => {
  const { accountId } = useAccount();
  const { user }      = useAuth();

  const [assets, setAssets]     = useState<Asset[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('assets')
      .select('id, name, type, value, notes, as_of_date')
      .eq('account_id', accountId)
      .order('value', { ascending: false });
    if (err) setError('שגיאה בטעינת הנתונים');
    else     setAssets((data ?? []) as Asset[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (a: Asset) => {
    setEditId(a.id);
    setForm({ name: a.name, type: a.type, value: String(a.value), notes: a.notes ?? '', as_of_date: a.as_of_date });
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setEditId(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value || !accountId || !user) return;
    const value = parseFloat(form.value);
    if (isNaN(value) || value < 0) return;

    setSaving(true);
    const payload = {
      name:       form.name.trim(),
      type:       form.type,
      value,
      notes:      form.notes.trim() || null,
      as_of_date: form.as_of_date,
    };

    let err;
    if (editId) {
      ({ error: err } = await supabase.from('assets').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await supabase.from('assets').insert({ ...payload, account_id: accountId, user_id: user.id }));
    }

    setSaving(false);
    if (!err) { closePanel(); await load(); }
    else       setError('שגיאה בשמירת הנתונים');
  };

  const handleDelete = async (id: string) => {
    const { error: err } = await supabase.from('assets').delete().eq('id', id);
    if (!err) setAssets(prev => prev.filter(a => a.id !== id));
    else      setError('שגיאה במחיקת הנכס');
  };

  const filtered   = filterType === 'all' ? assets : assets.filter(a => a.type === filterType);
  const totalValue = assets.reduce((s, a) => s + a.value, 0);

  const byType = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + a.value;
    return acc;
  }, {});

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">נכסים</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[10px] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
        >
          <span className="font-bold">+</span> הוסף נכס
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {/* Hero card */}
      <div
        className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D2F6B, #1E56A0)' }}
      >
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white/5 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm font-medium mb-2">שווי נכסים כולל</p>
          <p className="text-4xl font-extrabold mb-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(totalValue)}
          </p>
          <p className="text-white/60 text-sm">{assets.length} נכסים רשומים</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main list */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filter tabs */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
              style={filterType === 'all'
                ? { backgroundColor: '#1E56A0', color: '#fff', borderColor: '#1E56A0' }
                : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
            >
              הכל
            </button>
            {ASSET_TYPES.filter(t => byType[t]).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                style={filterType === t
                  ? { backgroundColor: TYPE_COLORS[t], color: '#fff', borderColor: TYPE_COLORS[t] }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-12 flex items-center justify-center text-gray-400 text-sm">
              טוען...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl mb-3">🏦</div>
              <p className="font-medium">אין נכסים עדיין</p>
              <p className="text-sm mt-1">הוסף נכסים כמו דירה, רכב, חסכונות, פנסיה ועוד</p>
            </div>
          ) : (
            filtered.map(asset => {
              const color = TYPE_COLORS[asset.type];
              return (
                <div
                  key={asset.id}
                  className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] flex items-center gap-4 group hover:shadow-lg transition-shadow"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: color + '15' }}
                  >
                    {{
                      real_estate: '🏠',
                      vehicle:     '🚗',
                      pension:     '🌅',
                      study_fund:  '📈',
                      investment:  '📊',
                      savings:     '🏦',
                      other:       '📦',
                    }[asset.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-900">{asset.name}</p>
                      <p className="text-lg font-extrabold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(asset.value)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: color + '18', color }}>
                        {TYPE_LABELS[asset.type]}
                      </span>
                      <span className="text-xs text-gray-400">עודכן {asset.as_of_date}</span>
                    </div>
                    {asset.notes && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{asset.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => openEdit(asset)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-sm"
                    >🗑️</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        {Object.keys(byType).length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] h-fit">
            <h3 className="font-semibold text-gray-900 mb-4">חלוקה לפי סוג</h3>
            <div className="space-y-3">
              {(Object.entries(byType) as [AssetType, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([type, val]) => {
                  const pct   = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
                  const color = TYPE_COLORS[type];
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{TYPE_LABELS[type]}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{pct}%</span>
                          <span className="text-sm font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(val)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Slide-in panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div
            className="fixed top-0 right-0 lg:right-[240px] h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            style={{ animation: 'slideInRight 0.25s ease' }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'עריכת נכס' : 'נכס חדש'}</h2>
              <button onClick={closePanel}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם הנכס</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="למשל: דירה בתל אביב"
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סוג נכס</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASSET_TYPES.map(t => {
                    const active = form.type === t;
                    const color  = TYPE_COLORS[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className="py-2.5 rounded-[10px] border-2 text-sm font-semibold transition"
                        style={active
                          ? { borderColor: color, backgroundColor: color + '12', color }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שווי נוכחי</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full pr-8 pl-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                  />
                </div>
              </div>

              {/* As-of date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך הערכה</label>
                <input
                  type="date"
                  value={form.as_of_date}
                  onChange={e => setForm(f => ({ ...f, as_of_date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות (אופציונלי)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] transition resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button onClick={closePanel}
                className="flex-1 py-3 rounded-[10px] border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.value}
                className="flex-1 py-3 rounded-[10px] text-white font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default AssetsPage;
