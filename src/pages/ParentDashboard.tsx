import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../auth/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { getMyChildren, listTrainingSessions, listMatches, listPayments } from '../api/sports';
import type { ParentLink, TrainingSession, Match, PlayerPayment } from '../api/types';
import { getApiErrorMessage } from '../utils/error';

export default function ParentDashboard() {
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('dashboard');
  const [children, setChildren] = useState<ParentLink[]>([]);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [payments, setPayments] = useState<PlayerPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const sidebarItems = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'children', label: 'My Children' },
    { key: 'payments', label: 'Payments' },
    { key: 'messages', label: 'Messages' },
  ], []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t, m, p] = await Promise.all([
        getMyChildren(),
        listTrainingSessions(),
        listMatches(),
        listPayments(),
      ]);
      setChildren(c);
      setTrainings(t.slice(0, 5));
      setMatches(m.slice(0, 5));
      setPayments(p);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
  const upcomingEvents = [...trainings, ...matches]
    .filter(e => new Date((e as TrainingSession).startTime || (e as Match).matchDate) > new Date())
    .sort((a, b) => new Date((a as TrainingSession).startTime || (a as Match).matchDate).getTime() - new Date((b as TrainingSession).startTime || (b as Match).matchDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <AppLayout title="Parent Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Parent Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {section === 'dashboard' && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Parent Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Stay updated on your children's sports activities.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{children.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Children</div>
                </div>
                <svg className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{upcomingEvents.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Upcoming Events</div>
                </div>
                <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{pendingPayments.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Pending Payments</div>
                </div>
                <svg className="h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">My Children</h3>
              </div>
              <div className="divide-y">
                {children.length === 0 ? (
                  <EmptyState title="No children linked" description="Link your children to view their activities." />
                ) : (
                  children.map((c) => (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{c.playerName}</div>
                        <div className="text-xs text-slate-500">{c.relationship} • #{c.playerId}</div>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{c.relationship}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-white">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Upcoming Events</h3>
              </div>
              <div className="divide-y">
                {upcomingEvents.length === 0 ? (
                  <EmptyState title="No upcoming events" description="Events for your children will appear here." />
                ) : (
                  upcomingEvents.map((e, idx) => {
                    const isTraining = 'title' in e;
                    const dateStr = isTraining
                      ? new Date((e as TrainingSession).startTime).toLocaleString()
                      : new Date((e as Match).matchDate).toLocaleDateString();
                    const title = isTraining ? (e as TrainingSession).title : `${(e as Match).teamName} vs ${(e as Match).opponent}`;
                    return (
                      <div key={`event-${idx}`} className="px-5 py-3">
                        <div className="text-sm font-medium text-slate-900">{title}</div>
                        <div className="text-xs text-slate-500 mt-1">{dateStr}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {pendingPayments.length > 0 && (
            <div className="mt-6 rounded-xl border bg-white">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Pending Payments</h3>
              </div>
              <div className="divide-y">
                {pendingPayments.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{p.feeName} - {p.playerName}</div>
                      <div className="text-xs text-slate-500">Due: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{p.currency} {p.amount.toLocaleString()}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'children' && (
        <div className="space-y-4">
          {children.map((c) => (
            <div key={c.id} className="rounded-xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{c.playerName}</h3>
                  <p className="text-xs text-slate-500">{c.relationship} • Player #{c.playerId}</p>
                </div>
              </div>
            </div>
          ))}
          {children.length === 0 && (
            <EmptyState title="No children linked" description="Contact your club admin to link your children." />
          )}
        </div>
      )}

      {section === 'payments' && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 text-left">Player</th>
                <th className="px-5 py-3 text-left">Fee</th>
                <th className="px-5 py-3 text-left">Amount</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{p.playerName}</td>
                  <td className="px-5 py-3 text-slate-600">{p.feeName}</td>
                  <td className="px-5 py-3 font-medium">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5}><EmptyState title="No payments" /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {section === 'messages' && (
        <div className="rounded-xl border bg-white p-8">
          <EmptyState title="Messages" description="Messages from coaches and club admins will appear here." />
        </div>
      )}
    </AppLayout>
  );
}
