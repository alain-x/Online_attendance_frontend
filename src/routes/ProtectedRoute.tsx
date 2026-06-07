import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

import type { Role } from '../api/types';

const HIERARCHY: Record<string, string[]> = {
  SYSTEM_ADMIN: ['ADMIN', 'CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT', 'EMPLOYEE', 'HR', 'MANAGER', 'RECORDER', 'PAYROLL', 'AUDITOR'],
  ADMIN: ['CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT', 'EMPLOYEE', 'HR', 'MANAGER', 'RECORDER', 'PAYROLL', 'AUDITOR'],
  CLUB_ADMIN: ['COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT', 'EMPLOYEE', 'HR', 'MANAGER', 'RECORDER', 'PAYROLL', 'AUDITOR'],
  COACH: ['PLAYER'],
  TEAM_MANAGER: ['PLAYER'],
  HR: ['EMPLOYEE'],
  MANAGER: ['EMPLOYEE'],
  RECORDER: ['EMPLOYEE'],
};

function hasAccess(userRole: string, allowedRoles: string[]): boolean {
  if (allowedRoles.includes(userRole)) return true;
  const inherited = HIERARCHY[userRole];
  if (!inherited) return false;
  return inherited.some((r) => allowedRoles.includes(r));
}

type ProtectedRouteProps = {
  children: React.ReactElement;
  roles?: Role[];
};

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !hasAccess(user.role, roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
