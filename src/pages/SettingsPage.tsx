import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import { supabase } from '../lib/supabase';
import { SOURCE_COLORS, SOURCE_TYPES, getSourceTypeLabel } from '../lib/paymentMethods';
import type { PaymentSource } from '../lib/paymentMethods';
import { buildInviteUrl, getCurrentOriginScope } from '../lib/inviteUrl';
import type { InviteScope } from '../lib/inviteUrl';
import type { AccountType } from '../context/AccountContext';
import {
  fetchAccountSubscription,
  planLabel, statusLabel, statusColor, formatBillingDate,
  isSubscriptionSynced, planForAccountType,
} from '../lib/billing';
import type { AccountSubscription, SubscriptionFetchResult } from '../lib/billing';
import ImportWizard from '../components/ImportWizard';

type SettingsSection =
  | 'profile' | 'payments' | 'account' | 'billing' | 'security'
  | 'data' | 'notifications' | 'appearance' | 'budget';

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  created_at: string;
}

type MovementRow = {
  date: string; type: string; category: string; sub_category: string | null;
  description: string; amount: number; payment_method: string; notes: string | null;
};

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const {
    accountId, accountType, isPersonal, isCouple, isFamily,
    members, currentMember,
    paymentSources, refetchPaymentSources,
    refetchAccount,
  } = useAccount();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    // If returning from Stripe checkout, open billing tab directly
    const billing = searchParams.get('billing');
    return (billing === 'success' || billing === 'cancel') ? 'billing' : 'profile';
  });
  const [billingReturnStatus, setBillingReturnStatus] = useState<'success' | 'cancel' | null>(() => {
    const billing = searchParams.get('billing');
    return (billing === 'success' || billing === 'cancel') ? billing : null;
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Profile ──────────────────────────────────────────────────────────────
  const [fullName, setFullName]             = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [email]                             = useState(user?.email ?? '');

  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles')
      .select('display_name, employment_type')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setFullName(data.display_name ?? ''); setEmploymentType(data.employment_type ?? ''); }
      });
  }, [user]);

  // ── Payment Sources ──────────────────────────────────────────────────────
  const [showAddSrc, setShowAddSrc]       = useState(false);
  const [newSrcName, setNewSrcName]       = useState('');
  const [newSrcType, setNewSrcType]       = useState('credit');
  const [newSrcColor, setNewSrcColor]     = useState(SOURCE_COLORS[0]);
  const [addingSrc, setAddingSrc]         = useState(false);
  const [deletingSrcId, setDeletingSrcId] = useState<string | null>(null);
  const [srcError, setSrcError]           = useState<string | null>(null);
  const [editingSrcId, setEditingSrcId]   = useState<string | null>(null);
  const [editSrcName, setEditSrcName]     = useState('');
  const [editSrcType, setEditSrcType]     = useState('');
  const [editSrcColor, setEditSrcColor]   = useState('');
  const [savingEdit, setSavingEdit]       = useState(false);
  const [srcUsageCounts, setSrcUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (activeSection !== 'payments' || !accountId || paymentSources.length === 0) return;
    supabase.from('financial_movements')
      .select('payment_source_id').eq('account_id', accountId)
      .not('payment_source_id', 'is', null)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((m: { payment_source_id: string | null }) => {
          if (m.payment_source_id) counts[m.payment_source_id] = (counts[m.payment_source_id] ?? 0) + 1;
        });
        setSrcUsageCounts(counts);
      });
  }, [activeSection, accountId, paymentSources]);

  const handleAddSource = async () => {
    if (!user || !newSrcName.trim()) return;
    if (!accountId) { setSrcError('לא נמצא חשבון פעיל'); return; }
    setAddingSrc(true); setSrcError(null);
    const { error } = await supabase.from('payment_sources').insert({
      user_id: user.id, account_id: accountId,
      name: newSrcName.trim(), type: newSrcType, color: newSrcColor, is_active: true,
    });
    setAddingSrc(false);
    if (error) { setSrcError(`שגיאה: ${error.message}`); return; }
    setNewSrcName(''); setNewSrcType('credit'); setNewSrcColor(SOURCE_COLORS[0]);
    setShowAddSrc(false); refetchPaymentSources();
  };

  const handleStartEdit = (src: PaymentSource) => {
    setEditingSrcId(src.id); setEditSrcName(src.name);
    setEditSrcType(src.type); setEditSrcColor(src.color); setSrcError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSrcId || !editSrcName.trim()) return;
    setSavingEdit(true); setSrcError(null);
    const { error } = await supabase.from('payment_sources')
      .update({ name: editSrcName.trim(), type: editSrcType, color: editSrcColor })
      .eq('id', editingSrcId);
    setSavingEdit(false);
    if (error) { setSrcError('שגיאה בשמירת השינויים'); return; }
    setEditingSrcId(null); refetchPaymentSources();
  };

  const handleDeleteSource = async (id: string) => {
    setDeletingSrcId(id); setSrcError(null);
    const { error } = await supabase.from('payment_sources')
      .update({ is_active: false }).eq('id', id);
    setDeletingSrcId(null);
    if (error) { setSrcError('שגיאה בהסרת המקור'); return; }
    refetchPaymentSources();
  };

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('nmoney_notification_prefs');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const toggleNotif = (key: string) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('nmoney_notification_prefs', JSON.stringify(next)); } catch { /* ok */ }
      return next;
    });
  };

  // ── Appearance / Budget (UI-only state) ───────────────────────────────────
  const [language] = useState('he');
  const [savingsGoalPct, setSavingsGoalPct] = useState(() => {
    try { return localStorage.getItem('nmoney_savings_goal_pct') ?? '20'; } catch { return '20'; }
  });

  // ── Security / MFA ───────────────────────────────────────────────────────
  const [passwordResetSent, setPasswordResetSent]   = useState(false);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading]   = useState(false);
  const [mfaActive, setMfaActive]     = useState(false);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaQRCode, setMfaQRCode]     = useState('');
  const [mfaSecret, setMfaSecret]     = useState('');
  const [mfaCode, setMfaCode]         = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError, setMfaError]         = useState<string | null>(null);
  const [mfaFactor, setMfaFactor]       = useState<{ id: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [deleteConfirmText, setDeleteConfirmText]   = useState('');
  const [deletingAccount, setDeletingAccount]       = useState(false);

  useEffect(() => {
    if (!user || activeSection !== 'security') return;
    setMfaLoading(true);
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = ((data as unknown as { totp?: { id: string; status: string }[] } | null)?.totp ?? []);
      const verified = totp.find((f) => f.status === 'verified') ?? null;
      setMfaActive(!!verified); setMfaFactor(verified); setMfaLoading(false);
    });
  }, [user, activeSection]);

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    setPasswordResetError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setPasswordResetError('שגיאה בשליחת הקישור'); return; }
    setPasswordResetSent(true);
    setTimeout(() => setPasswordResetSent(false), 5000);
  };

  const handleMFAEnroll = async () => {
    setMfaError(null);
    const result = await supabase.auth.mfa.enroll({
      factorType: 'totp', issuer: 'N.Money', friendlyName: 'N.Money TOTP',
    });
    if (result.error || !result.data) { setMfaError(`שגיאה: ${result.error?.message ?? 'לא ידוע'}`); return; }
    const d = result.data as unknown as { id: string; totp: { qr_code: string; secret: string } };
    setMfaFactorId(d.id); setMfaQRCode(d.totp.qr_code); setMfaSecret(d.totp.secret);
    setMfaEnrolling(true);
  };

  const handleMFAVerify = async () => {
    setMfaVerifying(true); setMfaError(null);
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (ce || !ch) { setMfaError('שגיאה — נסה שוב'); setMfaVerifying(false); return; }
    const { error: ve } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: ch.id, code: mfaCode,
    });
    setMfaVerifying(false);
    if (ve) { setMfaError('קוד לא נכון — נסה שוב'); return; }
    setMfaActive(true); setMfaEnrolling(false); setMfaFactor({ id: mfaFactorId }); setMfaCode('');
  };

  const handleMFAUnenroll = async () => {
    if (!mfaFactor) return; setMfaError(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id });
    if (error) { setMfaError('שגיאה בביטול האימות'); return; }
    setMfaActive(false); setMfaFactor(null);
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'מחק') return;
    setDeletingAccount(true);
    try {
      if (accountId && isPersonal) {
        await supabase.from('financial_movements').delete().eq('account_id', accountId);
        await supabase.from('recurring_confirmations').delete().eq('account_id', accountId);
        await supabase.from('recurring_expenses').delete().eq('account_id', accountId);
        await supabase.from('payment_sources').delete().eq('account_id', accountId);
        await supabase.from('budgets').delete().eq('account_id', accountId);
      }
      await supabase.from('user_profiles').delete().eq('id', user.id);
      await supabase.auth.signOut();
    } catch {
      setDeletingAccount(false); setSaveError('שגיאה במחיקת הנתונים');
    }
  };

  // ── Members / Invitations ────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteRole, setInviteRole]       = useState('partner');
  const [inviting, setInviting]           = useState(false);
  const [inviteError, setInviteError]     = useState<string | null>(null);
  const [invitations, setInvitations]     = useState<Invitation[]>([]);
  const [invitationsSupported, setInvitationsSupported] = useState(true);
  const [inviteFetchCounter, setInviteFetchCounter] = useState(0);
  const [copiedToken, setCopiedToken]         = useState<string | null>(null);
  const [lastCopiedScope, setLastCopiedScope] = useState<InviteScope>('public');
  const [removingMemberId, setRemovingMemberId]   = useState<string | null>(null);

  // Account type conversion (owner-only)
  const [pendingAccountType, setPendingAccountType] = useState<AccountType | null>(null);
  const [savingAccountType, setSavingAccountType]   = useState(false);
  const [accountTypeError, setAccountTypeError]     = useState<string | null>(null);
  const [accountTypeSaved, setAccountTypeSaved]     = useState(false);

  // ── Billing / Subscription ───────────────────────────────────────────────
  const [billingResult, setBillingResult]         = useState<SubscriptionFetchResult | null>(null);
  const [billingLoading, setBillingLoading]       = useState(false);
  // Default checkout plan to current account type — keeps billing plan in sync with structure
  const [checkoutPlan, setCheckoutPlan] = useState<'personal' | 'couple' | 'family'>(
    () => planForAccountType(accountType),
  );

  // Clear ?billing= param from URL after reading it (avoids stale banner on back-nav)
  useEffect(() => {
    if (!searchParams.get('billing')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('billing');
    setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== 'billing' || !accountId) return;
    // Sync checkout plan default to current account type each time section opens
    setCheckoutPlan(planForAccountType(accountType));
    setBillingLoading(true);
    fetchAccountSubscription(accountId).then(result => {
      setBillingResult(result);
      setBillingLoading(false);
    });
  }, [activeSection, accountId, accountType]);

  const refetchInvitations = useCallback(() => setInviteFetchCounter(c => c + 1), []);

  useEffect(() => {
    if (activeSection !== 'account' || !accountId || isPersonal) {
      setInvitations([]); return;
    }
    supabase.from('account_invitations')
      .select('id, email, role, token, status, created_at')
      .eq('account_id', accountId).eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setInvitationsSupported(false); return; }
        setInvitationsSupported(true);
        setInvitations((data ?? []) as Invitation[]);
      });
  }, [accountId, isPersonal, inviteFetchCounter, activeSection]);

  const handleInvite = async () => {
    if (!user || !accountId || !inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('כתובת דוא״ל לא תקינה'); return;
    }
    if (invitations.some(i => i.email.toLowerCase() === inviteEmail.trim().toLowerCase())) {
      setInviteError('הזמנה ממתינה כבר קיימת לכתובת זו'); return;
    }
    setInviting(true); setInviteError(null);
    const { error } = await supabase.from('account_invitations').insert({
      account_id: accountId, invited_by: user.id,
      email: inviteEmail.trim().toLowerCase(), role: inviteRole,
    });
    setInviting(false);
    if (error) { setInviteError(`שגיאה: ${error.message}`); return; }
    setInviteEmail(''); refetchInvitations();
  };

  const handleRevokeInvitation = async (id: string) => {
    const { error } = await supabase.from('account_invitations')
      .update({ status: 'revoked' }).eq('id', id);
    if (!error) refetchInvitations();
  };

  const handleCopyInviteLink = async (token: string) => {
    const { url, scope } = buildInviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setLastCopiedScope(scope);
      setTimeout(() => { setCopiedToken(null); setLastCopiedScope('public'); }, 4000);
    } catch { window.prompt('העתק קישור:', url); }
  };

  const handleChangeAccountType = async () => {
    if (!accountId || !pendingAccountType || pendingAccountType === accountType) return;
    // Guard: downgrade to personal only when no extra members exist
    if (pendingAccountType === 'personal' && members.length > 1) {
      setAccountTypeError('לא ניתן לעבור לחשבון אישי כאשר יש חברים נוספים — הסר אותם תחילה');
      return;
    }
    setSavingAccountType(true); setAccountTypeError(null);
    const { error } = await supabase.from('accounts')
      .update({ type: pendingAccountType }).eq('id', accountId);
    setSavingAccountType(false);
    if (error) { setAccountTypeError('שגיאה בשמירה — נסה שוב'); return; }
    setPendingAccountType(null);
    setAccountTypeSaved(true);
    setTimeout(() => setAccountTypeSaved(false), 3000);
    refetchAccount();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!accountId) return;
    setRemovingMemberId(memberId);
    await supabase.from('account_members').delete()
      .eq('account_id', accountId).eq('user_id', memberId);
    setRemovingMemberId(null); refetchAccount();
  };

  // ── Data Export / Import ─────────────────────────────────────────────────
  const [exporting, setExporting]       = useState(false);
  const [exportError, setExportError]   = useState<string | null>(null);

  const handleExportXLSX = async () => {
    if (!accountId) return;
    setExporting(true); setExportError(null);
    const { data, error } = await supabase.from('financial_movements')
      .select('date, type, category, sub_category, description, amount, payment_method, notes')
      .eq('account_id', accountId).order('date', { ascending: false });
    setExporting(false);
    if (error || !data) { setExportError('שגיאה בהורדת הנתונים'); return; }
    try {
      const XLSX = await import('xlsx');
      const typeLabel = (t: string) => t === 'expense' ? 'הוצאה' : t === 'income' ? 'הכנסה' : 'העברה';
      const sheetData = (data as MovementRow[]).map(m => ({
        'תאריך': m.date,
        'סוג': typeLabel(m.type),
        'קטגוריה': m.category,
        'תת-קטגוריה': m.sub_category ?? '',
        'תיאור': m.description,
        'סכום': m.amount,
        'אמצעי תשלום': m.payment_method,
        'הערות': m.notes ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'תנועות');
      XLSX.writeFile(wb, `nmoney-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      setExportError('שגיאה ביצירת קובץ ה-Excel');
    }
  };

  const handleExportPDF = async () => {
    if (!accountId) return;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const { data } = await supabase.from('financial_movements')
      .select('date, type, description, amount').eq('account_id', accountId)
      .gte('date', monthStart).order('date', { ascending: false });
    const movements = (data ?? []) as { date: string; type: string; description: string; amount: number }[];
    const income   = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    const expenses = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
    const fmt = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: 2 });
    const acctLabel = accountType === 'couple' ? 'זוגי' : accountType === 'family' ? 'משפחתי' : 'אישי';

    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8">
<title>N.Money — דוח חודשי</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:48px;color:#111;direction:rtl;font-size:13px}
h1{font-size:24px;color:#1E56A0;margin-bottom:4px}
.sub{color:#666;font-size:12px;margin-bottom:32px}
.kpis{display:flex;gap:16px;margin-bottom:32px}
.kpi{flex:1;background:#f0f4fa;border-radius:10px;padding:16px}
.kpi-l{font-size:11px;color:#555;font-weight:bold;text-transform:uppercase;letter-spacing:.05em}
.kpi-v{font-size:22px;font-weight:800;color:#1E56A0;margin-top:4px}
.red{color:#e53e3e}.green{color:#00a86b}
h2{font-size:15px;font-weight:bold;color:#111;margin-bottom:12px;border-bottom:2px solid #1E56A0;padding-bottom:6px;margin-top:28px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{background:#1E56A0;color:#fff;padding:8px 12px;text-align:right;font-size:12px}
td{padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:12px}
tr:nth-child(even) td{background:#fafafa}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;background:#e8f0fb;font-size:12px;font-weight:600}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.footer{color:#aaa;font-size:11px;margin-top:40px;border-top:1px solid #eee;padding-top:12px}
@media print{body{padding:24px}}
</style></head><body>
<h1>N.Money</h1>
<p class="sub">דוח חודשי — ${now.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })} | סוג חשבון: ${acctLabel}</p>
<div class="kpis">
  <div class="kpi"><div class="kpi-l">הכנסות</div><div class="kpi-v green">₪${fmt(income)}</div></div>
  <div class="kpi"><div class="kpi-l">הוצאות</div><div class="kpi-v red">₪${fmt(expenses)}</div></div>
  <div class="kpi"><div class="kpi-l">תזרים נטו</div><div class="kpi-v ${income - expenses >= 0 ? 'green' : 'red'}">₪${fmt(income - expenses)}</div></div>
</div>
<h2>תנועות החודש (${movements.length})</h2>
<table><thead><tr><th>תאריך</th><th>תיאור</th><th>סוג</th><th>סכום</th></tr></thead><tbody>
${movements.slice(0, 50).map(m =>
  `<tr><td>${m.date}</td><td>${m.description}</td>
   <td>${m.type === 'income' ? '✚ הכנסה' : '↘ הוצאה'}</td>
   <td>${m.type === 'expense' ? '−' : '+'}₪${m.amount.toLocaleString('he-IL')}</td></tr>`
).join('')}
</tbody></table>
<h2>אמצעי תשלום</h2>
<div class="chips">${paymentSources.map(s =>
  `<span class="chip"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`
).join('')}</div>
<div class="footer">N.Money — ניהול פיננסי חכם | הופק ${now.toLocaleDateString('he-IL')}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { setExportError('לא ניתן לפתוח חלון — אפשר popup בדפדפן'); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 600);
  };


  // ── handleSave ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError(null);
    if (activeSection === 'profile' && user) {
      const { error } = await supabase.from('user_profiles')
        .update({ display_name: fullName.trim(), employment_type: employmentType || null })
        .eq('id', user.id);
      if (error) { setSaveError('שגיאה בשמירת הפרופיל'); return; }
    }
    if (activeSection === 'budget') {
      try { localStorage.setItem('nmoney_savings_goal_pct', savingsGoalPct); } catch { /* ok */ }
    }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // ── Sidebar sections ─────────────────────────────────────────────────────
  const sections: { id: SettingsSection; icon: string; label: string }[] = [
    { id: 'profile',       icon: '👤', label: 'פרופיל' },
    { id: 'payments',      icon: '🏦', label: 'אמצעי תשלום' },
    { id: 'account',       icon: '👥', label: 'מבנה חשבון' },
    { id: 'billing',       icon: '💳', label: 'תוכנית שימוש' },
    { id: 'security',      icon: '🔒', label: 'אבטחה' },
    { id: 'data',          icon: '📁', label: 'ייצוא וייבוא' },
    { id: 'notifications', icon: '🔔', label: 'התראות' },
    { id: 'appearance',    icon: '🎨', label: 'תצוגה' },
    { id: 'budget',        icon: '📊', label: 'תקציב ברירת מחדל' },
  ];

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition bg-white";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const cardCls    = "p-4 border border-gray-200 rounded-xl";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">הגדרות</h1>
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] space-y-1">
            {sections.map(sec => (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-right"
                style={activeSection === sec.id ? { backgroundColor: '#E8F0FB', color: '#1E56A0' } : { color: '#374151' }}>
                <span className="text-lg">{sec.icon}</span>
                <span>{sec.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">

            {/* ── PROFILE ─────────────────────────────────────────────── */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">פרופיל</h2>
                <p className="text-sm text-gray-500 mb-5">פרטים אלה מסייעים להתאים את החוויה הפיננסית שלך</p>
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ backgroundColor: '#1E56A0' }}>
                    {(fullName || email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{fullName || 'משתמש'}</p>
                    <p className="text-sm text-gray-500">{email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>שם מלא</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="השם שיוצג בחשבון" />
                  </div>
                  <div>
                    <label className={labelClass}>כתובת דוא״ל</label>
                    <input value={email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                    <p className="text-xs text-gray-400 mt-1">ניתן לשנות דרך אפשרות איפוס הסיסמה</p>
                  </div>
                  <div>
                    <label className={labelClass}>מצב תעסוקה</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={inputClass}>
                      <option value="">לא צוין</option>
                      <option value="employed">שכיר/ה</option>
                      <option value="self_employed">עצמאי/ת</option>
                      <option value="business_owner">בעל/ת עסק</option>
                      <option value="student">סטודנט/ית</option>
                      <option value="retired">פנסיונר/ית</option>
                      <option value="other">אחר</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAYMENT SOURCES ─────────────────────────────────────── */}
            {activeSection === 'payments' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">אמצעי תשלום</h2>
                <p className="text-sm text-gray-500 mb-4">
                  כרטיסים, חשבונות ואמצעים שבהם אתה משתמש — משמשים לשיוך ולניתוח עסקאות בלבד
                </p>

                {/* Info note: separation from subscription */}
                <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-gray-500 leading-relaxed"
                  style={{ backgroundColor: '#F0F4FA', border: '1px solid #E5E7EB' }}>
                  💡 אמצעים אלה אינם קשורים למנוי לשירות N.Money — ראה לשונית "תוכנית שימוש" לפרטי חיוב
                </div>

                {srcError && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                    {srcError}
                  </div>
                )}

                {/* Source list */}
                <div className="space-y-2 mb-4">
                  {paymentSources.length === 0 && !showAddSrc && (
                    <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl">
                      <p className="text-sm font-semibold text-gray-600 mb-1">עדיין לא הוגדרו אמצעי תשלום</p>
                      <p className="text-xs text-gray-400 mb-3">הוסף כרטיסים, חשבונות בנק, ביט ועוד</p>
                    </div>
                  )}
                  {paymentSources.map(src => {
                    const typeEntry = SOURCE_TYPES.find(t => t.id === src.type);
                    const typeIcon  = typeEntry?.icon ?? '💳';
                    return (
                      <div key={src.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        {editingSrcId === src.id ? (
                          <div className="p-4 space-y-4 bg-[#FAFBFF]">
                            <div>
                              <label className={labelClass}>שם</label>
                              <input value={editSrcName} onChange={e => setEditSrcName(e.target.value)}
                                className={inputClass} autoFocus />
                            </div>
                            <div>
                              <label className={labelClass}>סוג</label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                                {SOURCE_TYPES.map(t => (
                                  <button key={t.id} onClick={() => setEditSrcType(t.id)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-[10px] border-2 text-sm transition text-right"
                                    style={{
                                      borderColor: editSrcType === t.id ? '#1E56A0' : '#E5E7EB',
                                      backgroundColor: editSrcType === t.id ? '#E8F0FB' : '#fff',
                                    }}>
                                    <span>{t.icon}</span>
                                    <span className="font-semibold text-xs text-gray-800">{t.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>צבע</label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {SOURCE_COLORS.map(c => (
                                  <button key={c} onClick={() => setEditSrcColor(c)}
                                    className="w-7 h-7 rounded-full border-2 transition-all"
                                    style={{ backgroundColor: c, borderColor: editSrcColor === c ? '#1E56A0' : 'transparent',
                                      boxShadow: editSrcColor === c ? '0 0 0 2px #fff, 0 0 0 4px #1E56A0' : 'none' }} />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={handleSaveEdit} disabled={savingEdit || !editSrcName.trim()}
                                className="px-4 py-2 text-white text-sm font-semibold rounded-[10px] disabled:opacity-50 hover:opacity-90 transition"
                                style={{ backgroundColor: '#1E56A0' }}>
                                {savingEdit ? 'שומר...' : 'שמור'}
                              </button>
                              <button onClick={() => setEditingSrcId(null)}
                                className="px-4 py-2 text-sm text-gray-600 font-semibold hover:bg-gray-100 rounded-[10px] transition">
                                ביטול
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-3">
                            {/* Color dot + type icon */}
                            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base"
                              style={{ backgroundColor: src.color + '22', border: `2px solid ${src.color}` }}>
                              {typeIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{src.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400">{getSourceTypeLabel(src.type)}</span>
                                {(srcUsageCounts[src.id] ?? 0) > 0 && (
                                  <span className="text-xs bg-[#E8F0FB] text-[#1E56A0] px-2 py-0.5 rounded-full font-semibold">
                                    {srcUsageCounts[src.id]} עסקאות
                                  </span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => handleStartEdit(src)}
                              className="text-xs text-[#1E56A0] hover:text-blue-700 font-semibold transition px-2">
                              ערוך
                            </button>
                            <button onClick={() => handleDeleteSource(src.id)} disabled={deletingSrcId === src.id}
                              className="text-xs text-red-400 hover:text-red-600 font-semibold disabled:opacity-40 transition px-2">
                              הסר
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add form */}
                {showAddSrc ? (
                  <div className="border border-[#1E56A0]/20 rounded-xl p-4 space-y-4 bg-[#FAFBFF]">
                    <p className="text-sm font-semibold text-gray-800">הוספת אמצעי תשלום</p>

                    {/* Type selector — visual grid */}
                    <div>
                      <label className={labelClass}>סוג</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                        {SOURCE_TYPES.map(t => (
                          <button key={t.id} onClick={() => {
                            setNewSrcType(t.id);
                            // Auto-fill name if empty
                            if (!newSrcName.trim()) setNewSrcName(t.name);
                          }}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border-2 text-right transition"
                            style={{
                              borderColor: newSrcType === t.id ? '#1E56A0' : '#E5E7EB',
                              backgroundColor: newSrcType === t.id ? '#E8F0FB' : '#fff',
                            }}>
                            <span className="text-base">{t.icon}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-gray-800">{t.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{t.hint}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className={labelClass}>שם (לדוגמה: ויזה כאל, בנק הפועלים)</label>
                      <input value={newSrcName} onChange={e => setNewSrcName(e.target.value)}
                        placeholder={SOURCE_TYPES.find(t => t.id === newSrcType)?.name ?? 'שם'}
                        className={inputClass} autoFocus />
                    </div>

                    {/* Color */}
                    <div>
                      <label className={labelClass}>צבע</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {SOURCE_COLORS.map(c => (
                          <button key={c} onClick={() => setNewSrcColor(c)} className="w-7 h-7 rounded-full border-2 transition-all"
                            style={{ backgroundColor: c, borderColor: newSrcColor === c ? '#1E56A0' : 'transparent',
                              boxShadow: newSrcColor === c ? '0 0 0 2px #fff, 0 0 0 4px #1E56A0' : 'none' }} />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddSource} disabled={addingSrc || !newSrcName.trim()}
                        className="px-5 py-2.5 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition hover:opacity-90"
                        style={{ backgroundColor: '#1E56A0' }}>
                        {addingSrc ? 'שומר...' : 'הוסף'}
                      </button>
                      <button onClick={() => { setShowAddSrc(false); setSrcError(null); setNewSrcName(''); }}
                        className="px-5 py-2.5 rounded-[10px] text-sm font-semibold text-gray-600 hover:bg-gray-100 transition">
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddSrc(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: '#E8F0FB', color: '#1E56A0' }}>
                    <span className="font-bold text-base">+</span> הוסף אמצעי תשלום
                  </button>
                )}
              </div>
            )}

            {/* ── ACCOUNT / MEMBERS ───────────────────────────────────── */}
            {activeSection === 'account' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">מבנה חשבון</h2>
                <p className="text-sm text-gray-500 mb-5">הגדר עם מי אתה מנהל את החשבון ומה סוג הניהול</p>

                {/* Account type display + conversion (owner only) */}
                <div className={`${cardCls} mb-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">סוג חשבון</p>
                      <p className="font-bold text-gray-900 text-base">
                        {accountType === 'personal' ? 'אישי' : accountType === 'couple' ? 'זוגי' : 'משפחתי'}
                      </p>
                    </div>
                    <span className="text-2xl">{accountType === 'personal' ? '👤' : accountType === 'couple' ? '👫' : '👨‍👩‍👧‍👦'}</span>
                  </div>

                  {/* Type conversion — owner only */}
                  {currentMember?.role === 'owner' && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-400 mb-2 font-semibold">שנה סוג חשבון:</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {([
                          ['personal', '👤', 'אישי',    'ניהול עצמאי ללא שיתוף'],
                          ['couple',   '👫', 'זוגי',    'הוצאות ותנועות משותפות'],
                          ['family',   '👨‍👩‍👧‍👦', 'משפחתי', 'כל בני הבית בחשבון אחד'],
                        ] as [AccountType, string, string, string][]).map(([t, icon, label, desc]) => {
                          const isCurrentType = t === accountType;
                          const isSelected = pendingAccountType === t;
                          const canDowngrade = t !== 'personal' || members.length <= 1;
                          const disabled = isCurrentType || !canDowngrade;
                          return (
                            <button key={t}
                              disabled={disabled}
                              onClick={() => { setPendingAccountType(t); setAccountTypeError(null); }}
                              title={!canDowngrade ? 'הסר חברים קודם כדי לעבור לחשבון אישי' : ''}
                              className="flex items-center gap-2 px-3 py-2 rounded-[10px] border-2 text-sm transition"
                              style={{
                                borderColor: isSelected ? '#1E56A0' : isCurrentType ? '#1E56A0' : '#e5e7eb',
                                backgroundColor: isSelected ? '#E8F0FB' : isCurrentType ? '#F0F4FA' : '#fff',
                                color: disabled && !isCurrentType ? '#9ca3af' : '#111',
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled && !isCurrentType ? 0.5 : 1,
                              }}>
                              <span>{icon}</span>
                              <span>
                                <span className="font-semibold">{label}</span>
                                <span className="text-xs text-gray-400 block leading-none">{desc}</span>
                              </span>
                              {isCurrentType && <span className="text-[#1E56A0] font-bold text-xs mr-1">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      {accountTypeError && (
                        <p className="text-xs text-red-500 mb-2">{accountTypeError}</p>
                      )}
                      {accountTypeSaved && (
                        <p className="text-xs font-semibold text-[#00A86B] mb-2">✓ סוג החשבון עודכן</p>
                      )}
                      {pendingAccountType && pendingAccountType !== accountType && (
                        <div className="flex gap-2">
                          <button onClick={handleChangeAccountType} disabled={savingAccountType}
                            className="px-4 py-2 rounded-[10px] text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition"
                            style={{ backgroundColor: '#1E56A0' }}>
                            {savingAccountType ? 'שומר...' : 'שמור שינוי'}
                          </button>
                          <button onClick={() => { setPendingAccountType(null); setAccountTypeError(null); }}
                            className="px-4 py-2 rounded-[10px] text-xs font-semibold text-gray-600 hover:bg-gray-100 transition">
                            ביטול
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Members list */}
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">חברי חשבון</p>
                <div className="space-y-2 mb-5">
                  {members.length === 0 && (
                    <p className="text-sm text-gray-400 py-3 text-center">לא נמצאו חברים — שגיאת טעינה</p>
                  )}
                  {members.map(m => {
                    const isMe = m.id === user?.id;
                    const canRemove = !isMe && m.role !== 'owner' && (isCouple || isFamily) && currentMember?.role === 'owner';
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: m.avatarColor }}>
                          {m.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {m.name}{isMe && <span className="text-xs text-gray-400 mr-1">(אתה)</span>}
                          </p>
                          <p className="text-xs text-gray-400">
                            {m.role === 'owner' ? 'בעלים' : m.role === 'partner' ? 'שותף' : 'ילד'}
                          </p>
                        </div>
                        {canRemove && (
                          <button onClick={() => handleRemoveMember(m.id)} disabled={removingMemberId === m.id}
                            className="text-xs text-red-400 hover:text-red-600 font-semibold transition disabled:opacity-40">
                            הסר
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Couple with 1 member — positive nudge */}
                {(isCouple || isFamily) && members.length === 1 && invitationsSupported && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                    style={{ backgroundColor: '#E8F0FB', color: '#1E56A0', border: '1px solid #BFDBFE' }}>
                    החשבון {isCouple ? 'הזוגי' : 'המשפחתי'} מוכן — הזמן את {isCouple ? 'השותף/ה' : 'בני הבית'} כדי להתחיל לנהל יחד
                  </div>
                )}

                {/* Invite section — couple/family only */}
                {(isCouple || isFamily) ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">הזמנת חבר/ה לחשבון</p>

                    {!invitationsSupported ? (
                      <div className="px-4 py-3 rounded-xl text-sm mb-4"
                        style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                        תכונת ההזמנות עדיין לא הופעלה בסביבה זו
                      </div>
                    ) : currentMember?.role !== 'owner' ? (
                      /* Non-owners see read-only notice */
                      <div className="px-4 py-4 border border-gray-100 rounded-xl bg-gray-50 text-center">
                        <p className="text-sm text-gray-500">רק בעל החשבון יכול להזמין חברים חדשים</p>
                      </div>
                    ) : (
                      <>
                        {/* Proactive URL scope warning */}
                        {getCurrentOriginScope() !== 'public' && (
                          <div className="mb-4 px-4 py-3 rounded-xl text-xs leading-relaxed"
                            style={{ backgroundColor: '#FFF7ED', color: '#92400E', border: '1px solid #FED7AA' }}>
                            {getCurrentOriginScope() === 'localhost'
                              ? '⚠️ קישורי ההזמנה פועלים כרגע רק על מכשיר זה. לשיתוף עם אחרים — יש לפרוס את האפליקציה לכתובת ציבורית.'
                              : '⚠️ קישורי ההזמנה פועלים כרגע ברשת המקומית בלבד. לשיתוף חיצוני — יש לפרוס לכתובת ציבורית.'}
                          </div>
                        )}

                        {inviteError && (
                          <div className="mb-3 px-4 py-3 rounded-xl text-sm font-semibold"
                            style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                            {inviteError}
                          </div>
                        )}

                        {/* Invite form */}
                        <div className="border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
                          <div>
                            <label className={labelClass}>כתובת דוא״ל של המוזמן</label>
                            <input type="email" value={inviteEmail}
                              onChange={e => { setInviteEmail(e.target.value); setInviteError(null); }}
                              placeholder="name@example.com" className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>תפקיד</label>
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inputClass}>
                              <option value="partner">שותף — גישה מלאה לחשבון</option>
                              <option value="child">ילד — חבר משפחה</option>
                            </select>
                          </div>
                          <div className="flex items-start gap-3 pt-1">
                            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                              className="px-5 py-2.5 rounded-[10px] text-white text-sm font-semibold disabled:opacity-50 transition hover:opacity-90"
                              style={{ backgroundColor: '#1E56A0' }}>
                              {inviting ? 'יוצר...' : 'צור קישור הזמנה'}
                            </button>
                            <p className="text-xs text-gray-400 pt-1 leading-relaxed">
                              לא נשלח דוא״ל — שתף את קישור ההזמנה ידנית עם המוזמן
                            </p>
                          </div>
                        </div>

                        {/* Pending invitations */}
                        {invitations.length > 0 ? (
                          <>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">הזמנות ממתינות</p>
                            <div className="space-y-2">
                              {invitations.map(inv => (
                                <div key={inv.id} className="border border-amber-100 rounded-xl bg-amber-50 overflow-hidden">
                                  <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{inv.email}</p>
                                      <p className="text-xs text-gray-400">
                                        {inv.role === 'partner' ? 'שותף' : 'ילד'} • {new Date(inv.created_at).toLocaleDateString('he-IL')}
                                      </p>
                                    </div>
                                    <button onClick={() => handleCopyInviteLink(inv.token)}
                                      className="text-xs text-[#1E56A0] hover:text-blue-700 font-semibold transition whitespace-nowrap">
                                      {copiedToken === inv.token ? '✓ הועתק' : 'העתק קישור'}
                                    </button>
                                    <button onClick={() => handleRevokeInvitation(inv.id)}
                                      className="text-xs text-red-400 hover:text-red-600 font-semibold transition">
                                      בטל
                                    </button>
                                  </div>
                                  {/* Per-invite scope hint after copy */}
                                  {copiedToken === inv.token && lastCopiedScope !== 'public' && (
                                    <div className="px-4 pb-2 text-xs text-amber-700">
                                      ⚠️ קישור זה פועל {lastCopiedScope === 'localhost' ? 'על מכשיר זה בלבד' : 'ברשת המקומית בלבד'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 text-center py-2">אין הזמנות ממתינות</p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* Personal account — offer upgrade */
                  <div className="px-4 py-4 border border-gray-100 rounded-xl bg-gray-50">
                    <p className="text-sm font-semibold text-gray-700 mb-1">חשבון אישי</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      רוצה לנהל עם בן/בת זוג או בני משפחה?
                      {currentMember?.role === 'owner'
                        ? ' שנה את סוג החשבון למעלה והזמן אותם בקלות.'
                        : ' בעל החשבון יכול לשדרג לחשבון זוגי או משפחתי.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── BILLING / SUBSCRIPTION ──────────────────────────────── */}
            {activeSection === 'billing' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">תוכנית שימוש</h2>
                <p className="text-sm text-gray-500 mb-4">בחר את מסלול השימוש המתאים לך</p>

                {/* ── Launch period banner — always visible ──────────────── */}
                <div className="mb-5 px-4 py-4 rounded-xl"
                  style={{ backgroundColor: '#E8F0FB', border: '1px solid #BFDBFE' }}>
                  <p className="font-bold text-[#1E56A0] text-sm mb-1">N.Money בתקופת הרצה</p>
                  <p className="text-xs text-[#1e3a8a] leading-relaxed">
                    השירות כרגע חינמי לחלוטין. תוכל לבחור את המסלול המתאים לך — חיוב טרם הופעל.
                  </p>
                </div>

                {/* Status summary */}
                <div className={`${cardCls} mb-4`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">סטטוס שימוש</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">סטטוס</p>
                      <p className="font-semibold text-gray-800">תקופת הרצה</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">עלות בפועל</p>
                      <p className="font-semibold text-[#00A86B]">חינם</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">מסלול נבחר</p>
                      <p className="font-semibold text-gray-800">{planLabel(checkoutPlan)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">חיוב</p>
                      <p className="font-semibold text-gray-500">טרם הופעל</p>
                    </div>
                  </div>
                </div>

                {/* Plan selector */}
                <div className={cardCls}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">בחר מסלול שימוש</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {([
                      ['personal', '👤', 'אישי',    'לניהול עצמאי', 'הוצאות, תקציב וחיסכון אישי'],
                      ['couple',   '👫', 'זוגי',    'לשניים',        'ניהול משותף עם בן/בת זוג'],
                      ['family',   '👨‍👩‍👧‍👦', 'משפחתי', 'לכל הבית',    'כל בני הבית בחשבון אחד'],
                    ] as const).map(([p, icon, label, sub, detail]) => {
                      const isSelected = checkoutPlan === p;
                      return (
                        <button key={p} onClick={() => setCheckoutPlan(p)}
                          className="flex flex-col gap-1 px-4 py-3 rounded-xl border-2 text-right transition"
                          style={{
                            borderColor: isSelected ? '#1E56A0' : '#E5E7EB',
                            backgroundColor: isSelected ? '#E8F0FB' : '#fff',
                          }}>
                          <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="font-bold text-sm text-gray-900">{label}</span>
                            {isSelected && <span className="text-[10px] text-[#1E56A0] font-bold mr-auto">✓</span>}
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{sub}</span>
                          <span className="text-[11px] text-gray-400 leading-snug">{detail}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      /* Save preferred plan to localStorage for UX continuity — actual billing is not yet active */
                      try { localStorage.setItem('nmoney_preferred_plan', checkoutPlan); } catch { /* ok */ }
                    }}
                    className="w-full py-2.5 rounded-[10px] text-white text-sm font-semibold hover:opacity-90 transition"
                    style={{ backgroundColor: '#1E56A0' }}>
                    שמור מסלול נבחר
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    הבחירה נשמרת לצורך הכנת החשבון — חיוב יופעל בהודעה מוקדמת
                  </p>
                </div>

                {/* If billing infra is available, show subscription state */}
                {!billingLoading && billingResult?.ok === true && (() => {
                  const sub = (billingResult as { ok: true; data: AccountSubscription | null }).data;
                  if (!sub) return null;
                  return (
                    <div className="mt-4 space-y-3">
                      <div className={cardCls}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">מנוי רשום</p>
                            <p className="font-bold text-gray-900 text-base">{planLabel(sub.plan)}</p>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: statusColor(sub.status) }}>
                            {statusLabel(sub.status)}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
                          {sub.trial_end && sub.status === 'trialing' && (
                            <p>תקופת ניסיון עד: <strong>{formatBillingDate(sub.trial_end)}</strong></p>
                          )}
                          {sub.current_period_end && sub.status !== 'canceled' && (
                            <p>
                              {sub.cancel_at_period_end ? 'פעיל עד:' : 'חידוש ב:'}{' '}
                              <strong>{formatBillingDate(sub.current_period_end)}</strong>
                            </p>
                          )}
                          {sub.cancel_at_period_end && (
                            <p className="text-orange-600 font-semibold text-xs mt-1">
                              ⚠️ המנוי יבוטל בסוף התקופה הנוכחית
                            </p>
                          )}
                          {sub.status === 'past_due' && (
                            <p className="text-red-600 font-semibold text-xs mt-1">
                              ⚠️ תשלום נכשל — פנו לתמיכה לעדכון פרטי תשלום
                            </p>
                          )}
                        </div>
                      </div>
                      {!isSubscriptionSynced(accountType, sub) && (
                        <div className="px-4 py-3 rounded-xl text-xs leading-relaxed"
                          style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                          ⚠️ מסלול המנוי ({planLabel(sub.plan)}) שונה ממבנה החשבון ({accountType === 'couple' ? 'זוגי' : accountType === 'family' ? 'משפחתי' : 'אישי'}) — פנו לתמיכה
                        </div>
                      )}
                      <div className="px-4 py-3 rounded-xl text-sm text-gray-500 text-center"
                        style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        לביטול מנוי או עדכון פרטי תשלום — פנו לתמיכה
                      </div>
                    </div>
                  );
                })()}

                {/* Billing history */}
                <div className={`${cardCls} mt-4`}>
                  <p className="font-semibold text-gray-900 mb-1">היסטוריית חיוב</p>
                  <p className="text-sm text-gray-400">
                    לא בוצעו חיובים בתקופת ההרצה הנוכחית. היסטוריה תופיע כאן כאשר החיוב יופעל.
                  </p>
                </div>

              </div>
            )}

            {/* ── SECURITY ────────────────────────────────────────────── */}
            {activeSection === 'security' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">אבטחה</h2>
                <p className="text-sm text-gray-500 mb-5">הגן על החשבון שלך ועל הנתונים הפיננסיים שלך</p>
                <div className="space-y-4">

                  {/* Auth method + password reset */}
                  <div className={cardCls}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 mb-0.5">שיטת כניסה</p>
                        <p className="text-sm text-gray-500">
                          דוא״ל וסיסמה
                          {mfaActive ? <span className="text-[#00A86B] font-semibold"> + אימות דו-שלבי</span> : null}
                        </p>
                      </div>
                      <span className="text-xs bg-[#E8F0FB] text-[#1E56A0] px-3 py-1 rounded-full font-semibold">דוא״ל</span>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500 mb-2">שלח קישור לאיפוס סיסמה לכתובת: <strong>{user?.email}</strong></p>
                      {passwordResetError && <p className="text-sm text-red-500 mb-2">{passwordResetError}</p>}
                      {passwordResetSent ? (
                        <p className="text-sm font-semibold text-[#00A86B]">✓ קישור נשלח — בדוק את תיבת הדוא״ל</p>
                      ) : (
                        <button onClick={handleSendPasswordReset}
                          className="px-5 py-2.5 bg-[#1E56A0] text-white rounded-[10px] text-sm font-semibold hover:opacity-90 transition active:scale-[0.98]">
                          שלח קישור לשינוי סיסמה
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2FA / TOTP */}
                  <div className={cardCls}>
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-semibold text-gray-900">אימות דו-שלבי</p>
                        <p className="text-sm text-gray-500">מגן על החשבון גם אם הסיסמה נחשפת</p>
                      </div>
                      {mfaLoading ? (
                        <span className="text-xs text-gray-400">בודק...</span>
                      ) : mfaActive ? (
                        <span className="text-xs bg-[#E8F8F2] text-[#00A86B] px-3 py-1 rounded-full font-semibold">פעיל ✓</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-semibold">לא פעיל</span>
                      )}
                    </div>
                    {!mfaLoading && !mfaActive && !mfaEnrolling && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-400 mb-2">עובד עם Google Authenticator, Microsoft Authenticator, Authy ועוד</p>
                        <button onClick={handleMFAEnroll}
                          className="px-5 py-2.5 bg-[#1E56A0] text-white rounded-[10px] text-sm font-semibold hover:opacity-90 transition">
                          הפעל אימות דו-שלבי
                        </button>
                      </div>
                    )}
                    {mfaError && <p className="text-sm text-red-500 mt-2">{mfaError}</p>}
                    {mfaEnrolling && (
                      <div className="space-y-4 mt-3">
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div className="w-40 h-40 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden bg-white flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: mfaQRCode }} />
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-semibold text-gray-700">1. פתח את אפליקציית ה-Authenticator</p>
                            <p className="text-sm text-gray-600">2. סרוק את קוד ה-QR, או הזן את המפתח ידנית:</p>
                            <code className="block text-xs bg-gray-100 px-3 py-2 rounded-lg font-mono break-all select-all">
                              {mfaSecret}
                            </code>
                            <p className="text-sm text-gray-600">3. הזן את הקוד שמוצג באפליקציה:</p>
                          </div>
                        </div>
                        <div className="flex gap-3 items-center flex-wrap">
                          <input type="text" inputMode="numeric" maxLength={6}
                            value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className={`${inputClass} max-w-[160px] text-center text-lg tracking-[.25em] font-mono`}
                            style={{ fontVariantNumeric: 'tabular-nums' }} />
                          <button onClick={handleMFAVerify} disabled={mfaVerifying || mfaCode.length < 6}
                            className="px-5 py-2.5 bg-[#1E56A0] text-white rounded-[10px] text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition">
                            {mfaVerifying ? 'מאמת...' : 'אמת והפעל'}
                          </button>
                          <button onClick={() => { setMfaEnrolling(false); setMfaCode(''); setMfaError(null); }}
                            className="px-4 py-2.5 text-sm text-gray-600 font-semibold hover:bg-gray-100 rounded-[10px] transition">
                            ביטול
                          </button>
                        </div>
                      </div>
                    )}
                    {!mfaLoading && mfaActive && !mfaEnrolling && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">האימות הדו-שלבי מגן על חשבונך</p>
                        <button onClick={handleMFAUnenroll}
                          className="text-sm text-red-500 hover:text-red-600 font-semibold transition">
                          בטל
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete account */}
                  <div className="p-4 border border-red-100 rounded-xl bg-red-50">
                    <p className="font-semibold text-red-700 mb-1">מחיקת חשבון</p>
                    <p className="text-sm text-red-500 mb-3">
                      פעולה בלתי הפיכה — כל הנתונים הפיננסיים שלך יימחקו.
                      {!isPersonal && ' בחשבון משותף, שאר החברים לא יושפעו.'}
                    </p>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="px-5 py-2.5 border border-red-300 text-red-600 rounded-[10px] text-sm font-semibold hover:bg-red-100 transition">
                        מחק את החשבון שלי
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-red-700">הקלד <strong>מחק</strong> לאישור:</p>
                        <div className="flex gap-3 items-center flex-wrap">
                          <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                            placeholder="מחק" className={`${inputClass} max-w-[140px]`}
                            style={{ borderColor: '#FECACA' }} />
                          <button onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'מחק' || deletingAccount}
                            className="px-5 py-2.5 bg-red-600 text-white rounded-[10px] text-sm font-semibold disabled:opacity-40 hover:bg-red-700 transition">
                            {deletingAccount ? 'מוחק...' : 'מחק לצמיתות'}
                          </button>
                          <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                            className="px-4 py-2.5 text-sm text-gray-600 font-semibold hover:bg-gray-100 rounded-[10px] transition">
                            ביטול
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── DATA MANAGEMENT ─────────────────────────────────────── */}
            {activeSection === 'data' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">ייצוא וייבוא</h2>
                <p className="text-sm text-gray-500 mb-5">הוצא נתונים לניתוח חיצוני או יבא היסטוריה קיימת</p>

                {exportError && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                    {exportError}
                  </div>
                )}

                {/* ── Export ───────────────────────────────────────────── */}
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">ייצוא נתונים</p>
                  <div className="space-y-2">

                    {/* Excel export — primary */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📊</span>
                        <div>
                          <p className="font-semibold text-gray-900">ייצוא ל-Excel</p>
                          <p className="text-sm text-gray-500">כל תנועות החשבון — נפתח ישירות ב-Excel ו-Google Sheets</p>
                        </div>
                      </div>
                      <button onClick={handleExportXLSX} disabled={exporting}
                        className="px-4 py-2 bg-[#E8F0FB] text-[#1E56A0] rounded-[10px] text-sm font-semibold hover:bg-blue-100 transition whitespace-nowrap disabled:opacity-50">
                        {exporting ? 'מייצא...' : 'הורד Excel'}
                      </button>
                    </div>

                    {/* PDF — primary */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📄</span>
                        <div>
                          <p className="font-semibold text-gray-900">דוח חודשי — PDF</p>
                          <p className="text-sm text-gray-500">סיכום החודש הנוכחי לשמירה או להדפסה</p>
                        </div>
                      </div>
                      <button onClick={handleExportPDF}
                        className="px-4 py-2 bg-[#E8F0FB] text-[#1E56A0] rounded-[10px] text-sm font-semibold hover:bg-blue-100 transition whitespace-nowrap">
                        PDF / הדפסה
                      </button>
                    </div>

                  </div>
                </div>

                {/* ── Import wizard ─────────────────────────────────────── */}
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">ייבוא היסטוריה</p>
                  <ImportWizard
                    accountId={accountId}
                    userId={user?.id}
                    paymentSources={paymentSources}
                  />
                </div>

                {/* Google Sheets — future direction */}
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">חיבורים חיצוניים</p>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📋</span>
                      <div>
                        <p className="font-semibold text-gray-900">Google Sheets — סינכרון</p>
                        <p className="text-sm text-gray-400">ייצוא וייבוא אוטומטי מגיליון Google Sheets</p>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-400 px-3 py-1 rounded-full font-semibold whitespace-nowrap">בקרוב</span>
                  </div>
                </div>

                {/* Backup */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">גיבוי</p>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">☁️</span>
                      <div>
                        <p className="font-semibold text-gray-900">גיבוי אוטומטי לענן</p>
                        <p className="text-sm text-gray-500">כל הנתונים מגובים בזמן אמת — לא נדרשת פעולה</p>
                      </div>
                    </div>
                    <span className="text-xs bg-[#E8F8F2] text-[#00A86B] px-3 py-1 rounded-full font-semibold">פעיל ✓</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ────────────────────────────────────────── */}
            {activeSection === 'notifications' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">התראות</h2>
                <p className="text-sm text-gray-500 mb-4">העדפות נשמרות במכשיר זה — המשלוח יופעל כשתשתית ההתראות תהיה מוכנה</p>

                {/* Financial alerts group */}
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">התראות פיננסיות</p>
                  <div className={`${cardCls} space-y-0 divide-y divide-gray-50`}>
                    {[
                      { key: 'budget_approaching', label: 'חריגה קרובה מתקציב', desc: 'כשקטגוריה מגיעה ל-80% מהתקציב החודשי' },
                      { key: 'budget_exceeded',    label: 'חריגה מהתקציב',      desc: 'כשסה״כ ההוצאות עוברות את התקציב שהגדרת' },
                      { key: 'savings_goal_met',   label: 'השגת יעד חיסכון',    desc: 'כשמגיעים ליעד החיסכון החודשי' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleNotif(item.key)}
                          className="relative w-12 h-6 rounded-full flex-shrink-0 mr-2 transition-colors duration-200"
                          style={{ backgroundColor: notifs[item.key] ? '#1E56A0' : '#d1d5db' }}
                          aria-label={notifs[item.key] ? 'כבה התראה' : 'הפעל התראה'}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${notifs[item.key] ? 'left-6' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reports & reminders group */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">תזכורות ודוחות</p>
                  <div className={`${cardCls} space-y-0 divide-y divide-gray-50`}>
                    {[
                      { key: 'weekly_summary',   label: 'סיכום שבועי',         desc: 'סיכום הוצאות כל יום ראשון בבוקר' },
                      { key: 'monthly_report',   label: 'סיכום חודשי',         desc: 'דוח מלא ב-1 לכל חודש' },
                      { key: 'fixed_expense_reminder', label: 'תזכורת הוצאה קבועה', desc: '3 ימים לפני מועד חיוב מתוכנן' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleNotif(item.key)}
                          className="relative w-12 h-6 rounded-full flex-shrink-0 mr-2 transition-colors duration-200"
                          style={{ backgroundColor: notifs[item.key] ? '#1E56A0' : '#d1d5db' }}
                          aria-label={notifs[item.key] ? 'כבה התראה' : 'הפעל התראה'}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${notifs[item.key] ? 'left-6' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── APPEARANCE ──────────────────────────────────────────── */}
            {activeSection === 'appearance' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">תצוגה</h2>
                <p className="text-sm text-gray-500 mb-5">הגדרות תצוגה של האפליקציה</p>
                <div>
                  <label className={labelClass}>שפה</label>
                  <select value={language} className={`${inputClass} opacity-60 cursor-not-allowed`} disabled>
                    <option value="he">עברית</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">N.Money זמינה בעברית בלבד בשלב זה</p>
                </div>
              </div>
            )}

            {/* ── BUDGET DEFAULTS ──────────────────────────────────────── */}
            {activeSection === 'budget' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">תקציב ברירת מחדל</h2>
                <p className="text-sm text-gray-500 mb-5">הגדר את יעד החיסכון שלך — משפיע על ציון הבריאות הפיננסית</p>
                <div>
                  <label className={labelClass}>יעד חיסכון חודשי</label>
                  <div className="flex items-center gap-4 mb-2">
                    <input type="range" min="5" max="50" step="5" value={savingsGoalPct}
                      onChange={e => setSavingsGoalPct(e.target.value)} className="flex-1 accent-[#1E56A0]" />
                    <span className="text-lg font-bold text-[#1E56A0] w-12 text-center flex-shrink-0">{savingsGoalPct}%</span>
                  </div>
                  <div className="px-3 py-2 rounded-lg text-xs text-gray-600"
                    style={{ backgroundColor: '#F0F4FA' }}>
                    יעד של {savingsGoalPct}% מהכנסתך — משמש לחישוב ציון הבריאות הפיננסית בלוח המחוונים.
                    {Number(savingsGoalPct) >= 20 ? ' מעולה — מתאים לשיטת 50/30/20.' : ' שיטת 50/30/20 ממליצה על 20% לפחות.'}
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            {['profile', 'budget'].includes(activeSection) && (
              <div className="flex items-center gap-4 mt-6 pt-5 border-t border-gray-100">
                <button onClick={handleSave}
                  className="px-8 py-3 rounded-[10px] text-white font-bold text-sm transition hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: '#1E56A0', boxShadow: '0 2px 8px rgba(30,86,160,0.25)' }}>
                  שמור שינויים
                </button>
                {saved && <span className="text-sm font-semibold text-[#00A86B]">✓ נשמר בהצלחה</span>}
                {saveError && <span className="text-sm font-semibold text-red-500">{saveError}</span>}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
