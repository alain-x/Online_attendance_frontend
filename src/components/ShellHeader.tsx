import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type ShellHeaderProps = {
  title?: string;
};

export default function ShellHeader({ title }: ShellHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const logoLetter = (user?.companySlug || 'A').trim().charAt(0).toUpperCase();
  const logoUrl = user?.companyLogoUrl || null;

  const companyContextLabel = localStorage.getItem('companyContextLabel');
  const companyContextIdRaw = localStorage.getItem('companyContextId');
  const companyContextId = companyContextIdRaw ? Number(companyContextIdRaw) : null;
  const isBranchView = user?.companyId != null && companyContextId != null && companyContextId !== user.companyId;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md">
      <div className="px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={user?.companySlug || 'Company logo'}
              className="h-8 w-8 rounded-lg object-cover bg-white/20"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
              {logoLetter}
            </div>
          )}
          <div className="font-semibold text-lg">{title || 'Attendance Management System'}</div>
        </div>

        <div className="flex items-center gap-4">
          {user?.companySlug ? (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              <span className="text-white/70">Viewing:</span>
              <span className="font-medium">{companyContextLabel || user.companySlug}</span>
              {isBranchView ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">Branch</span>
              ) : null}
            </div>
          ) : null}
          {user ? (
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              <span className="text-white/70">User:</span>
              <span className="font-medium">{user.username}</span>
              <span className="text-white/70">({user.role})</span>
            </div>
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
