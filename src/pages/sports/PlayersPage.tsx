import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listPlayers, createPlayer, updatePlayer, deletePlayer, getPlayerStatistics } from '../../api/sports';
import type { PlayerProfile, CreatePlayerRequest, PlayerStatistic } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

function PlayerAvatar({ player, size = 'sm' }: { player: PlayerProfile; size?: 'sm' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  const initial = (player.firstName || player.username || '?').charAt(0).toUpperCase();
  const imgSrc = player.profileImageUrl;

  if (imgSrc && !imgError) {
    const dimClass = size === 'lg' ? 'h-24 w-24' : 'h-10 w-10';
    return (
      <img
        src={imgSrc}
        alt={`${player.firstName || ''} ${player.lastName || ''}`.trim() || player.username}
        onError={() => setImgError(true)}
        className={`${dimClass} rounded-full object-cover ring-2 ring-white shadow-sm`}
      />
    );
  }

  const dimClass = size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-10 w-10 text-sm';
  return (
    <div className={`${dimClass} flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white ring-2 ring-white shadow-sm`}>
      {initial}
    </div>
  );
}

export default function PlayersPage() {
  const { toast, showToast, hideToast } = useToast();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PlayerProfile | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStatistic[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CreatePlayerRequest>({ userId: 0, clubId: 1, dateOfBirth: '', height: undefined, weight: undefined, position: '', medicalNotes: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlayers();
      setPlayers(data);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load players'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadStats = useCallback(async (playerId: number) => {
    setStatsLoading(true);
    try {
      const data = await getPlayerStatistics(playerId);
      setStats(data);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load stats'), 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedPlayer) loadStats(selectedPlayer.id);
  }, [selectedPlayer, loadStats]);

  function openCreate() {
    setEditTarget(null);
    setForm({ userId: 0, clubId: 1, dateOfBirth: '', height: undefined, weight: undefined, position: '', medicalNotes: '' });
    setShowModal(true);
  }

  function openEdit(p: PlayerProfile) {
    setEditTarget(p);
    setForm({ userId: p.userId, clubId: p.clubId, dateOfBirth: p.dateOfBirth || '', height: p.height ?? undefined, weight: p.weight ?? undefined, position: p.position || '', medicalNotes: p.medicalNotes || '' });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId) { showToast('User ID is required', 'error'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updatePlayer(editTarget.id, form);
        showToast('Player updated', 'success');
      } else {
        await createPlayer(form);
        showToast('Player created', 'success');
      }
      setShowModal(false);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save player'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this player?')) return;
    try {
      await deletePlayer(id);
      showToast('Player deleted', 'success');
      if (selectedPlayer?.id === id) setSelectedPlayer(null);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete player'), 'error');
    }
  }

  const filtered = search.trim()
    ? players.filter(p => `${p.firstName || ''} ${p.lastName || ''} ${p.username || ''} ${p.position || ''}`.toLowerCase().includes(search.toLowerCase()))
    : players;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner backdrop-blur-sm">
              {selectedPlayer ? (
                <PlayerAvatar player={selectedPlayer} />
              ) : (
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">{selectedPlayer ? `${selectedPlayer.firstName || ''} ${selectedPlayer.lastName || ''}`.trim() : 'Players'}</h1>
              <p className="mt-1 text-sm text-indigo-200">{selectedPlayer ? 'Player details and statistics' : 'Manage your players'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedPlayer && (
              <button type="button" onClick={() => { setSelectedPlayer(null); setStats([]); }} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
            )}
            {!selectedPlayer && (
              <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                New Player
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedPlayer ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center">
                <PlayerAvatar player={selectedPlayer} size="lg" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{selectedPlayer.firstName || selectedPlayer.username} {selectedPlayer.lastName || ''}</h3>
                <p className="text-sm text-slate-500">@{selectedPlayer.username}</p>
                {selectedPlayer.position && <span className="mt-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">{selectedPlayer.position}</span>}
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Club</span><span className="text-slate-900">{selectedPlayer.clubName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Height</span><span className="text-slate-900">{selectedPlayer.height ? `${selectedPlayer.height} cm` : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Weight</span><span className="text-slate-900">{selectedPlayer.weight ? `${selectedPlayer.weight} kg` : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">DOB</span><span className="text-slate-900">{selectedPlayer.dateOfBirth ? new Date(selectedPlayer.dateOfBirth).toLocaleDateString() : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Active</span><span className={`font-medium ${selectedPlayer.active ? 'text-emerald-600' : 'text-red-600'}`}>{selectedPlayer.active ? 'Yes' : 'No'}</span></div>
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => openEdit(selectedPlayer)} className="flex-1 rounded-md border px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">Edit</button>
                <button type="button" onClick={() => handleDelete(selectedPlayer.id)} className="flex-1 rounded-md border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-white">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-slate-900">Statistics</h3>
              </div>
              {statsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : stats.length === 0 ? (
                <EmptyState title="No statistics yet" description="Statistics will appear once matches and training are recorded." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-5 py-3 text-left">Season</th>
                        <th className="px-5 py-3 text-left">Matches</th>
                        <th className="px-5 py-3 text-left">Scored</th>
                        <th className="px-5 py-3 text-left">Assists</th>
                        <th className="px-5 py-3 text-left">Passes</th>
                        <th className="px-5 py-3 text-left">Tackles</th>
                        <th className="px-5 py-3 text-left">Training %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.id} className="border-t hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-900">{s.season}</td>
                          <td className="px-5 py-3">{s.matchesPlayed}</td>
                          <td className="px-5 py-3">{s.triesScored}</td>
                          <td className="px-5 py-3">{s.assists}</td>
                          <td className="px-5 py-3">{s.passesCompleted}</td>
                          <td className="px-5 py-3">{s.tacklesMade}</td>
                          <td className="px-5 py-3">{s.trainingAttendance}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {selectedPlayer.medicalNotes && (
              <div className="mt-4 rounded-xl border bg-amber-50 p-5">
                <h4 className="text-sm font-semibold text-amber-900">Medical Notes</h4>
                <p className="mt-1 text-sm text-amber-800">{selectedPlayer.medicalNotes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, or position..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3 w-14"></th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Club</th>
                  <th className="px-3 py-3">Position</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedPlayer(p)}>
                      <td className="px-3 py-3">
                        <PlayerAvatar player={p} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{(p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : p.username}</span>
                          <span className="text-xs text-slate-400">@{p.username}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{p.clubName}</td>
                      <td className="px-3 py-3">
                        {p.position ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{p.position}</span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => openEdit(p)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300">Edit</button>
                          <button type="button" onClick={() => handleDelete(p.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6}><EmptyState title="No players found" description={search ? 'Try a different search' : 'Add your first player.'} /></td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">{editTarget ? 'Edit Player' : 'Create Player'}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">User ID</label>
                <input type="number" value={form.userId || ''} onChange={(e) => setForm(p => ({ ...p, userId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Club ID</label>
                <input type="number" value={form.clubId || ''} onChange={(e) => setForm(p => ({ ...p, clubId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Height (cm)</label>
                  <input type="number" value={form.height ?? ''} onChange={(e) => setForm(p => ({ ...p, height: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Weight (kg)</label>
                  <input type="number" value={form.weight ?? ''} onChange={(e) => setForm(p => ({ ...p, weight: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Position</label>
                <input value={form.position || ''} onChange={(e) => setForm(p => ({ ...p, position: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. Forward, Defender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Date of Birth</label>
                <input type="date" value={form.dateOfBirth || ''} onChange={(e) => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Medical Notes</label>
                <textarea value={form.medicalNotes || ''} onChange={(e) => setForm(p => ({ ...p, medicalNotes: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
