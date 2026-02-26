import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { getSystemBranding } from '../api/system';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, refreshMe } = useAuth();

  const navState = location.state as { username?: string } | null;
  const [username, setUsername] = useState(navState?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(() => localStorage.getItem('systemLogoUrl'));

  useEffect(() => {
    let cancelled = false;
    getSystemBranding()
      .then((res) => {
        if (cancelled) return;
        localStorage.setItem('systemLogoUrl', res.logoUrl || '');
        localStorage.setItem('systemName', res.systemName || '');
        setSystemLogoUrl(res.logoUrl || null);
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
        setError('Cannot reach server. Is the backend running on port 8080?');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          {systemLogoUrl ? (
            <img
              src={systemLogoUrl}
              alt="System logo"
              className="mx-auto h-16 w-16 rounded-xl object-cover mb-4"
            />
          ) : (
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold mb-4">
              A
            </div>
          )}
          <div className="text-2xl font-bold text-slate-900">Welcome Back</div>
          <div className="mt-2 text-sm text-slate-600">Sign in to access your attendance dashboard</div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">Username or email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username or email"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            className="w-full rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
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

          <button
            type="button"
            disabled={loading}
            className="w-full rounded-md border border-slate-300 px-4 py-3 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
            onClick={() => navigate('/register')}
          >
            Register New Company
          </button>

        </form>
      </div>
    </div>
  );
}
