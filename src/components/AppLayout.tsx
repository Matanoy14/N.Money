import React, { useState } from 'react';
import NMoneyLogo from './NMoneyLogo';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const coreNavItems: NavItem[] = [
  { path: '/dashboard',        label: 'דשבורד',          icon: '🏠' },
  { path: '/transactions',     label: 'הוצאות',           icon: '📋' },
  { path: '/incomes',          label: 'הכנסות',           icon: '💰' },
  { path: '/budget',           label: 'תקציב',            icon: '📊' },
  { path: '/fixed-expenses',   label: 'הוצאות קבועות',   icon: '🔄' },
  { path: '/expenses-analysis',label: 'ניתוח הוצאות',    icon: '📈' },
];

const wealthNavItems: NavItem[] = [
  { path: '/loans',  label: 'הלוואות', icon: '💳' },
  { path: '/assets', label: 'נכסים',   icon: '🏦' },
  { path: '/goals',  label: 'מטרות',   icon: '🎯' },
];

const toolsNavItems: NavItem[] = [
  { path: '/calculators', label: 'מחשבונים',         icon: '🧮' },
  { path: '/guides',      label: 'מדריכים פיננסיים', icon: '📚' },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showFab = !location.pathname.startsWith('/settings');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const activeClass  = 'bg-white/15 text-white font-semibold';
  const defaultClass = 'text-white/60 hover:bg-white/8 hover:text-white/85';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-150 ${
      isActive ? activeClass : defaultClass
    }`;

  const sectionLabel = (label: string) => (
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-3 pt-4 pb-1.5">
      {label}
    </p>
  );

  // Mobile bottom tabs
  const mobileTabItems = [
    { path: '/dashboard',    label: 'דשבורד', icon: '🏠' },
    { path: '/transactions', label: 'הוצאות', icon: '📋' },
    { path: '/budget',       label: 'תקציב',  icon: '📊' },
    { path: '/incomes',      label: 'הכנסות', icon: '💰' },
    { path: '/settings',     label: 'הגדרות', icon: '⚙️' },
  ];

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'משתמש';
  const avatarLetter = displayName[0].toUpperCase();

  return (
    <div className="min-h-screen flex" dir="rtl">

      {/* ── Desktop Sidebar (RIGHT in RTL) ────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[240px] fixed right-0 top-0 h-screen z-40"
        style={{ backgroundColor: '#0B1F4A', borderLeft: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <NMoneyLogo size="sm" variant="glass" />
            <span className="text-lg font-extrabold text-white tracking-tight">N.Money</span>
          </div>
        </div>

        {/* User card */}
        <div className="px-3 pb-3">
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1E56A0, #2563EB)' }}
            >
              {avatarLetter}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13px] font-semibold truncate">{displayName}</p>
              <p className="text-white/40 text-[11px] truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {sectionLabel('ניהול')}
          <div className="space-y-0.5">
            {coreNavItems.map(item => (
              <NavLink key={item.path} to={item.path} className={navLinkClass}>
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {sectionLabel('עושר')}
          <div className="space-y-0.5">
            {wealthNavItems.map(item => (
              <NavLink key={item.path} to={item.path} className={navLinkClass}>
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {sectionLabel('כלים')}
          <div className="space-y-0.5">
            {toolsNavItems.map(item => (
              <NavLink key={item.path} to={item.path} className={navLinkClass}>
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Bottom actions */}
        <div
          className="px-2 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <NavLink to="/settings" className={navLinkClass}>
            <span className="text-base w-5 text-center flex-shrink-0">⚙️</span>
            <span>הגדרות</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-150 w-full text-right ${defaultClass}`}
          >
            <span className="text-base w-5 text-center flex-shrink-0">🚪</span>
            <span>יציאה</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 lg:mr-[240px] min-h-screen" style={{ backgroundColor: '#F0F4FA' }}>

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NMoneyLogo size="sm" variant="blue" />
            <span className="font-bold text-gray-900 text-sm">N.Money</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600"
          >
            ☰
          </button>
        </div>

        {/* Page content */}
        <div className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </div>

        {/* Desktop FAB — add transaction */}
        {showFab && (
          <button
            onClick={() => navigate('/transactions?add=true')}
            className="hidden lg:flex items-center gap-2 fixed bottom-8 left-8 z-30 px-5 py-3 rounded-full text-white text-sm font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: '#1E56A0', boxShadow: '0 4px 20px rgba(30,86,160,0.35)' }}
          >
            <span className="text-lg leading-none">+</span>
            <span>הוסף עסקה</span>
          </button>
        )}
      </main>

      {/* ── Mobile Bottom Nav ──────────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 h-16 flex items-center"
        style={{ boxShadow: '0 -1px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-around w-full px-2">
          {mobileTabItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                  isActive ? 'text-[#1E56A0]' : 'text-gray-400'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          {/* FAB */}
          <button
            onClick={() => navigate('/transactions?add=true')}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xl -mt-4 shadow-lg"
              style={{ backgroundColor: '#1E56A0', boxShadow: '0 4px 14px rgba(30,86,160,0.4)' }}
            >
              +
            </div>
          </button>
        </div>
      </nav>

      {/* ── Mobile "More" drawer ───────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="lg:hidden fixed top-0 right-0 h-full w-72 z-50 flex flex-col overflow-y-auto"
            style={{ backgroundColor: '#0B1F4A' }}
          >
            <div className="flex items-center justify-between px-4 pt-5 pb-4">
              <div className="flex items-center gap-2">
                <NMoneyLogo size="sm" variant="glass" />
                <span className="text-white font-bold">N.Money</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60"
              >
                ✕
              </button>
            </div>

            <div className="px-2 flex-1">
              {sectionLabel('ניהול')}
              <div className="space-y-0.5">
                {coreNavItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              {sectionLabel('עושר')}
              <div className="space-y-0.5">
                {wealthNavItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              {sectionLabel('כלים')}
              <div className="space-y-0.5">
                {toolsNavItems.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="px-2 pb-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <NavLink
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={navLinkClass}
              >
                <span className="text-base w-5 text-center flex-shrink-0">⚙️</span>
                <span>הגדרות</span>
              </NavLink>
              <button
                onClick={handleLogout}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all w-full text-right mt-0.5 ${defaultClass}`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">🚪</span>
                <span>יציאה</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppLayout;
