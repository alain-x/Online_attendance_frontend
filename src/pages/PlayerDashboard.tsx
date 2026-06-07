import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../auth/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { listTrainingSessions, listMatches, listEvaluations, listTeams, getMyPlayerProfile, getPlayerStatistics, getPlayerAnalytics } from '../api/sports';
import type { TrainingSession, Match, PlayerEvaluation, Team, PlayerProfile, PlayerStatistic } from '../api/types';
import { getApiErrorMessage } from '../utils/error';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from 'recharts';

const INITIALS_BG = ['from-amber-500 to-orange-600', 'from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-rose-500 to-pink-600'];

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b'];
const RADAR_COLORS = ['#06b6d4', '#6366f1', '#f59e0b'];

function initialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_BG[Math.abs(hash) % INITIALS_BG.length];
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-600">{label}</div>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }: any) {
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

export default function PlayerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState('dashboard');
  const [profileImgError, setProfileImgError] = useState(false);
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluations, setEvaluations] = useState<PlayerEvaluation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myPlayer, setMyPlayer] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStatistic[]>([]);
  const [loading, setLoading] = useState(true);

  const sidebarItems = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'schedule', label: 'My Schedule' },
    { key: 'stats', label: 'My Stats' },
    { key: 'messages', label: 'Messages' },
  ], []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m, e, teamsData] = await Promise.all([
        listTrainingSessions(),
        listMatches(),
        listEvaluations(),
        listTeams(),
      ]);
      setTrainings(t);
      setMatches(m);
      setEvaluations(e);
      setTeams(teamsData);

      try {
        const player = await getMyPlayerProfile();
        setMyPlayer(player);
        try {
          const playerStats = await getPlayerStatistics(player.id);
          setStats(playerStats);
        } catch {
          // stats optional
        }
      } catch {
        // no player profile yet
      }
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const upcomingTraining = useMemo(() =>
    trainings.filter(t => new Date(t.startTime) > new Date()).slice(0, 3),
    [trainings]
  );
  const upcomingMatches = useMemo(() =>
    matches.filter(m => new Date(m.matchDate) > new Date()).slice(0, 3),
    [matches]
  );
  const latestEval = evaluations[0] || null;

  const completedMatches = useMemo(() =>
    matches.filter(m => m.status === 'COMPLETED' && m.ourScore != null && m.opponentScore != null),
    [matches]
  );

  const winLossDraw = useMemo(() => {
    let wins = 0, losses = 0, draws = 0;
    completedMatches.forEach((m) => {
      if (m.ourScore! > m.opponentScore!) wins++;
      else if (m.ourScore! < m.opponentScore!) losses++;
      else draws++;
    });
    return [
      { name: 'Wins', value: wins },
      { name: 'Losses', value: losses },
      { name: 'Draws', value: draws },
    ];
  }, [completedMatches]);

  const seasonStatsData = useMemo(() =>
    stats.map((s) => ({
      season: s.season,
      'Matches Played': s.matchesPlayed,
      Tries: s.triesScored,
      Assists: s.assists,
      'Passes Completed': s.passesCompleted,
      Tackles: s.tacklesMade,
      'Training %': s.trainingAttendance,
    })),
    [stats]
  );

  const ratingTrendData = useMemo(() =>
    [...evaluations].reverse().map((e) => ({
      period: e.period,
      Rating: e.overallRating,
    })),
    [evaluations]
  );

  const latestEvalCriteria = useMemo(() => {
    if (!latestEval) return [];
    return latestEval.criteria.map((c) => ({
      criterion: c.criterionName,
      score: c.score,
      fullMark: 10,
    }));
  }, [latestEval]);

  const kpiTotals = useMemo(() => {
    if (stats.length === 0) return null;
    return {
      matchesPlayed: stats.reduce((s, x) => s + x.matchesPlayed, 0),
      tries: stats.reduce((s, x) => s + x.triesScored, 0),
      assists: stats.reduce((s, x) => s + x.assists, 0),
      tackles: stats.reduce((s, x) => s + x.tacklesMade, 0),
      attendance: stats.length > 0 ? Math.round(stats.reduce((s, x) => s + x.trainingAttendance, 0) / stats.length) : 0,
    };
  }, [stats]);

  if (loading) {
    return (
      <AppLayout title="Player Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
        <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Player Dashboard" sidebarItems={sidebarItems} activeSidebarKey={section} onSidebarChange={setSection}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {section === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 p-6 sm:p-8">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
            <div className="relative flex items-center gap-5">
              {user?.profileImageUrl && !profileImgError ? (
                <img src={user.profileImageUrl} alt="" onError={() => setProfileImgError(true)} className="h-16 w-16 rounded-full object-cover ring-4 ring-white/20 shadow-lg" />
              ) : (
                <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${initialsColor(user?.username || 'P')} flex items-center justify-center text-xl font-bold text-white ring-4 ring-white/20 shadow-lg`}>
                  {(user?.firstName || user?.username || 'P').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  Welcome, {(user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : (user?.firstName || user?.username || 'Player')}
                </h1>
                <p className="mt-1 text-sm text-indigo-200">
                  {myPlayer ? `${myPlayer.position || 'Player'} \u00B7 ${myPlayer.clubName}` : 'Your sports performance at a glance.'}
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          {kpiTotals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Matches Played" value={kpiTotals.matchesPlayed} color="bg-blue-100 text-blue-600"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>}
              />
              <StatCard label="Tries Scored" value={kpiTotals.tries} color="bg-emerald-100 text-emerald-600"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>}
              />
              <StatCard label="Assists" value={kpiTotals.assists} color="bg-amber-100 text-amber-600"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>}
              />
              <StatCard label="Tackles" value={kpiTotals.tackles} color="bg-rose-100 text-rose-600"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>}
              />
              <StatCard label="Training %" value={`${kpiTotals.attendance}%`} color="bg-violet-100 text-violet-600"
                icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>}
              />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Season Stats Bar Chart */}
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">Season Performance</h3>
                <p className="text-xs text-slate-500">Stats across seasons</p>
              </div>
              {seasonStatsData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={seasonStatsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Matches Played" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Tries" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Assists" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="No stats yet" description="Season statistics will appear once recorded." />
              )}
            </div>

            {/* Radar + Win/Loss */}
            <div className="space-y-6">
              {/* Radar Chart */}
              {latestEvalCriteria.length > 0 && (
                <div className="rounded-xl border bg-white p-5">
                  <div className="mb-2">
                    <h3 className="font-semibold text-slate-900">Skill Assessment</h3>
                    <p className="text-xs text-slate-500">{latestEval?.period} - {latestEval?.teamName}</p>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={latestEvalCriteria}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Win/Loss/Draw Pie */}
              {winLossDraw.some(d => d.value > 0) && (
                <div className="rounded-xl border bg-white p-5">
                  <div className="mb-2">
                    <h3 className="font-semibold text-slate-900">Match Results</h3>
                    <p className="text-xs text-slate-500">{completedMatches.length} completed matches</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-40 w-40 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={winLossDraw} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                            {winLossDraw.map((entry, i) => (
                              <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {winLossDraw.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span className="text-slate-600">{d.name}</span>
                          <span className="ml-auto font-semibold text-slate-900">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rating Trend + Latest Eval */}
          <div className="grid gap-6 lg:grid-cols-2">
            {ratingTrendData.length > 1 && (
              <div className="rounded-xl border bg-white p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">Performance Rating Trend</h3>
                  <p className="text-xs text-slate-500">Coach evaluation scores over time</p>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Line type="monotone" dataKey="Rating" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Latest Evaluation */}
            {latestEval && (
              <div className="rounded-xl border bg-white p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">Latest Evaluation</h3>
                  <p className="text-xs text-slate-500">{latestEval.period} - {latestEval.teamName}</p>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white ${
                    latestEval.overallRating >= 8 ? 'bg-emerald-500' :
                    latestEval.overallRating >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}>
                    {latestEval.overallRating}/10
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">By {latestEval.evaluatorName}</p>
                    {latestEval.coachNotes && (
                      <p className="mt-1 text-sm text-slate-600 line-clamp-3">{latestEval.coachNotes}</p>
                    )}
                  </div>
                </div>
                {latestEval.criteria.length > 0 && (
                  <div className="space-y-2">
                    {latestEval.criteria.map((c) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-slate-600">{c.criterionName}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-2 rounded-full transition-all ${
                            c.score >= 8 ? 'bg-emerald-500' :
                            c.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} style={{ width: `${c.score * 10}%` }} />
                        </div>
                        <span className="w-6 text-right text-xs font-medium text-slate-700">{c.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule Previews */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Upcoming Training</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{upcomingTraining.length}</span>
              </div>
              <div className="divide-y">
                {upcomingTraining.length === 0 ? (
                  <EmptyState title="No upcoming training" description="Your training schedule will appear here." />
                ) : (
                  upcomingTraining.map((t) => (
                    <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(t.startTime).toLocaleDateString()} at {new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {t.location && ` - ${t.location}`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-white">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Upcoming Matches</h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{upcomingMatches.length}</span>
              </div>
              <div className="divide-y">
                {upcomingMatches.length === 0 ? (
                  <EmptyState title="No upcoming matches" description="Your match schedule will appear here." />
                ) : (
                  upcomingMatches.map((m) => (
                    <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">{m.teamName} vs {m.opponent}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(m.matchDate).toLocaleDateString()} - {m.type} ({m.homeAway})
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'schedule' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold text-slate-900">Training Sessions</h3></div>
            <div className="divide-y">
              {trainings.map((t) => (
                <div key={t.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-slate-900">{t.title}</div>
                  <div className="text-xs text-slate-500">{new Date(t.startTime).toLocaleString()} - {t.teamName}</div>
                </div>
              ))}
              {trainings.length === 0 && <EmptyState title="No training sessions" />}
            </div>
          </div>
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold text-slate-900">Matches</h3></div>
            <div className="divide-y">
              {matches.map((m) => (
                <div key={m.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-slate-900">{m.teamName} vs {m.opponent}</div>
                  <div className="text-xs text-slate-500">{new Date(m.matchDate).toLocaleDateString()} - {m.type}</div>
                </div>
              ))}
              {matches.length === 0 && <EmptyState title="No matches" />}
            </div>
          </div>
        </div>
      )}

      {section === 'stats' && (
        <div className="space-y-6">
          {/* Season Stats Chart */}
          {seasonStatsData.length > 0 && (
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">Season Comparison - All Stats</h3>
                <p className="text-xs text-slate-500">Complete performance breakdown by season</p>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={seasonStatsData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="season" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Matches Played" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tries" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Assists" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tackles" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Passes Completed" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Training Attendance Bar */}
          {seasonStatsData.length > 0 && (
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">Training Attendance Rate</h3>
                <p className="text-xs text-slate-500">Percentage of sessions attended</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={seasonStatsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="Training %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Rating Trend */}
          {ratingTrendData.length > 0 && (
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">Evaluation Ratings Over Time</h3>
                <p className="text-xs text-slate-500">Coach rating trend</p>
              </div>
              {ratingTrendData.length > 1 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Line type="monotone" dataKey="Rating" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500">More evaluations needed to show a trend.</div>
              )}
            </div>
          )}

          {/* All Evaluations */}
          {evaluations.length === 0 ? (
            <div className="rounded-xl border bg-white p-5">
              <EmptyState title="No evaluations yet" description="Your coach will evaluate your performance." />
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">All Evaluations</h3>
              {evaluations.map((ev) => (
                <div key={ev.id} className="rounded-xl border bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-slate-900">{ev.period}</span>
                      <span className="text-xs text-slate-500 ml-2">{ev.teamName}</span>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${
                      ev.overallRating >= 8 ? 'bg-emerald-500' :
                      ev.overallRating >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}>
                      {ev.overallRating}
                    </div>
                  </div>
                  {ev.criteria.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-600 w-24">{c.criterionName}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-2 rounded-full ${
                          c.score >= 8 ? 'bg-emerald-500' :
                          c.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} style={{ width: `${c.score * 10}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-5 text-right">{c.score}</span>
                    </div>
                  ))}
                  {ev.coachNotes && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-600">{ev.coachNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'messages' && (
        <div className="rounded-xl border bg-white p-8">
          <EmptyState title="Messages" description="Coach messages and team announcements will appear here." />
        </div>
      )}
    </AppLayout>
  );
}
