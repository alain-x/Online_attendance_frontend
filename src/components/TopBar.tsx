import React from 'react';
import { useAuth } from '../auth/AuthContext';

export default function TopBar() {
  const { user, logout } = useAuth();

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-slate-900">Attendance System</div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="text-sm text-slate-700">
              {user.username} <span className="text-slate-400">({user.role})</span>
              {user.companySlug ? <span className="text-slate-400"> · {user.companySlug}</span> : null}
            </div>
          ) : null}
          {user ? (
            <button
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
              onClick={logout}
              type="button"
            >
              Logout
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
