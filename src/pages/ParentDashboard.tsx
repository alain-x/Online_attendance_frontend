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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="mb-1 text-sm font-semibold text-slate-800">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

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

  const pendingPayments = useMemo(() => payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE'), [payments]);

  const paymentStats = useMemo(() => {
    const paid = payments.filter(p => p.status === 'PAID').length;
    const pending = payments.filter(p => p.status === 'PENDING').length;
    const overdue = payments.filter(p => p.status === 'OVERDUE').length;
    return { paid, pending, overdue, total: payments.length };
  }, [payments]);

  const upcomingEvents = useMemo(() =>
    [...trainings, ...matches]
      .filter(e => new Date((e as TrainingSession).startTime || (e as Match).matchDate) > new Date())
      .sort((a, b) => new Date((a as TrainingSession).startTime || (a as Match).matchDate).getTime() - new Date((b as TrainingSession).startTime || (b as Match).matchDate).getTime())
      .slice(0, 5),
    [trainings, matches]
  );

  const totalAmountPaid = useMemo(() =>
    payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  );

  if (loading) {
    return (
      <AppLayout title="Parent Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Parent Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {section === 'dashboard' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 p-6 sm:p-8">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
            <div className="relative">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Parent Dashboard</h1>
              <p className="mt-1 text-sm text-emerald-200">Stay updated on your children's sports activities.</p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{children.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Children</div>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{upcomingEvents.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Upcoming Events</div>
                </div>
                <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">{pendingPayments.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Pending Payments</div>
                </div>
                <div className="rounded-lg bg-amber-100 p-3 text-amber-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Charts + Children Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* My Children */}
            <div className="rounded-xl border bg-white">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">My Children</h3>
              </div>
              <div className="divide-y">
                {children.length === 0 ? (
                  <EmptyState title="No children linked" description="Contact your club admin to link your children." />
                ) : (
                  children.map((c) => (
                    <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white">
                          {c.playerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{c.playerName}</div>
                          <div className="text-xs text-slate-500">Player #{c.playerId}</div>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{c.relationship}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Status Donut */}
            {paymentStats.total > 0 && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-4 font-semibold text-slate-900">Payment Status</h3>
                <div className="flex items-center gap-6">
                  <div className="h-40 w-40 shrink-0 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={[
                          { name: 'Paid', value: paymentStats.paid },
                          { name: 'Pending', value: paymentStats.pending },
                          { name: 'Overdue', value: paymentStats.overdue },
                        ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                          {['Paid', 'Pending', 'Overdue'].filter((_, i) => [paymentStats.paid, paymentStats.pending, paymentStats.overdue][i] > 0).map((name, i) => (
                            <Cell key={name} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-slate-600">Paid</span>
                      <span className="ml-auto font-semibold text-slate-900">{paymentStats.paid}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="text-slate-600">Pending</span>
                      <span className="ml-auto font-semibold text-slate-900">{paymentStats.pending}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-500" />
                      <span className="text-slate-600">Overdue</span>
                      <span className="ml-auto font-semibold text-slate-900">{paymentStats.overdue}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="text-xs text-slate-500">Total paid: {(user as any)?.currency || 'KES'} {totalAmountPaid.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Events + Pending Payments */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Upcoming Events</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{upcomingEvents.length}</span>
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
                      <div key={`event-${idx}`} className="px-5 py-3 flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg ${isTraining ? 'bg-blue-50' : 'bg-indigo-50'} flex items-center justify-center shrink-0`}>
                          <svg className={`h-4 w-4 ${isTraining ? 'text-blue-500' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {isTraining ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            )}
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
                          <div className="text-xs text-slate-500">{dateStr}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-white">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Pending Payments</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{pendingPayments.length}</span>
              </div>
              <div className="divide-y">
                {pendingPayments.length === 0 ? (
                  <EmptyState title="No pending payments" description="All payments are up to date." />
                ) : (
                  pendingPayments.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{p.feeName} - {p.playerName}</div>
                        <div className="text-xs text-slate-500">Due: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="text-sm font-bold text-slate-900">{(user as any)?.currency || 'KES'} {p.amount.toLocaleString()}</div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'children' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <div key={c.id} className="rounded-xl border bg-white p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg font-bold text-white">
                  {c.playerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{c.playerName}</h3>
                  <p className="text-xs text-slate-500">{c.relationship} \u00B7 Player #{c.playerId}</p>
                </div>
              </div>
            </div>
          ))}
          {children.length === 0 && (
            <div className="col-span-2">
              <EmptyState title="No children linked" description="Contact your club admin to link your children." />
            </div>
          )}
        </div>
      )}

      {section === 'payments' && (
        <div className="space-y-4">
          {paymentStats.total > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs text-slate-500">Total Payments</div>
                <div className="text-xl font-bold text-slate-900">{paymentStats.total}</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs text-slate-500">Amount Paid</div>
                <div className="text-xl font-bold text-emerald-600">{(user as any)?.currency || 'KES'} {totalAmountPaid.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs text-slate-500">Pending + Overdue</div>
                <div className="text-xl font-bold text-amber-600">{paymentStats.pending + paymentStats.overdue}</div>
              </div>
            </div>
          )}
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Player</th>
                  <th className="px-5 py-3 text-left font-medium">Fee</th>
                  <th className="px-5 py-3 text-left font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900">{p.playerName}</td>
                    <td className="px-5 py-3 text-slate-600">{p.feeName}</td>
                    <td className="px-5 py-3 font-medium">{(user as any)?.currency || 'KES'} {p.amount.toLocaleString()}</td>
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
