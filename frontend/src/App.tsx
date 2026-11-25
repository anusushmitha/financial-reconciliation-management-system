import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Application Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TransactionListPage } from './pages/transactions/TransactionListPage';
import { TransactionDetailPage } from './pages/transactions/TransactionDetailPage';
import { ImportsPage } from './pages/imports/ImportsPage';
import { ValidationResultsPage } from './pages/imports/ValidationResultsPage';
import { ReconciliationListPage } from './pages/reconciliation/ReconciliationListPage';
import { ReconciliationDetailPage } from './pages/reconciliation/ReconciliationDetailPage';
import { ExceptionListPage } from './pages/exceptions/ExceptionListPage';
import { ExceptionDetailPage } from './pages/exceptions/ExceptionDetailPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AuditHistoryPage } from './pages/audit/AuditHistoryPage';
import { UserManagementPage } from './pages/users/UserManagementPage';
import { ProfilePage } from './pages/profile/ProfilePage';

// Protected Route Guard
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

// Public Route Guard (Redirects to dashboard if already authenticated)
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
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
