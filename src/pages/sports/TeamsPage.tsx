import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listTeams, createTeam, updateTeam, deleteTeam, listTeamMembers, addTeamMember, removeTeamMember, listSports, listClubs } from '../../api/sports';
import type { Team, CreateTeamRequest, TeamMember, AddTeamMemberRequest, Sport, SportsClub } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

const AGE_GROUP_COLORS: Record<string, string> = {
  'u10': 'bg-orange-100 text-orange-700 ring-orange-600/20',
  'u12': 'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
  'u14': 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  'u16': 'bg-blue-100 text-blue-700 ring-blue-600/20',
  'u18': 'bg-indigo-100 text-indigo-700 ring-indigo-600/20',
  'u20': 'bg-violet-100 text-violet-700 ring-violet-600/20',
  'senior': 'bg-slate-100 text-slate-700 ring-slate-600/20',
};

function getAgeGroupStyle(ageGroup: string | null): string {
  if (!ageGroup) return 'bg-slate-100 text-slate-600 ring-slate-300';
  const key = ageGroup.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(AGE_GROUP_COLORS)) {
    if (key.includes(k)) return v;
  }
  return 'bg-slate-100 text-slate-600 ring-slate-300';
}

export default function TeamsPage() {
  const { toast, showToast, hideToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [clubs, setClubs] = useState<SportsClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [form, setForm] = useState<CreateTeamRequest>({ name: '', ageGroup: '', sportId: 0, clubId: 0 });
  const [search, setSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberForm, setMemberForm] = useState<AddTeamMemberRequest>({ playerId: 0 });
  const [memberFormOpen, setMemberFormOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s, c] = await Promise.all([listTeams(), listSports(), listClubs()]);
      setTeams(t);
      setSports(s);
      setClubs(c);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMembers = useCallback(async (teamId: number) => {
    setMembersLoading(true);
    try {
      setMembers(await listTeamMembers(teamId));
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load members'), 'error');
    } finally {
      setMembersLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedTeamId) loadMembers(selectedTeamId);
  }, [selectedTeamId, loadMembers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.sportName.toLowerCase().includes(q) ||
      (t.ageGroup && t.ageGroup.toLowerCase().includes(q)) ||
      (t.coachName && t.coachName.toLowerCase().includes(q))
    );
  }, [teams, search]);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedTeamId), [teams, selectedTeamId]);

  function getSportEmoji(sportName: string): string {
    const n = sportName.toLowerCase();
    if (n.includes('soccer') || n.includes('football')) return '⚽';
    if (n.includes('basketball')) return '🏀';
    if (n.includes('tennis')) return '🎾';
    if (n.includes('baseball')) return '⚾';
    if (n.includes('volleyball')) return '🏐';
    if (n.includes('rugby')) return '🏉';
    if (n.includes('golf')) return '🏌️';
    if (n.includes('swim')) return '🏊';
    if (n.includes('hockey')) return '🏒';
    if (n.includes('boxing')) return '🥊';
    if (n.includes('cycling')) return '🚴';
    if (n.includes('run') || n.includes('track') || n.includes('athletics')) return '🏃';
    if (n.includes('ski') || n.includes('snow')) return '⛷️';
    if (n.includes('badminton')) return '🏸';
    if (n.includes('ping pong') || n.includes('table tennis')) return '🏓';
    if (n.includes('cricket')) return '🏏';
    if (n.includes('bowling')) return '🎳';
    if (n.includes('martial arts') || n.includes('karate') || n.includes('judo')) return '🥋';
    if (n.includes('yoga')) return '🧘';
    if (n.includes('dance')) return '💃';
    if (n.includes('fitness') || n.includes('weight')) return '🏋️';
    if (n.includes('fencing')) return '🤺';
    if (n.includes('archery') || n.includes('shoot')) return '🎯';
    return '🏅';
  }

  function getSportGradient(sportName: string): string {
    const n = sportName.toLowerCase();
    if (n.includes('soccer') || n.includes('football')) return 'from-emerald-500 to-emerald-600';
    if (n.includes('basketball')) return 'from-orange-500 to-orange-600';
    if (n.includes('tennis')) return 'from-yellow-400 to-yellow-500';
    if (n.includes('baseball')) return 'from-red-500 to-red-600';
    if (n.includes('volleyball')) return 'from-blue-500 to-blue-600';
    return 'from-indigo-500 to-indigo-600';
  }

  function getSportBg(sportName: string): string {
    const n = sportName.toLowerCase();
    if (n.includes('soccer') || n.includes('football')) return 'bg-emerald-100';
    if (n.includes('basketball')) return 'bg-orange-100';
    if (n.includes('tennis')) return 'bg-yellow-100';
    if (n.includes('baseball')) return 'bg-red-100';
    if (n.includes('volleyball')) return 'bg-blue-100';
    return 'bg-indigo-100';
  }

  function openCreate() {
    setEditTarget(null);
    const defaultClubId = clubs[0]?.id || 0;
    const defaultSportId = sports[0]?.id || 0;
    setForm({ name: '', ageGroup: '', sportId: defaultSportId, clubId: defaultClubId });
    setShowModal(true);
  }

  function openEdit(team: Team) {
    setEditTarget(team);
    setForm({ name: team.name, ageGroup: team.ageGroup || '', sportId: team.sportId, clubId: team.clubId });
    setShowModal(true);
  }

  function openDelete(team: Team) {
    setDeleteTarget(team);
    setShowDeleteModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Team name is required', 'error'); return; }
    if (!form.sportId) { showToast('Please select a sport', 'error'); return; }
    if (!form.clubId) { showToast('No club available. Create one first.', 'error'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateTeam(editTarget.id, form);
        showToast('Team updated', 'success');
      } else {
        await createTeam(form);
        showToast('Team created', 'success');
      }
      setShowModal(false);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save team'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteTeam(deleteTarget.id);
      showToast('Team deleted', 'success');
      if (selectedTeamId === deleteTarget.id) setSelectedTeamId(null);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete team'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberForm.playerId) { showToast('Player ID is required', 'error'); return; }
    if (!selectedTeamId) return;
    try {
      await addTeamMember(selectedTeamId, memberForm);
      setMemberFormOpen(false);
      setMemberForm({ playerId: 0 });
      showToast('Member added', 'success');
      await loadMembers(selectedTeamId);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to add member'), 'error');
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!selectedTeamId) return;
    try {
      await removeTeamMember(selectedTeamId, memberId);
      showToast('Member removed', 'success');
      await loadMembers(selectedTeamId);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to remove member'), 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  /* ---- Members View ---- */
  if (selectedTeamId && selectedTeam) {
    return (
      <div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 sm:p-8">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl shadow-inner backdrop-blur-sm ${getSportBg(selectedTeam.sportName)}`}>
                {getSportEmoji(selectedTeam.sportName)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{selectedTeam.name}</h1>
                <p className="mt-1 text-sm text-slate-300">
                  {selectedTeam.sportName}{selectedTeam.ageGroup ? ` · ${selectedTeam.ageGroup}` : ''} · {selectedTeam.playerCount} members
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedTeamId(null); setMemberFormOpen(false); }}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">{members.length}</div>
              <h3 className="font-semibold text-slate-900">Members</h3>
            </div>
            <button
              type="button"
              onClick={() => setMemberFormOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Member
            </button>
          </div>

          {memberFormOpen && (
            <form onSubmit={handleAddMember} className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Player ID</label>
                  <input
                    type="number"
                    value={memberForm.playerId || ''}
                    onChange={(e) => setMemberForm(p => ({ ...p, playerId: Number(e.target.value) }))}
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Jersey #</label>
                  <input
                    type="number"
                    value={memberForm.jerseyNumber || ''}
                    onChange={(e) => setMemberForm(p => ({ ...p, jerseyNumber: Number(e.target.value) }))}
                    className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="#"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
                  <input
                    type="text"
                    value={memberForm.position || ''}
                    onChange={(e) => setMemberForm(p => ({ ...p, position: e.target.value }))}
                    className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Position"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 active:scale-95"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMemberFormOpen(false); setMemberForm({ playerId: 0 }); }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {membersLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : members.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState title="No members yet" description="Add players to this team to get started." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3">Jersey</th>
                    <th className="px-5 py-3">Position</th>
                    <th className="px-5 py-3 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={m.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 last:border-0">
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-900">{m.playerName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {m.jerseyNumber ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {m.jerseyNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{m.position || '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Remove ${m.playerName} from this team?`)) {
                              handleRemoveMember(m.id);
                            }
                          }}
                          className="text-xs font-medium text-red-500 transition-colors hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---- Teams List View ---- */
  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner backdrop-blur-sm">
              👥
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Teams</h1>
              <p className="mt-1 text-sm text-slate-300">Manage your sports teams and their members</p>
            </div>
          </div>
          {clubs.length > 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Team
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{teams.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{teams.filter((t) => t.active).length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Sports</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{new Set(teams.map((t) => t.sportId)).size}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Players</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{teams.reduce((a, t) => a + t.playerCount, 0)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search teams by name, sport, or coach..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {/* No club warning */}
      {clubs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 font-semibold text-slate-900">No Club Available</h3>
          <p className="mt-2 text-sm text-slate-600">A sports club must be created before you can add teams.</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching teams' : 'No teams yet'}
          description={search ? 'Try a different search term.' : 'Create your first team to get started.'}
          action={
            !search ? (
              <button type="button" onClick={openCreate} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95">
                + Create Team
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((team) => (
            <div
              key={team.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getSportGradient(team.sportName)}`} />

              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${getSportBg(team.sportName)}`}>
                      {getSportEmoji(team.sportName)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{team.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{team.sportName}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${
                    team.active
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-300'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${team.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {team.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {team.ageGroup && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${getAgeGroupStyle(team.ageGroup)}`}>
                      {team.ageGroup}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {team.playerCount}
                  </span>
                  {team.coachName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 truncate max-w-[120px]">
                      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      {team.coachName}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow active:scale-95"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Members
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(team)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(team)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg animate-[slideUp_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-base">
                {editTarget ? '👥' : '✨'}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{editTarget ? 'Edit Team' : 'New Team'}</h2>
                <p className="text-xs text-slate-500">{editTarget ? 'Update the team details below' : 'Fill in the details to create a new team'}</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">Team Name</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <input
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. U14 Eagles, Varsity Team"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Sport</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <select
                    value={form.sportId}
                    onChange={(e) => setForm(p => ({ ...p, sportId: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-900 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 appearance-none"
                  >
                    {sports.length === 0 && <option value={0}>No sports available</option>}
                    {sports.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {sports.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">No sports created yet. Go to Sports page to add one.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Club</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-4 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <select
                    value={form.clubId}
                    onChange={(e) => setForm(p => ({ ...p, clubId: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-900 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 appearance-none"
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Age Group (optional)</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    value={form.ageGroup || ''}
                    onChange={(e) => setForm(p => ({ ...p, ageGroup: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. U14, U16, Senior"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || sports.length === 0 || clubs.length === 0}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    editTarget ? 'Update Team' : 'Create Team'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm animate-[slideUp_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Delete Team</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTarget.name}</span>? This will also remove all team members.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
