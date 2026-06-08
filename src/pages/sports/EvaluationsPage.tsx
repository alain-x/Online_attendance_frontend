import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listEvaluations, createEvaluation, addCriterion, updateEvaluation, deleteEvaluation, listTeams } from '../../api/sports';
import type { PlayerEvaluation, CreateEvaluationRequest, AddCriterionRequest, Team } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

export default function EvaluationsPage() {
  const { toast, showToast, hideToast } = useToast();
  const [evaluations, setEvaluations] = useState<PlayerEvaluation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamFilter, setTeamFilter] = useState<number | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEval, setSelectedEval] = useState<PlayerEvaluation | null>(null);
  const [editingEval, setEditingEval] = useState<PlayerEvaluation | null>(null);
  const [form, setForm] = useState<CreateEvaluationRequest>({ playerId: 0, teamId: 0, period: '', overallRating: 5, coachNotes: '', goals: '' });
  const [criteria, setCriteria] = useState<AddCriterionRequest[]>([{ criterionName: 'Technical Skills', score: 5 }, { criterionName: 'Tactical Awareness', score: 5 }, { criterionName: 'Physical Fitness', score: 5 }]);
  const [deleteConfirm, setDeleteConfirm] = useState<PlayerEvaluation | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [e, t] = await Promise.all([listEvaluations(undefined, teamFilter || undefined), listTeams()]);
      setEvaluations(e);
      setTeams(t);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load evaluations'), 'error');
    } finally {
      setLoading(false);
    }
  }, [teamFilter, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  function openCreate() {
    setEditingEval(null);
    setForm({ playerId: 0, teamId: teams[0]?.id || 0, period: '', overallRating: 5, coachNotes: '', goals: '' });
    setCriteria([{ criterionName: 'Technical Skills', score: 5 }, { criterionName: 'Tactical Awareness', score: 5 }, { criterionName: 'Physical Fitness', score: 5 }]);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.playerId || !form.period) { showToast('Player ID and period are required', 'error'); return; }
    setSaving(true);
    try {
      if (editingEval) {
        await updateEvaluation(editingEval.id, form);
        setShowModal(false);
        setEditingEval(null);
        showToast('Evaluation updated', 'success');
      } else {
        const evaluation = await createEvaluation(form);
        for (const c of criteria.filter(c => c.criterionName.trim())) {
          await addCriterion(evaluation.id, c);
        }
        setShowModal(false);
        showToast('Evaluation created', 'success');
      }
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save evaluation'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev: PlayerEvaluation) {
    try {
      await deleteEvaluation(ev.id);
      setDeleteConfirm(null);
      if (selectedEval?.id === ev.id) setSelectedEval(null);
      showToast('Evaluation deleted', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete evaluation'), 'error');
    }
  }

  function openEdit(ev: PlayerEvaluation) {
    setEditingEval(ev);
    setForm({ playerId: ev.playerId, teamId: ev.teamId, period: ev.period, overallRating: ev.overallRating, coachNotes: ev.coachNotes || '', goals: ev.goals || '' });
    setCriteria(ev.criteria && ev.criteria.length > 0 ? ev.criteria.map(c => ({ criterionName: c.criterionName, score: c.score, notes: c.notes || '' })) : [{ criterionName: 'Technical Skills', score: 5 }, { criterionName: 'Tactical Awareness', score: 5 }, { criterionName: 'Physical Fitness', score: 5 }]);
    setShowModal(true);
  }

  function updateCriterion(index: number, field: keyof AddCriterionRequest, value: string | number) {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{selectedEval ? `Evaluation: ${selectedEval.playerName}` : 'Evaluations'}</h1>
          <p className="mt-1 text-sm text-slate-600">{selectedEval ? `Period: ${selectedEval.period} - Rating: ${selectedEval.overallRating}/10` : 'Player performance evaluations'}</p>
        </div>
        <div className="flex gap-2">
          {selectedEval && (
            <button type="button" onClick={() => setSelectedEval(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
          )}
          {!selectedEval && (
            <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">+ New Evaluation</button>
          )}
        </div>
      </div>

      {!selectedEval && (
        <div className="mb-4 flex items-center gap-3">
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : '')} className="rounded-md border bg-white px-3 py-2 text-sm">
            <option value="">All Teams</option>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
      )}

      {selectedEval ? (
        <div className="rounded-xl border bg-white">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-slate-900">Evaluation Criteria</h3>
          </div>
          <div className="p-5">
            {selectedEval.criteria && selectedEval.criteria.length > 0 ? (
              <div className="space-y-4">
                {selectedEval.criteria.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900">{c.criterionName}</span>
                      <span className="text-sm font-bold text-slate-900">{c.score}/10</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${c.score * 10}%` }} />
                    </div>
                    {c.notes && <p className="mt-1 text-xs text-slate-500">{c.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No criteria" description="No evaluation criteria recorded." />
            )}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold text-slate-900">Overall Rating</span>
                <span className="text-2xl font-bold text-blue-600">{selectedEval.overallRating}/10</span>
              </div>
              {selectedEval.coachNotes && (
                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Coach Notes</h4>
                  <p className="mt-1 text-sm text-slate-700">{selectedEval.coachNotes}</p>
                </div>
              )}
              {selectedEval.goals && (
                <div className="mt-4 rounded-lg bg-blue-50 p-4">
                  <h4 className="text-sm font-semibold text-blue-900">Goals</h4>
                  <p className="mt-1 text-sm text-blue-700">{selectedEval.goals}</p>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500">Evaluated by {selectedEval.evaluatorName} on {new Date(selectedEval.createdAt).toLocaleDateString()}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(selectedEval)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Edit</button>
                <button type="button" onClick={() => setDeleteConfirm(selectedEval)} className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {evaluations.map((ev) => (
            <div key={ev.id} className="rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedEval(ev)}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ev.playerName}</h3>
                    <p className="text-xs text-slate-500 mt-1">{ev.teamName}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">{ev.overallRating}/10</span>
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  <span>Period: {ev.period}</span>
                  <span className="ml-3">By: {ev.evaluatorName}</span>
                </div>
                {ev.criteria && ev.criteria.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {ev.criteria.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">{c.criterionName}:</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${c.score * 10}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700">{c.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">Created: {new Date(ev.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {evaluations.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState title="No evaluations" description="Create your first evaluation." action={
                <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Create Evaluation</button>
              } />
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900">{editingEval ? 'Edit Evaluation' : 'Create Evaluation'}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Player ID</label>
                  <input type="number" value={form.playerId || ''} onChange={(e) => setForm(p => ({ ...p, playerId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team</label>
                  <select value={form.teamId} onChange={(e) => setForm(p => ({ ...p, teamId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" required>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Period</label>
                  <input value={form.period} onChange={(e) => setForm(p => ({ ...p, period: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 2024-Q1" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Overall Rating (1-10)</label>
                  <input type="number" min={1} max={10} value={form.overallRating} onChange={(e) => setForm(p => ({ ...p, overallRating: Number(e.target.value) }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Criteria</label>
                {criteria.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-start">
                    <input value={c.criterionName} onChange={(e) => updateCriterion(i, 'criterionName', e.target.value)} className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Criterion name" />
                    <input type="number" min={1} max={10} value={c.score} onChange={(e) => updateCriterion(i, 'score', Number(e.target.value))} className="w-20 rounded-md border px-3 py-2 text-sm" />
                    {criteria.length > 1 && (
                      <button type="button" onClick={() => setCriteria(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 text-sm mt-2">×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setCriteria(prev => [...prev, { criterionName: '', score: 5 }])} className="text-xs text-blue-600 hover:underline mt-1">+ Add criterion</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Coach Notes</label>
                <textarea value={form.coachNotes || ''} onChange={(e) => setForm(p => ({ ...p, coachNotes: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Goals</label>
                <textarea value={form.goals || ''} onChange={(e) => setForm(p => ({ ...p, goals: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Saving...' : editingEval ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Delete Evaluation</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete {deleteConfirm.playerName}'s evaluation for {deleteConfirm.period}?</p>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
