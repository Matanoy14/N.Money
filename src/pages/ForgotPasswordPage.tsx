import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import NMoneyLogo from '../components/NMoneyLogo';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הקישור. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Form Panel (Right side in RTL) */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-10">
            <NMoneyLogo size="md" variant="blue" />
            <span className="text-xl font-bold text-gray-900">N.Money</span>
          </Link>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">איפוס סיסמה</h1>
          <p className="text-gray-500 mb-8">נשלח לך קישור לאיפוס הסיסמה</p>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-[#FEF2F2] border border-red-200 text-[#E53E3E] rounded-[10px] p-4 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-6 bg-[#E8F8F2] border border-green-200 text-[#00A86B] rounded-[10px] p-4 text-sm">
              ✓ קישור לאיפוס סיסמה נשלח לכתובת הדוא״ל שלך
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                כתובת דוא״ל
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">📧</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pr-12 pl-4 py-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                  disabled={success}
                />
              </div>
            </div>

            {/* Helper text */}
            <p className="text-sm text-gray-400">הכנס את כתובת הדוא״ל המשויכת לחשבונך</p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 rounded-[10px] font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#1E56A0',
                boxShadow: '0 2px 8px rgba(30,86,160,0.25)',
              }}
            >
              {loading ? 'שולח...' : 'שלח קישור'}
            </button>
          </form>

          {/* Back to Login */}
          <p className="text-center mt-8">
            <Link to="/login" className="text-[#1E56A0] font-semibold hover:underline">
              חזור להתחברות
            </Link>
          </p>
        </div>
      </div>

      {/* Branded Panel (Left side in RTL) */}
      <div
        className="hidden md:flex w-1/2 items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D2F6B, #1E56A0)' }}
      >
        {/* Decorative circles */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10 text-center px-12 max-w-lg">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <NMoneyLogo size="lg" variant="glass" />
            <span className="text-2xl font-bold text-white">N.Money</span>
          </div>

          {/* Lock icon */}
          <div className="text-6xl mb-6">🔐</div>

          {/* Text */}
          <h2 className="text-2xl font-bold text-white mb-3">שכחת סיסמה? זה בסדר.</h2>
          <p className="text-white/70">קורה לכולם. נעזור לך לחזור לחשבון</p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
