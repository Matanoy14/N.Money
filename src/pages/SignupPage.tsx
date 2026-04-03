import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NMoneyLogo from '../components/NMoneyLogo';

const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להיות לפחות 6 תווים');
      return;
    }

    setLoading(true);

    try {
      await signup(email, password, fullName);
      // Thread redirect through onboarding so user returns to invite after setup
      const dest = redirectParam.startsWith('/')
        ? `/onboarding?redirect=${encodeURIComponent(redirectParam)}`
        : '/onboarding';
      navigate(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהרשמה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, label: 'הרשמה', active: true },
    { number: 2, label: 'הגדרות', active: false },
    { number: 3, label: 'התחלה', active: false },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">צור חשבון חדש</h1>
          <p className="text-gray-500 mb-8">הצעד הראשון לשליטה פיננסית</p>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-[#FEF2F2] border border-red-200 text-[#E53E3E] rounded-[10px] p-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                שם מלא
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">👤</span>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="יוחנן כהן"
                  className="w-full pr-12 pl-4 py-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                אימות סיסמה
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-12 pl-4 py-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20 transition placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                className="w-4 h-4 mt-1 rounded border-gray-300 accent-[#1E56A0]"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                אני מסכים/ה ל
                <a href="#" className="text-[#1E56A0] hover:underline font-medium">
                  תנאי השימוש
                </a>{' '}
                ו
                <a href="#" className="text-[#1E56A0] hover:underline font-medium">
                  מדיניות הפרטיות
                </a>
              </label>
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
              {loading ? 'יוצר חשבון...' : 'הרשמה'}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-gray-500 mt-8">
            כבר יש לך חשבון?{' '}
            <Link to="/login" className="text-[#1E56A0] font-semibold hover:underline">
              התחבר כאן
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
          <h2 className="text-2xl font-bold text-white mb-8">הצעד הראשון לחירות פיננסית</h2>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0">
            {steps.map((step, i) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      step.active ? 'bg-white text-[#0D2F6B]' : 'bg-white/30 text-white'
                    }`}
                  >
                    {step.number}
                  </div>
                  <span className={`text-sm ${step.active ? 'text-white font-semibold' : 'text-white/50'}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-16 h-[2px] bg-white/20 mb-6 mx-2" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
