import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NMoneyLogo from '../components/NMoneyLogo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Safe redirect: only follow internal paths (starts with /)
  const redirectTo = (() => {
    const r = searchParams.get('redirect') ?? '';
    return r.startsWith('/') ? r : '/dashboard';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהתחברות. נסה שוב.');
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ברוך הבא בחזרה</h1>
          <p className="text-gray-500 mb-8">נכנס לחשבון שלך</p>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-[#FEF2F2] border border-red-200 text-[#E53E3E] rounded-[10px] p-4 text-sm">
              {error}
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
                  className="w-full pr-12 pl-4 py-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                סיסמה
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-12 pl-4 py-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-left">
              <Link to="/forgot-password" className="text-[#1E56A0] text-sm hover:underline">
                שכחת סיסמה?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[10px] font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#1E56A0',
                boxShadow: '0 2px 8px rgba(30,86,160,0.25)',
              }}
            >
              {loading ? 'מתחבר...' : 'כניסה'}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-500 mt-8">
            עדיין אין לך חשבון?{' '}
            <Link to="/signup" className="text-[#1E56A0] font-semibold hover:underline">
              הרשם כאן
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

          {/* Quote */}
          <h2 className="text-2xl font-bold text-white mb-8">ניהול כסף חכם מתחיל במודעות</h2>

          {/* Feature bullets */}
          <div className="space-y-4 text-right">
            {[
              'מעקב הוצאות והכנסות בזמן אמת',
              'תקציב חכם שמתאים את עצמו',
              'תובנות פיננסיות אוטומטיות',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm">✓</span>
                </div>
                <span className="text-white/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
