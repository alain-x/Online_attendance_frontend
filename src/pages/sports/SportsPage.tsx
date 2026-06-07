import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listSports, createSport, updateSport, deleteSport } from '../../api/sports';
import type { Sport, CreateSportRequest, UpdateSportRequest } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

const SPORT_EMOJIS: [string, string][] = [
  ['soccer', '⚽'], ['football', '⚽'],
  ['basketball', '🏀'], ['tennis', '🎾'],
  ['baseball', '⚾'], ['volleyball', '🏐'],
  ['rugby', '🏉'], ['golf', '🏌️'],
  ['swim', '🏊'], ['hockey', '🏒'],
  ['boxing', '🥊'], ['cycling', '🚴'],
  ['run', '🏃'], ['athletics', '🏃'], ['track', '🏃'],
  ['ski', '⛷️'], ['snow', '⛷️'],
  ['badminton', '🏸'], ['ping pong', '🏓'], ['table tennis', '🏓'],
  ['cricket', '🏏'], ['bowling', '🎳'],
  ['fencing', '🤺'], ['gymnastics', '🤸'],
  ['surf', '🏄'], ['skate', '🛹'],
  ['dance', '💃'], ['yoga', '🧘'],
  ['martial arts', '🥋'], ['karate', '🥋'], ['judo', '🥋'],
  ['horse', '🏇'], ['equestrian', '🏇'],
  ['shoot', '🎯'], ['archery', '🎯'],
  ['weight', '🏋️'], ['fitness', '🏋️'],
  ['climb', '🧗'],
];

function getSportEmoji(name: string): string {
  const n = name.toLowerCase();
  for (const [keyword, emoji] of SPORT_EMOJIS) {
    if (n.includes(keyword)) return emoji;
  }
  return '🏅';
}

function getGradient(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('soccer') || n.includes('football')) return 'from-emerald-500 to-emerald-600';
  if (n.includes('basketball')) return 'from-orange-500 to-orange-600';
  if (n.includes('tennis')) return 'from-yellow-400 to-yellow-500';
  if (n.includes('baseball')) return 'from-red-500 to-red-600';
  if (n.includes('volleyball')) return 'from-blue-500 to-blue-600';
  if (n.includes('rugby')) return 'from-indigo-500 to-indigo-600';
  if (n.includes('golf')) return 'from-teal-500 to-teal-600';
  if (n.includes('swim')) return 'from-cyan-500 to-cyan-600';
  if (n.includes('hockey')) return 'from-slate-500 to-slate-600';
  if (n.includes('boxing')) return 'from-rose-500 to-rose-600';
  if (n.includes('cycling')) return 'from-violet-500 to-violet-600';
  if (n.includes('ski') || n.includes('snow')) return 'from-sky-400 to-sky-500';
  return 'from-slate-700 to-slate-800';
}

function getEmojiBg(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('soccer') || n.includes('football')) return 'bg-emerald-100';
  if (n.includes('basketball')) return 'bg-orange-100';
  if (n.includes('tennis')) return 'bg-yellow-100';
  if (n.includes('baseball')) return 'bg-red-100';
  if (n.includes('volleyball')) return 'bg-blue-100';
  if (n.includes('rugby')) return 'bg-indigo-100';
  if (n.includes('golf')) return 'bg-teal-100';
  if (n.includes('swim')) return 'bg-cyan-100';
  if (n.includes('hockey')) return 'bg-slate-100';
  if (n.includes('boxing')) return 'bg-rose-100';
  if (n.includes('cycling')) return 'bg-violet-100';
  if (n.includes('ski') || n.includes('snow')) return 'bg-sky-100';
  return 'bg-slate-100';
}

