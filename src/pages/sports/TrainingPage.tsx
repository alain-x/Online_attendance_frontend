import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listTrainingSessions, createTrainingSession, deleteTrainingSession, getTrainingAttendance, markAttendance, listTrainingMaterials, listTeams } from '../../api/sports';
import type { TrainingSession, CreateTrainingSessionRequest, TrainingAttendance, MarkAttendanceRequest, TrainingMaterial, Team } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

export default function TrainingPage() {
  const { toast, showToast, hideToast } = useToast();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamFilter, setTeamFilter] = useState<number | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateTrainingSessionRequest>({ teamId: 0, title: '', description: '', location: '', startTime: '', endTime: '', coachId: 1 });
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([listTrainingSessions(teamFilter || undefined), listTeams()]);
      setSessions(s);
      setTeams(t);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load training sessions'), 'error');
    } finally {
      setLoading(false);
    }
  }, [teamFilter, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadAttendance = useCallback(async (sessionId: number) => {
    setAttendanceLoading(true);
    try {
      const data = await getTrainingAttendance(sessionId);
      setAttendance(data);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load attendance'), 'error');
    } finally {
      setAttendanceLoading(false);
    }
  }, [showToast]);

  const loadMaterials = useCallback(async (teamId: number) => {
    setMaterialsLoading(true);
    try {
      const data = await listTrainingMaterials(teamId);
      setMaterials(data);
    } catch { /* ignore */ } finally {
      setMaterialsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadAttendance(selectedSession.id);
      loadMaterials(selectedSession.teamId);
    }
  }, [selectedSession, loadAttendance, loadMaterials]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startTime || !form.endTime) { showToast('Title, start and end time are required', 'error'); return; }
    setSaving(true);
    try {
      await createTrainingSession(form);
      setShowModal(false);
      setForm({ teamId: 0, title: '', description: '', location: '', startTime: '', endTime: '', coachId: 1 });
      showToast('Training session created', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to create session'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this session?')) return;
    try {
      await deleteTrainingSession(id);
      showToast('Session deleted', 'success');
      if (selectedSession?.id === id) setSelectedSession(null);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete session'), 'error');
    }
  }

  async function handleMarkAttendance() {
    if (!selectedSession) return;
    const requests: MarkAttendanceRequest[] = attendance.map(a => ({ playerId: a.playerId, status: a.status, notes: a.notes || undefined }));
    try {
      await markAttendance(selectedSession.id, requests);
      showToast('Attendance marked', 'success');
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to mark attendance'), 'error');
    }
  }

  function updateAttendanceStatus(playerId: number, status: string) {
    setAttendance(prev => prev.map(a => a.playerId === playerId ? { ...a, status } : a));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{selectedSession ? selectedSession.title : 'Training Sessions'}</h1>
          <p className="mt-1 text-sm text-slate-600">{selectedSession ? 'Manage attendance and materials' : 'Schedule and manage training'}</p>
        </div>
        <div className="flex gap-2">
          {selectedSession && (
            <button type="button" onClick={() => setSelectedSession(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Back
            </button>
          )}
          {!selectedSession && (
            <button type="button" onClick={() => setShowModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
              + New Session
            </button>
          )}
        </div>
      </div>

      {!selectedSession && (
        <div className="mb-4 flex items-center gap-3">
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : '')} className="rounded-md border bg-white px-3 py-2 text-sm">
            <option value="">All Teams</option>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
      )}

      {selectedSession ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Attendance ({attendance.length})</h3>
              <button type="button" onClick={handleMarkAttendance} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">Save Attendance</button>
            </div>
            {attendanceLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : attendance.length === 0 ? (
              <EmptyState title="No attendance records" description="Load attendance for this session." />
            ) : (
              <div className="divide-y">
                {attendance.map((a) => (
                  <div key={a.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{a.playerName}</span>
                      <select value={a.status} onChange={(e) => updateAttendanceStatus(a.playerId, e.target.value)} className="rounded-md border bg-white px-3 py-1.5 text-xs">
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="EXCUSED">Excused</option>
                      </select>
                    </div>
                    {(a.checkedInAt || a.checkedOutAt || a.checkinReason || a.checkoutReason) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {a.checkedInAt && <span>In: {new Date(a.checkedInAt).toLocaleTimeString()}</span>}
                        {a.checkedOutAt && <span>Out: {new Date(a.checkedOutAt).toLocaleTimeString()}</span>}
                        {a.checkinReason && <span className="italic">Reason in: {a.checkinReason}</span>}
                        {a.checkoutReason && <span className="italic">Reason out: {a.checkoutReason}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-slate-900">Materials ({materials.length})</h3>
            </div>
            {materialsLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : materials.length === 0 ? (
              <EmptyState title="No materials" description="Training materials will appear here." />
            ) : (
              <div className="divide-y">
                {materials.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{m.title}</div>
                      <div className="text-xs text-slate-500">{m.fileType} by {m.uploadedByName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedSession(session)}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{session.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{session.teamName}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    session.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    session.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>{session.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span>{new Date(session.startTime).toLocaleString()} - {new Date(session.endTime).toLocaleTimeString()}</span>
                  {session.location && <span>{session.location}</span>}
                  <span>Coach: {session.coachName}</span>
                  <span>{session.attendanceCount} attending</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedSession(session); }} className="text-xs text-blue-600 hover:underline">Manage</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <EmptyState title="No training sessions" description="Create your first session to get started." action={
              <button type="button" onClick={() => setShowModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Create Session</button>
            } />
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Create Training Session</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Team</label>
                <select value={form.teamId} onChange={(e) => setForm(p => ({ ...p, teamId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" required>
                  <option value="">Select team</option>
                  {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Title</label>
                <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Start Time</label>
                  <input type="datetime-local" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">End Time</label>
                  <input type="datetime-local" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Location</label>
                <input value={form.location || ''} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
