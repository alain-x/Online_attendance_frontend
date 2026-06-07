import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listMatches, createMatch, updateMatch, deleteMatch, getMatchLineup, setMatchLineup, getMatchEvents, addMatchEvent, removeFromLineup, listTeams } from '../../api/sports';
import type { Match, CreateMatchRequest, MatchLineup, AddLineupRequest, MatchEvent, AddMatchEventRequest, Team } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

export default function MatchesPage() {
  const { toast, showToast, hideToast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamFilter, setTeamFilter] = useState<number | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Match | null>(null);
  const [form, setForm] = useState<CreateMatchRequest>({ teamId: 0, opponent: '', location: '', matchDate: '', type: 'FRIENDLY', homeAway: 'HOME' });
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [lineup, setLineup] = useState<MatchLineup[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [eventForm, setEventForm] = useState<AddMatchEventRequest>({ playerId: 0, eventType: 'GOAL', minute: undefined, notes: '' });
  const [lineupFormPlayerId, setLineupFormPlayerId] = useState<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([listMatches(teamFilter || undefined), listTeams()]);
      setMatches(m);
      setTeams(t);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load matches'), 'error');
    } finally {
      setLoading(false);
    }
  }, [teamFilter, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMatchDetails = useCallback(async (match: Match) => {
    setLineupLoading(true);
    try {
      const [l, e] = await Promise.all([getMatchLineup(match.id), getMatchEvents(match.id)]);
      setLineup(l);
      setEvents(e);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load match details'), 'error');
    } finally {
      setLineupLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedMatch) loadMatchDetails(selectedMatch);
  }, [selectedMatch, loadMatchDetails]);

  function openCreate() {
    setEditTarget(null);
    setForm({ teamId: teams[0]?.id || 0, opponent: '', location: '', matchDate: '', type: 'FRIENDLY', homeAway: 'HOME' });
    setShowModal(true);
  }

  function openEdit(m: Match) {
    setEditTarget(m);
    setForm({ teamId: m.teamId, opponent: m.opponent, location: m.location || '', matchDate: m.matchDate.slice(0, 16), type: m.type, homeAway: m.homeAway });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.opponent.trim() || !form.matchDate) { showToast('Opponent and date are required', 'error'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateMatch(editTarget.id, form);
        showToast('Match updated', 'success');
      } else {
        await createMatch(form);
        showToast('Match created', 'success');
      }
      setShowModal(false);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save match'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this match?')) return;
    try {
      await deleteMatch(id);
      showToast('Match deleted', 'success');
      if (selectedMatch?.id === id) setSelectedMatch(null);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete match'), 'error');
    }
  }

  async function handleAddToLineup() {
    if (!lineupFormPlayerId || !selectedMatch) return;
    try {
      await setMatchLineup(selectedMatch.id, [{ playerId: lineupFormPlayerId, isStarter: true }]);
      setLineupFormPlayerId(0);
      showToast('Added to lineup', 'success');
      await loadMatchDetails(selectedMatch);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to add to lineup'), 'error');
    }
  }

  async function handleRemoveFromLineup(lineupId: number) {
    if (!selectedMatch) return;
    if (!window.confirm('Remove from lineup?')) return;
    try {
      await removeFromLineup(selectedMatch.id, lineupId);
      showToast('Removed from lineup', 'success');
      await loadMatchDetails(selectedMatch);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to remove'), 'error');
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventForm.playerId || !selectedMatch) return;
    try {
      await addMatchEvent(selectedMatch.id, eventForm);
      setEventForm({ playerId: 0, eventType: 'GOAL', minute: undefined, notes: '' });
      showToast('Event added', 'success');
      await loadMatchDetails(selectedMatch);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to add event'), 'error');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{selectedMatch ? `${selectedMatch.teamName} vs ${selectedMatch.opponent}` : 'Matches'}</h1>
          <p className="mt-1 text-sm text-slate-600">{selectedMatch ? `${selectedMatch.matchDate ? new Date(selectedMatch.matchDate).toLocaleDateString() : ''} - ${selectedMatch.type}` : 'Manage matches and lineups'}</p>
        </div>
        <div className="flex gap-2">
          {selectedMatch && (
            <button type="button" onClick={() => setSelectedMatch(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
          )}
          {!selectedMatch && (
            <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">+ New Match</button>
          )}
        </div>
      </div>

      {!selectedMatch && (
        <div className="mb-4 flex items-center gap-3">
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : '')} className="rounded-md border bg-white px-3 py-2 text-sm">
            <option value="">All Teams</option>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
      )}

      {selectedMatch ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Lineup ({lineup.length})</h3>
              <div className="flex gap-2">
                <input type="number" value={lineupFormPlayerId || ''} onChange={(e) => setLineupFormPlayerId(Number(e.target.value))} className="rounded-md border px-2 py-1.5 text-xs w-20" placeholder="Player ID" />
                <button type="button" onClick={handleAddToLineup} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">Add</button>
              </div>
            </div>
            {lineupLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : lineup.length === 0 ? (
              <EmptyState title="No lineup" description="Add players to the lineup." />
            ) : (
              <div className="divide-y">
                {lineup.map((l) => (
                  <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${l.isStarter ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {l.isStarter ? 'Starter' : 'Sub'}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{l.playerName}</span>
                      {l.jerseyNumber && <span className="text-xs text-slate-500">#{l.jerseyNumber}</span>}
                      {l.position && <span className="text-xs text-slate-500">{l.position}</span>}
                    </div>
                    <button type="button" onClick={() => handleRemoveFromLineup(l.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-slate-900">Events ({events.length})</h3>
            </div>
            <form onSubmit={handleAddEvent} className="px-5 py-4 border-b bg-slate-50 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700">Player ID</label>
                <input type="number" value={eventForm.playerId || ''} onChange={(e) => setEventForm(p => ({ ...p, playerId: Number(e.target.value) }))} className="rounded-md border px-2 py-1.5 text-xs w-20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Type</label>
                <select value={eventForm.eventType} onChange={(e) => setEventForm(p => ({ ...p, eventType: e.target.value }))} className="rounded-md border bg-white px-2 py-1.5 text-xs">
                  <option value="GOAL">Goal</option>
                  <option value="ASSIST">Assist</option>
                  <option value="YELLOW_CARD">Yellow Card</option>
                  <option value="RED_CARD">Red Card</option>
                  <option value="SUBSTITUTION">Substitution</option>
                  <option value="INJURY">Injury</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Minute</label>
                <input type="number" value={eventForm.minute ?? ''} onChange={(e) => setEventForm(p => ({ ...p, minute: e.target.value ? Number(e.target.value) : undefined }))} className="rounded-md border px-2 py-1.5 text-xs w-16" />
              </div>
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">Add Event</button>
            </form>
            {events.length === 0 ? (
              <EmptyState title="No events" description="Track match events here." />
            ) : (
              <div className="divide-y">
                {events.map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        ev.eventType === 'GOAL' ? 'bg-emerald-100 text-emerald-700' :
                        ev.eventType === 'YELLOW_CARD' ? 'bg-amber-100 text-amber-700' :
                        ev.eventType === 'RED_CARD' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}>{ev.eventType}</span>
                      <span className="text-sm text-slate-900">{ev.playerName}</span>
                      {ev.minute != null && <span className="text-xs text-slate-500">{ev.minute}&apos;</span>}
                    </div>
                    {ev.notes && <span className="text-xs text-slate-500">{ev.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMatch(m)}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{m.teamName} vs {m.opponent}</h3>
                    <p className="text-xs text-slate-500 mt-1">{new Date(m.matchDate).toLocaleDateString()} - {m.type}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    m.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>{m.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  {m.ourScore != null && m.opponentScore != null ? (
                    <span className="text-lg font-bold text-slate-900">{m.ourScore} - {m.opponentScore}</span>
                  ) : (
                    <span className="text-sm text-slate-400">Not played yet</span>
                  )}
                  <span className="text-xs text-slate-500">{m.homeAway === 'HOME' ? 'Home' : 'Away'}</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                  {m.location && <span>{m.location}</span>}
                  <span>{m.lineupCount} in lineup</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedMatch(m); }} className="text-xs text-blue-600 hover:underline">Manage</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="md:col-span-2">
              <EmptyState title="No matches" description="Schedule your first match." action={
                <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Create Match</button>
              } />
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">{editTarget ? 'Edit Match' : 'Create Match'}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team</label>
                  <select value={form.teamId} onChange={(e) => setForm(p => ({ ...p, teamId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" required>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Type</label>
                  <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="FRIENDLY">Friendly</option>
                    <option value="LEAGUE">League</option>
                    <option value="CUP">Cup</option>
                    <option value="TOURNAMENT">Tournament</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Opponent</label>
                  <input value={form.opponent} onChange={(e) => setForm(p => ({ ...p, opponent: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Home/Away</label>
                  <select value={form.homeAway} onChange={(e) => setForm(p => ({ ...p, homeAway: e.target.value }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="HOME">Home</option>
                    <option value="AWAY">Away</option>
                    <option value="NEUTRAL">Neutral</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Match Date</label>
                <input type="datetime-local" value={form.matchDate} onChange={(e) => setForm(p => ({ ...p, matchDate: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Location</label>
                <input value={form.location || ''} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
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
