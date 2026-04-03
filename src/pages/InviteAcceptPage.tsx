import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Only the minimum fields the UI needs — never account_id, email, invited_by, or token
interface InvitationMeta {
  id: string;
  status: string;
  role: string;
}

// Matches the jsonb shape returned by accept_invitation_by_token RPC
interface AcceptResult {
  ok?: boolean;
  error?: 'not_found' | 'revoked' | 'already_accepted' | 'invalid' | 'unauthenticated' | string;
}

type InviteState = 'loading' | 'invalid' | 'revoked' | 'accepted' | 'valid';

const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<InviteState>('loading');
  const [invitation, setInvitation] = useState<InvitationMeta | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Uses security-definer RPC — does not touch account_invitations table directly.
  // anon role can call this; only 3 fields are returned.
  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    supabase
      .rpc('get_invitation_by_token', { p_token: token })
      .then(({ data, error }) => {
        const rows = (data as InvitationMeta[] | null) ?? [];
        if (error || rows.length === 0) { setState('invalid'); return; }
        const inv = rows[0];
        setInvitation(inv);
        if (inv.status === 'revoked')  { setState('revoked');  return; }
        if (inv.status === 'accepted') { setState('accepted'); return; }
        setState('valid');
      });
  }, [token]);

  // Uses security-definer RPC — atomic insert into account_members + status update.
  // Requires authenticated session; auth.uid() is resolved server-side.
  const handleAccept = async () => {
    if (!user || !token) return;
    setAccepting(true);
    setAcceptError(null);

    const { data, error } = await supabase.rpc('accept_invitation_by_token', { p_token: token });

    if (error) {
      setAcceptError('שגיאה בהצטרפות לחשבון — נסה שוב');
      setAccepting(false);
      return;
    }

    const result = (data as AcceptResult | null) ?? {};

    if (result.ok || result.error === 'already_accepted') {
      setAccepted(true);
      setAccepting(false);
      setTimeout(() => navigate('/dashboard'), 2500);
      return;
    }

    const errorMsg =
      result.error === 'not_found'       ? 'הזמנה לא נמצאה' :
      result.error === 'revoked'         ? 'הזמנה בוטלה' :
      result.error === 'unauthenticated' ? 'נדרשת התחברות' :
      result.error === 'email_mismatch'  ? 'כתובת הדוא״ל של חשבונך אינה תואמת להזמנה זו' :
      'שגיאה בהצטרפות לחשבון';
    setAcceptError(errorMsg);
    setAccepting(false);
  };

  const roleLabel =
    invitation?.role === 'partner' ? 'שותף' :
    invitation?.role === 'child'   ? 'ילד'  :
    invitation?.role ?? '';

  return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">

        <div className="text-center mb-6">
          <h1 className="text-xl font-extrabold text-[#1E56A0] mb-1">N.Money</h1>
          <p className="text-xs text-gray-400">ניהול פיננסי חכם</p>
        </div>

        {state === 'loading' && (
          <p className="text-sm text-gray-400 text-center py-6">טוען הזמנה...</p>
        )}

        {state === 'invalid' && (
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">הזמנה לא נמצאה</h2>
            <p className="text-sm text-gray-500 mb-6">
              קישור זה אינו תקין, שפג תוקפו, או שכבר נמחק.
            </p>
            <Link to="/" className="text-sm text-[#1E56A0] font-semibold hover:underline">
              חזור לדף הבית
            </Link>
          </div>
        )}

        {state === 'revoked' && (
          <div className="text-center">
            <div className="text-4xl mb-4">🚫</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">הזמנה בוטלה</h2>
            <p className="text-sm text-gray-500 mb-6">
              בעל החשבון ביטל הזמנה זו. ניתן לפנות אליו לקבלת קישור חדש.
            </p>
            <Link to="/" className="text-sm text-[#1E56A0] font-semibold hover:underline">
              חזור לדף הבית
            </Link>
          </div>
        )}

        {state === 'accepted' && (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">הזמנה כבר נקבלה</h2>
            <p className="text-sm text-gray-500 mb-6">הצטרפות לחשבון זה כבר בוצעה בעבר.</p>
            <Link to="/dashboard" className="text-sm text-[#1E56A0] font-semibold hover:underline">
              עבור ללוח הבקרה
            </Link>
          </div>
        )}

        {state === 'valid' && invitation && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">
              הזמנה להצטרף לחשבון
            </h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              הוזמנת להצטרף כ<strong className="text-gray-700">{roleLabel}</strong> לחשבון
              N.Money משותף
            </p>

            {accepted ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">🎉</div>
                <p className="text-sm font-bold text-[#00A86B]">
                  הצטרפת בהצלחה! מעביר ללוח הבקרה...
                </p>
              </div>
            ) : !user ? (
              <div className="space-y-3">
                <div className="bg-[#FFF7ED] border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 text-center mb-1">
                  עליך להיות מחובר כדי לקבל את ההזמנה.
                  לאחר הכניסה תוחזר אוטומטית לדף זה.
                </div>
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                  className="block w-full py-3 rounded-[10px] text-white text-sm font-semibold text-center hover:opacity-90 transition"
                  style={{ backgroundColor: '#1E56A0' }}>
                  התחבר לחשבון קיים
                </Link>
                <Link
                  to={`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                  className="block w-full py-3 rounded-[10px] text-sm font-semibold text-center border border-gray-200 hover:bg-gray-50 transition text-gray-700">
                  צור חשבון חדש
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#F0F4FA] rounded-xl px-4 py-3 text-sm text-gray-600 text-center">
                  מחובר כ: <strong>{user.email}</strong>
                </div>
                {acceptError && (
                  <div className="px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#FEF2F2', color: '#E53E3E', border: '1px solid #FECACA' }}>
                    {acceptError}
                  </div>
                )}
                <button onClick={handleAccept} disabled={accepting}
                  className="w-full py-3 rounded-[10px] text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#1E56A0' }}>
                  {accepting ? 'מצטרף...' : 'קבל הזמנה והצטרף לחשבון'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  לאחר ההצטרפות תועבר ללוח הבקרה
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default InviteAcceptPage;
