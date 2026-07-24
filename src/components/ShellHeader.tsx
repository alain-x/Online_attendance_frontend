import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getSystemBranding } from '../api/system';
import { applyFavicon } from '../utils/favicon';
import { updateMyProfileImage, deleteMyProfileImage } from '../api/users';

type ShellHeaderProps = {
  title?: string;
  onMenuClick?: () => void;
};

export default function ShellHeader({ title, onMenuClick }: ShellHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const [systemLogoError, setSystemLogoError] = useState(false);
  const [companyLogoError, setCompanyLogoError] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [systemName, setSystemName] = useState(() => localStorage.getItem('systemName') || '');
  const [systemLogoUrlState, setSystemLogoUrlState] = useState(() => {
    const raw = localStorage.getItem('systemLogoUrl') || '';
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && raw.startsWith('http://')) {
      let upgraded = `https://${raw.substring('http://'.length)}`;
      try {
        const u = new URL(upgraded);
        if (u.protocol === 'https:' && u.port === '80') {
          u.port = '';
          upgraded = u.toString();
        }
      } catch {}
      localStorage.setItem('systemLogoUrl', upgraded);
      return upgraded;
    }
    return raw;
  });

  const logoLetter = (user?.companySlug || 'A').trim().charAt(0).toUpperCase();
  const logoUrlRaw = user?.companyLogoUrl || null;
  const logoUrl = logoUrlRaw && (/^[a-zA-Z]:\\/.test(logoUrlRaw) || logoUrlRaw.startsWith('file:')) ? null : logoUrlRaw;
  const logoBust = localStorage.getItem('companyLogoBust');
  const displayCompanyLogoUrl = logoUrl && logoBust ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(logoBust)}` : logoUrl;

  const systemLogoUrl = systemLogoUrlState || localStorage.getItem('systemLogoUrl');
  const systemLogoBust = localStorage.getItem('systemLogoBust');
  const sanitizedSystemLogoUrl = systemLogoUrl && (/^[a-zA-Z]:\\/.test(systemLogoUrl) || systemLogoUrl.startsWith('file:')) ? null : systemLogoUrl;
  const httpsSystemLogoUrl =
    sanitizedSystemLogoUrl && typeof window !== 'undefined' && window.location?.protocol === 'https:' && sanitizedSystemLogoUrl.startsWith('http://')
      ? (() => {
          let upgraded = `https://${sanitizedSystemLogoUrl.substring('http://'.length)}`;
          try {
            const u = new URL(upgraded);
            if (u.protocol === 'https:' && u.port === '80') {
              u.port = '';
              upgraded = u.toString();
            }
          } catch {}
          return upgraded;
        })()
      : sanitizedSystemLogoUrl;
  const displaySystemLogoUrl = httpsSystemLogoUrl && systemLogoBust
    ? `${httpsSystemLogoUrl}${httpsSystemLogoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(systemLogoBust)}`
    : httpsSystemLogoUrl;

  const companyContextLabel = localStorage.getItem('companyContextLabel');
  const companyContextIdRaw = localStorage.getItem('companyContextId');
  const companyContextId = companyContextIdRaw ? Number(companyContextIdRaw) : null;
  const isBranchView = user?.companyId != null && companyContextId != null && companyContextId !== user.companyId;

  const userInitial = (user?.username || 'U').trim().charAt(0).toUpperCase();
  const resolvedAvatarSrc = (() => {
    const url = user?.profileImageUrl;
    if (!url || avatarError) return null;
    return url;
  })();

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
    const favicon = localStorage.getItem('systemFaviconUrl');
    if (!name || !ls) {
      getSystemBranding()
        .then((res) => {
          localStorage.setItem('systemLogoUrl', res.logoUrl || '');
          localStorage.setItem('systemName', res.systemName || '');
          localStorage.setItem('systemFaviconUrl', res.faviconUrl || '');
          setSystemLogoUrlState(res.logoUrl || '');
          setSystemName(res.systemName || '');
          document.title = (res.systemName && res.systemName.trim()) ? res.systemName.trim() : 'SportClub Pro';
          applyFavicon(res.faviconUrl);
          setSystemLogoError(false);
        })
        .catch(() => {});
    } else {
      setSystemName(name || '');
      setSystemLogoUrlState(ls || '');
      document.title = name && name.trim() ? name.trim() : 'SportClub Pro';
      applyFavicon(favicon);
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      await updateMyProfileImage(file);
      window.location.reload();
    } catch {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoDelete() {
    setPhotoUploading(true);
    try {
      await deleteMyProfileImage();
      window.location.reload();
    } catch {
      setPhotoUploading(false);
    }
  }

  return (
    <div className="w-full bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md">
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
            {systemName || 'SportClub Pro'}
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
                onClick={() => {
                  setAvatarError(false);
                  setProfileOpen((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 pl-1 pr-2 py-1 hover:bg-white/15 transition-all active:scale-95"
                aria-label="Open user profile"
                aria-expanded={profileOpen}
              >
                {resolvedAvatarSrc ? (
                  <img
                    src={resolvedAvatarSrc}
                    alt={user.username}
                    className="h-9 w-9 rounded-full object-cover bg-white/20 ring-2 ring-white/25"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
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
                <svg className={`h-4 w-4 text-white/80 transition-transform ${profileOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl z-50 animate-[fadeIn_0.15s_ease-out]">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b">
                    <div className="flex items-center gap-3">
                      {resolvedAvatarSrc ? (
                        <img
                          src={resolvedAvatarSrc}
                          alt={user.username}
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                          onError={() => setAvatarError(true)}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold shadow-sm">
                          {userInitial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{user.username}</div>
                        <div className="text-[11px] text-slate-500">{user.role}</div>
                      </div>
                    </div>
                    {user.companySlug ? (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 bg-white/80 rounded-lg px-2 py-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <span>Viewing: <span className="font-medium text-slate-700">{companyContextLabel || user.companySlug}</span></span>
                        {isBranchView ? <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Branch</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <label className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{photoUploading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
                      {photoUploading && <svg className="animate-spin h-4 w-4 ml-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    </label>
                    <button
                      type="button"
                      onClick={handlePhotoDelete}
                      disabled={photoUploading}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full disabled:opacity-50 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Photo
                    </button>
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 w-full transition-colors"
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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
