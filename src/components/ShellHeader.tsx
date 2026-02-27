import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getSystemBranding } from '../api/system';

type ShellHeaderProps = {
  title?: string;
  onMenuClick?: () => void;
};

export default function ShellHeader({ title, onMenuClick }: ShellHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [systemLogoError, setSystemLogoError] = useState(false);
  const [companyLogoError, setCompanyLogoError] = useState(false);

  const [systemName, setSystemName] = useState(() => localStorage.getItem('systemName') || '');
  const [systemLogoUrlState, setSystemLogoUrlState] = useState(() => localStorage.getItem('systemLogoUrl') || '');

  const logoLetter = (user?.companySlug || 'A').trim().charAt(0).toUpperCase();
  const logoUrlRaw = user?.companyLogoUrl || null;
  const logoUrl = logoUrlRaw && (/^[a-zA-Z]:\\/.test(logoUrlRaw) || logoUrlRaw.startsWith('file:')) ? null : logoUrlRaw;
  const logoBust = localStorage.getItem('companyLogoBust');
  const displayCompanyLogoUrl = logoUrl && logoBust ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(logoBust)}` : logoUrl;

  const systemLogoUrl = systemLogoUrlState || localStorage.getItem('systemLogoUrl');
  const systemLogoBust = localStorage.getItem('systemLogoBust');
  const sanitizedSystemLogoUrl = systemLogoUrl && (/^[a-zA-Z]:\\/.test(systemLogoUrl) || systemLogoUrl.startsWith('file:')) ? null : systemLogoUrl;
  const displaySystemLogoUrl = sanitizedSystemLogoUrl && systemLogoBust
    ? `${sanitizedSystemLogoUrl}${sanitizedSystemLogoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(systemLogoBust)}`
    : sanitizedSystemLogoUrl;

  const companyContextLabel = localStorage.getItem('companyContextLabel');
  const companyContextIdRaw = localStorage.getItem('companyContextId');
  const companyContextId = companyContextIdRaw ? Number(companyContextIdRaw) : null;
  const isBranchView = user?.companyId != null && companyContextId != null && companyContextId !== user.companyId;

  const userInitial = (user?.username || 'U').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileOpen) return;

    const onDown = (e: MouseEvent) => {
      const el = profileRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setProfileOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  useEffect(() => {
    const ls = localStorage.getItem('systemLogoUrl');
    if (ls && (/^[a-zA-Z]:\\/.test(ls) || ls.startsWith('file:'))) {
      localStorage.removeItem('systemLogoUrl');
    }
    const name = localStorage.getItem('systemName');
    if (!name || !ls) {
      getSystemBranding()
        .then((res) => {
          localStorage.setItem('systemLogoUrl', res.logoUrl || '');
          localStorage.setItem('systemName', res.systemName || '');
          setSystemLogoUrlState(res.logoUrl || '');
          setSystemName(res.systemName || '');
          document.title = (res.systemName && res.systemName.trim()) ? res.systemName.trim() : 'Attendance System';
          setSystemLogoError(false);
        })
        .catch(() => {});
    } else {
      setSystemName(name || '');
      setSystemLogoUrlState(ls || '');
      document.title = name && name.trim() ? name.trim() : 'Attendance System';
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-md">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {user ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex md:hidden items-center justify-center rounded-md bg-white/10 p-2 hover:bg-white/20 transition-colors"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : null}
          {!systemLogoError && displaySystemLogoUrl ? (
            <img
              src={displaySystemLogoUrl || ''}
              alt={user?.companySlug || 'Company logo'}
              className="h-8 w-8 rounded-lg object-cover bg-white/20"
              onError={() => setSystemLogoError(true)}
            />
          ) : !companyLogoError && displayCompanyLogoUrl ? (
            <img
              src={displayCompanyLogoUrl || ''}
              alt={user?.companySlug || 'Company logo'}
              className="h-8 w-8 rounded-lg object-cover bg-white/20"
              onError={() => setCompanyLogoError(true)}
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
              {logoLetter}
            </div>
          )}
          <div className="font-semibold text-base sm:text-lg truncate">
            {systemName || 'Attendance Management System'}
            {title ? ` ${title}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 pl-1 pr-2 py-1 hover:bg-white/15 transition-colors"
                aria-label="Open user profile"
                aria-expanded={profileOpen}
              >
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={user.username}
                    className="h-9 w-9 rounded-full object-cover bg-white/20 ring-2 ring-white/25"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center font-semibold ring-2 ring-white/25">
                    {userInitial}
                  </div>
                )}
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <div className="text-sm font-semibold text-white">{user.username}</div>
                  <div className="text-xs text-white/75">{user.role}</div>
                </div>
                <svg className="h-4 w-4 text-white/80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
                  <div className="px-4 py-3 bg-slate-50 border-b">
                    <div className="text-sm font-semibold">{user.username}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{user.role}</div>
                    {user.companySlug ? (
                      <div className="mt-2 text-xs text-slate-600">
                        Viewing: <span className="font-medium text-slate-900">{companyContextLabel || user.companySlug}</span>
                        {isBranchView ? <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium">Branch</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
