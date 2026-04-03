import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountProvider, useAccount } from './context/AccountContext';
import { MonthProvider } from './context/MonthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetPage from './pages/BudgetPage';
import IncomesPage from './pages/IncomesPage';
import OnboardingPage from './pages/OnboardingPage';
import FixedExpensesPage from './pages/FixedExpensesPage';
import LoansPage from './pages/LoansPage';
import AssetsPage from './pages/AssetsPage';
import GoalsPage from './pages/GoalsPage';
import CalculatorsPage from './pages/CalculatorsPage';
import GuidesPage from './pages/GuidesPage';
import SettingsPage from './pages/SettingsPage';
import ExpenseAnalysisPage from './pages/ExpenseAnalysisPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import AppLayout from './components/AppLayout';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading }                          = useAuth();
  const { onboardingCompleted, accountLoading }    = useAccount();
  const location                                   = useLocation();

  if (loading || accountLoading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding until it is completed — but never loop back to itself
  if (!onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  const isOnboarding = location.pathname === '/onboarding';
  return isOnboarding
    ? <>{children}</>
    : <AppLayout>{children}</AppLayout>;
};

/**
 * Wraps public-only routes (login, signup).
 * If the user is already authenticated, redirect to ?redirect= target (or /dashboard).
 * This ensures /login?redirect=/invite/token works even when already logged in.
 */
const RedirectIfAuthed: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  if (!user) return <>{children}</>;
  const r = searchParams.get('redirect') ?? '';
  return <Navigate to={r.startsWith('/') ? r : '/dashboard'} replace />;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/signup" element={<RedirectIfAuthed><SignupPage /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget"
        element={
          <ProtectedRoute>
            <BudgetPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incomes"
        element={
          <ProtectedRoute>
            <IncomesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fixed-expenses"
        element={
          <ProtectedRoute>
            <FixedExpensesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/loans"
        element={
          <ProtectedRoute>
            <LoansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assets"
        element={
          <ProtectedRoute>
            <AssetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <GoalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calculators"
        element={
          <ProtectedRoute>
            <CalculatorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guides"
        element={
          <ProtectedRoute>
            <GuidesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses-analysis"
        element={
          <ProtectedRoute>
            <ExpenseAnalysisPage />
          </ProtectedRoute>
        }
      />

      {/* Invite acceptance — public, handles its own auth state */}
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <MonthProvider>
            <div dir="rtl" className="min-h-screen bg-white text-right">
              <AppRoutes />
            </div>
          </MonthProvider>
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
