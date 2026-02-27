import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterCompanyPage from './pages/RegisterCompanyPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import PayrollDashboard from './pages/PayrollDashboard';
import SystemAdminDashboard from './pages/SystemAdminDashboard';
import RecorderDashboard from './pages/RecorderDashboard';
import HRDashboard from './pages/HRDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AuditorDashboard from './pages/AuditorDashboard';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './auth/AuthContext';

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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCompanyPage />} />

      <Route
        path="/employee"
        element={
          <ProtectedRoute roles={["EMPLOYEE", "RECORDER", "ADMIN"]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recorder"
        element={
          <ProtectedRoute roles={["RECORDER", "ADMIN"]}>
            <RecorderDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["ADMIN", "HR", "MANAGER"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/hr"
        element={
          <ProtectedRoute roles={["HR", "ADMIN"]}>
            <HRDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager"
        element={
          <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payroll"
        element={
          <ProtectedRoute roles={["ADMIN", "HR", "MANAGER", "PAYROLL", "AUDITOR"]}>
            <PayrollDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/auditor"
        element={
          <ProtectedRoute roles={["AUDITOR", "ADMIN"]}>
            <AuditorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/system-admin"
        element={
          <ProtectedRoute roles={["SYSTEM_ADMIN"]}>
            <SystemAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
