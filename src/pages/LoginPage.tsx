import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login as loginApi } from '../api/auth';
import { API_BASE_URL } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { getSystemBranding } from '../api/system';
import { applyFavicon } from '../utils/favicon';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, refreshMe } = useAuth();

  const navState = location.state as { username?: string } | null;
  const [username, setUsername] = useState(navState?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(() => {
    const raw = localStorage.getItem('systemLogoUrl');
    if (raw && typeof window !== 'undefined' && window.location?.protocol === 'https:' && raw.startsWith('http://')) {
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

  useEffect(() => {
    let cancelled = false;
    getSystemBranding()
      .then((res) => {
        if (cancelled) return;
        localStorage.setItem('systemLogoUrl', res.logoUrl || '');
        localStorage.setItem('systemName', res.systemName || '');
        localStorage.setItem('systemFaviconUrl', res.faviconUrl || '');
        setSystemLogoUrl(res.logoUrl || null);
        applyFavicon(res.faviconUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter your username.');
      setLoading(false);
      return;
    }

    try {
      const res = await loginApi(trimmedUsername, password);
      if (!res?.token) {
        throw new Error('Login response did not include a token');
      }
      // Persist token both via context and directly to localStorage so the axios interceptor
      // definitely has it before we call /api/auth/me.
      localStorage.setItem('token', res.token);
      setToken(res.token);
      const user = await refreshMe();
      if (user.companySlug) {
        localStorage.setItem('companySlug', user.companySlug);
      }
      if (user.role === 'SYSTEM_ADMIN') {
        navigate('/system-admin', { replace: true });
      } else if (user.role === 'RECORDER') {
        navigate('/recorder', { replace: true });
      } else if (user.role === 'EMPLOYEE') {
        navigate('/employee', { replace: true });
      } else if (user.role === 'HR') {
        navigate('/hr', { replace: true });
      } else if (user.role === 'MANAGER') {
        navigate('/manager', { replace: true });
      } else if (user.role === 'PAYROLL') {
        navigate('/payroll', { replace: true });
      } else if (user.role === 'AUDITOR') {
        navigate('/auditor', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (e2) {
      const status = axios.isAxiosError(e2) ? e2.response?.status : undefined;
      const serverMessage = axios.isAxiosError(e2) ? (e2.response?.data as { message?: string } | undefined)?.message : undefined;
      if (status === 403) {
        setError(serverMessage || 'Access denied (403).');
      } else if (status === 401) {
        setError('Invalid username or password.');
      } else if (status != null) {
        setError(`Login failed (${status}). Check your credentials.`);
      } else if (e2 instanceof Error && e2.message === 'Login response did not include a token') {
        setError('Login succeeded but no token was returned by the server.');
      } else {
        setError(`Cannot reach the server at ${API_BASE_URL}. The backend may be starting up — wait a minute and try again.`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold">SportClub Pro</div>
                <div className="text-emerald-200 text-sm">Sports Management Platform</div>
              </div>
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Manage Your Club<br />
              <span className="text-emerald-200">Like a Pro</span>
            </h1>
            <p className="text-emerald-100 text-lg leading-relaxed max-w-md">
              Teams, players, training, matches, evaluations, payments and attendance — all in one place.
            </p>
          </div>
          <div className="space-y-4 mt-4">
            {[
              'Team & Player Management',
              'Training & Match Scheduling',
              'Performance Evaluations',
              'Payments & Attendance Tracking',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/30 flex items-center justify-center shrink-0">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-emerald-50">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">SportClub Pro</div>
              <div className="text-xs text-slate-500">Sports Management</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <div className="text-center mb-8">
              {systemLogoUrl ? (
                <img
                  src={systemLogoUrl}
                  alt="System logo"
                  className="mx-auto h-16 w-16 rounded-xl object-cover mb-4 shadow-md"
                />
              ) : (
                <div className="mx-auto h-16 w-16 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-md">
                  S
                </div>
              )}
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Sign in to your account</p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username or email</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white font-medium hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign in
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            SportClub Pro &mdash; Professional Sports Management
          </p>
        </div>
      </div>
    </div>
  );
}