function getSportColors(name: string): { dot: string; light: string; border: string } {
  const n = name.toLowerCase();
  if (n.includes('soccer') || n.includes('football')) return { dot: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200' };
  if (n.includes('basketball')) return { dot: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200' };
  if (n.includes('tennis')) return { dot: 'bg-yellow-500', light: 'bg-yellow-50', border: 'border-yellow-200' };
  if (n.includes('baseball')) return { dot: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200' };
  if (n.includes('volleyball')) return { dot: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200' };
  if (n.includes('rugby')) return { dot: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200' };
  if (n.includes('golf')) return { dot: 'bg-teal-500', light: 'bg-teal-50', border: 'border-teal-200' };
  if (n.includes('swim')) return { dot: 'bg-cyan-500', light: 'bg-cyan-50', border: 'border-cyan-200' };
  if (n.includes('hockey')) return { dot: 'bg-slate-500', light: 'bg-slate-50', border: 'border-slate-200' };
  if (n.includes('boxing')) return { dot: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200' };
  if (n.includes('cycling')) return { dot: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200' };
  if (n.includes('ski') || n.includes('snow')) return { dot: 'bg-sky-500', light: 'bg-sky-50', border: 'border-sky-200' };
  return { dot: 'bg-slate-500', light: 'bg-slate-50', border: 'border-slate-200' };
}

export default function SportsPage() {
  const { toast, showToast, hideToast } = useToast();
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sport | null>(null);
  const [editTarget, setEditTarget] = useState<Sport | null>(null);
  const [form, setForm] = useState<CreateSportRequest>({ name: '', description: '' });
  const [formActive, setFormActive] = useState(true);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSports(await listSports());
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load sports'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sports;
    const q = search.toLowerCase();
    return sports.filter((s) => s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q)));
  }, [sports, search]);

  const stats = useMemo(() => ({
    total: sports.length,
    active: sports.filter((s) => s.active).length,
    inactive: sports.filter((s) => !s.active).length,
  }), [sports]);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: '', description: '' });
    setFormActive(true);
    setShowModal(true);
  }

  function openEdit(s: Sport) {
    setEditTarget(s);
    setForm({ name: s.name, description: s.description || '' });
    setFormActive(s.active);
    setShowModal(true);
  }

  function openDelete(s: Sport) {
    setDeleteTarget(s);
    setShowDeleteModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Sport name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateSport(editTarget.id, { ...form, active: formActive });
        showToast('Sport updated', 'success');
      } else {
        await createSport(form);
        showToast('Sport created', 'success');
      }
      setShowModal(false);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to save sport'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteSport(deleteTarget.id);
      showToast('Sport deleted', 'success');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete sport'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner backdrop-blur-sm">
              🏅
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Sports</h1>
              <p className="mt-1 text-sm text-slate-300">Manage sports available in your club</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Sport
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{stats.inactive}</p>
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
            placeholder="Search sports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching sports' : 'No sports yet'}
          description={search ? 'Try a different search term.' : 'Create your first sport to get started.'}
          action={
            !search ? (
              <button type="button" onClick={openCreate} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl active:scale-95">
                + Create Sport
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => {
            const colors = getSportColors(s.name);
            return (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Top gradient accent */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getGradient(s.name)}`} />

                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${getEmojiBg(s.name)}`}>
                        {getSportEmoji(s.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate max-w-[140px]">{s.name}</h3>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500 line-clamp-2">{s.description}</p>
                  )}
                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(s)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
            {/* Modal header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-base">
                {editTarget ? getSportEmoji(editTarget.name) : '🏅'}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{editTarget ? 'Edit Sport' : 'New Sport'}</h2>
                <p className="text-xs text-slate-500">{editTarget ? 'Update the sport details below' : 'Fill in the details to create a new sport'}</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">Sport Name</label>
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
                    placeholder="e.g. Soccer, Basketball"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute left-0 top-3 flex items-start pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Brief description of the sport"
                    rows={3}
                  />
                </div>
              </div>

              {editTarget && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Active Status</p>
                    <p className="text-xs text-slate-500">{formActive ? 'Sport is visible and available' : 'Sport is hidden from selection'}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                    <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                  </label>
                </div>
              )}

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
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                    editTarget ? 'Update Sport' : 'Create Sport'
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
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Delete Sport</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTarget.name}</span>? This action cannot be undone.
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

      {/* Slide-up animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
