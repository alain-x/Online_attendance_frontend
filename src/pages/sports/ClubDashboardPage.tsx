import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { getClubDashboardStats } from '../../api/sports';
import type { ClubDashboardStats } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

type ClubDashboardPageProps = {
  onNavigate: (section: string) => void;
};

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

  const statCards = [
    { label: 'Total Players', value: stats.totalPlayers, color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'Total Teams', value: stats.totalTeams, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Upcoming Matches', value: stats.upcomingMatches, color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { label: 'Upcoming Training', value: stats.upcomingTraining, color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Club Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of your sports club activities and statistics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl border ${card.color} p-5`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{card.value}</div>
                <div className="mt-1 text-sm font-medium opacity-80">{card.label}</div>
              </div>
              <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
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
