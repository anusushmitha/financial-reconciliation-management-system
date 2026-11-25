import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider } from './context/RealtimeContext';

// Eager Auth & Core Dashboard entry points
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Lazy-loaded Route Chunks for Optimal Bundle Splitting (<500kB per chunk)
const TransactionListPage = lazy(() => import('./pages/transactions/TransactionListPage').then(m => ({ default: m.TransactionListPage })));
const TransactionDetailPage = lazy(() => import('./pages/transactions/TransactionDetailPage').then(m => ({ default: m.TransactionDetailPage })));
const ImportsPage = lazy(() => import('./pages/imports/ImportsPage').then(m => ({ default: m.ImportsPage })));
const ValidationResultsPage = lazy(() => import('./pages/imports/ValidationResultsPage').then(m => ({ default: m.ValidationResultsPage })));
const ReconciliationListPage = lazy(() => import('./pages/reconciliation/ReconciliationListPage').then(m => ({ default: m.ReconciliationListPage })));
const ReconciliationDetailPage = lazy(() => import('./pages/reconciliation/ReconciliationDetailPage').then(m => ({ default: m.ReconciliationDetailPage })));
const ExceptionListPage = lazy(() => import('./pages/exceptions/ExceptionListPage').then(m => ({ default: m.ExceptionListPage })));
const ExceptionDetailPage = lazy(() => import('./pages/exceptions/ExceptionDetailPage').then(m => ({ default: m.ExceptionDetailPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditHistoryPage = lazy(() => import('./pages/audit/AuditHistoryPage').then(m => ({ default: m.AuditHistoryPage })));
const UserManagementPage = lazy(() => import('./pages/users/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ReconciliationRuleBuilderPage = lazy(() => import('./pages/rules/ReconciliationRuleBuilderPage').then(m => ({ default: m.ReconciliationRuleBuilderPage })));

const RouteFallback = () => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>
    Loading module...
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0F172A', color: '#FFFFFF' }}>
        <span>Loading LENDGUARD AI...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <RealtimeProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public Auth Routes */}
                <Route element={<AuthLayout />}>
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <PublicRoute>
                        <ForgotPasswordPage />
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <PublicRoute>
                        <ResetPasswordPage />
                      </PublicRoute>
                    }
                  />
                </Route>

                {/* Protected Application Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/transactions" element={<TransactionListPage />} />
                  <Route path="/transactions/:id" element={<TransactionDetailPage />} />
                  <Route path="/imports" element={<ImportsPage />} />
                  <Route path="/imports/:id/validation" element={<ValidationResultsPage />} />
                  <Route path="/reconciliation-runs" element={<ReconciliationListPage />} />
                  <Route path="/reconciliation-runs/:id" element={<ReconciliationDetailPage />} />
                  <Route path="/exceptions" element={<ExceptionListPage />} />
                  <Route path="/exceptions/:id" element={<ExceptionDetailPage />} />
                  <Route path="/rules" element={<ReconciliationRuleBuilderPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route
                    path="/audit-logs"
                    element={
                      <ProtectedRoute adminOnly>
                        <AuditHistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute adminOnly>
                        <UserManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </RealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
