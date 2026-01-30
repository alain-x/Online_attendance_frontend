import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCompany } from '../api/companies';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';

function getApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

export default function RegisterCompanyPage() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await registerCompany({ companyName, companySlug, adminUsername, adminPassword });
      showToast('Company registered successfully! Redirecting to login...', 'success');
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            companySlug,
            username: adminUsername,
          },
        });
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to register company');
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold mb-4">
            A
          </div>
          <div className="text-2xl font-bold text-slate-900">Register Your Company</div>
          <div className="mt-2 text-sm text-slate-600">Create a company account and get started</div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">Company name</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Company slug</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
              placeholder="e.g. acme"
              autoComplete="off"
            />
            <div className="mt-1 text-xs text-slate-500">Used to identify your company in the system.</div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Admin email</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Admin password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="new-password"
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
                <LoadingSpinner size="sm" className="text-white" />
                Creating...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Company
              </>
            )}
          </button>

          <button
            type="button"
            disabled={loading}
            className="w-full rounded-md border border-slate-300 px-4 py-3 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
