import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { getClubDashboardStats } from '../../api/sports';
import type { ClubDashboardStats } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type ClubDashboardPageProps = {
  onNavigate: (section: string) => void;
};

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

export default function ClubDashboardPage({ onNavigate }: ClubDashboardPageProps) {
  const { toast, showToast, hideToast } = useToast();
  const [stats, setStats] = useState<ClubDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getClubDashboardStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err: unknown) => { if (!cancelled) showToast(getApiErrorMessage(err, 'Failed to load dashboard'), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  const quickActions = [
    { label: 'New Team', section: 'teams', color: 'bg-blue-600 hover:bg-blue-700', icon: 'M12 4v16m8-8H4' },
    { label: 'New Training', section: 'training', color: 'bg-emerald-600 hover:bg-emerald-700', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
    { label: 'New Match', section: 'matches', color: 'bg-indigo-600 hover:bg-indigo-700', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  if (!stats) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        description="Could not load dashboard statistics. Please try again later."
      />
    );
  }

  const chartData = [
    { name: 'Players', value: stats.totalPlayers },
    { name: 'Teams', value: stats.totalTeams },
  ];

  const upcomingData = [
    { name: 'Matches', value: stats.upcomingMatches },
    { name: 'Training', value: stats.upcomingTraining },
  ];

  const totalUpcoming = stats.upcomingMatches + stats.upcomingTraining;
  const hasUpcoming = totalUpcoming > 0;

  const statCards = [
    { label: 'Total Players', value: stats.totalPlayers, color: 'from-blue-500 to-blue-600', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'Total Teams', value: stats.totalTeams, color: 'from-emerald-500 to-emerald-600', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Upcoming Matches', value: stats.upcomingMatches, color: 'from-indigo-500 to-indigo-600', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { label: 'Upcoming Training', value: stats.upcomingTraining, color: 'from-amber-500 to-amber-600', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 p-6 sm:p-8 mb-6">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Club Dashboard</h1>
          <p className="mt-1 text-sm text-slate-300">Overview of your sports club activities and statistics.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl bg-gradient-to-br ${card.color} p-5 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{card.value}</div>
                <div className="mt-1 text-sm font-medium text-white/80">{card.label}</div>
              </div>
              <svg className="h-10 w-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Club Overview</h3>
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Upcoming Activities</h3>
          {hasUpcoming ? (
            <div className="h-64 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={upcomingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {upcomingData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <EmptyState title="No upcoming" description="No matches or training scheduled." />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.section)}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors ${action.color}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
              </svg>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
          </div>
          <div className="p-5">
            <EmptyState
              title="No recent activity"
              description="Activity from your club will appear here."
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-slate-900">Recent Payments</h3>
          </div>
          <div className="p-5">
            {stats.recentPayments > 0 ? (
              <div className="text-sm text-slate-700">
                <span className="font-semibold">{stats.recentPayments}</span> recent payment(s) recorded
              </div>
            ) : (
              <EmptyState
                title="No payments"
                description="Recent payment records will appear here."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
