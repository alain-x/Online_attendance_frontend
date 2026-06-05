import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterCompanyPage = lazy(() => import('./pages/RegisterCompanyPage'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PayrollDashboard = lazy(() => import('./pages/PayrollDashboard'));
const SystemAdminDashboard = lazy(() => import('./pages/SystemAdminDashboard'));
const RecorderDashboard = lazy(() => import('./pages/RecorderDashboard'));
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const AuditorDashboard = lazy(() => import('./pages/AuditorDashboard'));
const PublicFormPage = lazy(() => import('./pages/PublicFormPage'));

function RoleHomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'SYSTEM_ADMIN') return <Navigate to="/system-admin" replace />;
  if (user.role === 'AUDITOR') return <Navigate to="/auditor" replace />;
  if (user.role === 'PAYROLL') return <Navigate to="/payroll" replace />;
  if (user.role === 'RECORDER') return <Navigate to="/recorder" replace />;
  if (user.role === 'EMPLOYEE') return <Navigate to="/employee" replace />;
  if (user.role === 'HR') return <Navigate to="/hr" replace />;
  if (user.role === 'MANAGER') return <Navigate to="/manager" replace />;
  return <Navigate to="/admin" replace />;
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}

function App() {
  return (
    <SuspenseWrapper>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterCompanyPage />} />

        <Route
          path="/employee"
          element={
            <ProtectedRoute roles={['EMPLOYEE', 'RECORDER', 'ADMIN']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/recorder"
          element={
            <ProtectedRoute roles={['RECORDER', 'ADMIN']}>
              <RecorderDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN', 'HR', 'MANAGER']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr"
          element={
            <ProtectedRoute roles={['HR', 'ADMIN']}>
              <HRDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={['MANAGER', 'ADMIN']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll"
          element={
            <ProtectedRoute roles={['ADMIN', 'HR', 'MANAGER', 'PAYROLL', 'AUDITOR']}>
              <PayrollDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auditor"
          element={
            <ProtectedRoute roles={['AUDITOR', 'ADMIN']}>
              <AuditorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/system-admin"
          element={
            <ProtectedRoute roles={['SYSTEM_ADMIN']}>
              <SystemAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/forms/:token" element={<PublicFormPage />} />

        <Route path="/" element={<RoleHomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SuspenseWrapper>
  );
}

export default App;
