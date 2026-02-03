import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterCompanyPage from './pages/RegisterCompanyPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import PayrollDashboard from './pages/PayrollDashboard';
import SystemAdminDashboard from './pages/SystemAdminDashboard';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCompanyPage />} />

      <Route
        path="/employee"
        element={
          <ProtectedRoute roles={["EMPLOYEE"]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["SYSTEM_ADMIN", "ADMIN", "HR", "MANAGER"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payroll"
        element={
          <ProtectedRoute roles={["SYSTEM_ADMIN", "ADMIN", "HR", "MANAGER", "PAYROLL", "AUDITOR"]}>
            <PayrollDashboard />
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

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
