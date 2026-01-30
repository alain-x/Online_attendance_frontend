import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, refreshMe } = useAuth();

  const navState = location.state as { companySlug?: string; username?: string } | null;
  const initialCompanySlug = navState?.companySlug || localStorage.getItem('companySlug') || 'default';
  const [companySlug] = useState(initialCompanySlug);

  const [username, setUsername] = useState(navState?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await loginApi(companySlug, username, password);
      setToken(res.token);
      localStorage.setItem('companySlug', companySlug);
      const user = await refreshMe();
      if (user.role === 'EMPLOYEE') {
        navigate('/employee', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (e2) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold mb-4">
            A
          </div>
          <div className="text-2xl font-bold text-slate-900">Welcome Back</div>
          <div className="mt-2 text-sm text-slate-600">Sign in to access your attendance dashboard</div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">Username</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
