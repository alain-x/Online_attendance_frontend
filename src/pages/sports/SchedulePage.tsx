import React, { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { listCalendarEvents, createCalendarEvent, deleteCalendarEvent, listTeams } from '../../api/sports';
import type { CalendarEvent, CreateCalendarEventRequest, Team } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

export default function SchedulePage() {
  const { toast, showToast, hideToast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamFilter, setTeamFilter] = useState<number | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateCalendarEventRequest>({
    teamId: 0, title: '', description: '', eventType: 'TRAINING', startDateTime: '', endDateTime: '', location: '', allDay: false, color: '#3b82f6'
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [e, t] = await Promise.all([listCalendarEvents(teamFilter || undefined), listTeams()]);
      setEvents(e);
      setTeams(t);
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to load schedule'), 'error');
    } finally {
      setLoading(false);
    }
  }, [teamFilter, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startDateTime || !form.endDateTime) {
      showToast('Title, start and end time are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await createCalendarEvent(form);
      setShowModal(false);
      setForm({ teamId: 0, title: '', description: '', eventType: 'TRAINING', startDateTime: '', endDateTime: '', location: '', allDay: false, color: '#3b82f6' });
      showToast('Event created', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to create event'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteCalendarEvent(id);
      showToast('Event deleted', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast(getApiErrorMessage(err, 'Failed to delete event'), 'error');
    }
  }

  const eventTypeColors: Record<string, string> = {
    TRAINING: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MATCH: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    MEETING: 'bg-amber-100 text-amber-700 border-amber-200',
    SOCIAL: 'bg-purple-100 text-purple-700 border-purple-200',
    OTHER: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const date = ev.startDateTime?.slice(0, 10) || 'unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  const sortedDates = Object.keys(eventsByDate).sort();

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-600">View and manage upcoming events</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">+ New Event</button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value ? Number(e.target.value) : '')} className="rounded-md border bg-white px-3 py-2 text-sm">
          <option value="">All Teams</option>
          {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
        <div className="flex rounded-md border">
          <button type="button" onClick={() => setViewMode('list')} className={`px-3 py-2 text-xs ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>List</button>
          <button type="button" onClick={() => setViewMode('calendar')} className={`px-3 py-2 text-xs ${viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>Calendar</button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="rounded-xl border bg-white">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 border-r last:border-r-0">{d}</div>
            ))}
          </div>
          {(() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells: React.ReactNode[] = [];
            for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="p-2 min-h-[80px] border-r border-b bg-slate-50" />);
            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = events.filter(e => e.startDateTime?.slice(0, 10) === dateStr);
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;
              cells.push(
                <div key={day} className={`p-1 min-h-[80px] border-r border-b ${isToday ? 'bg-blue-50' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{day}</div>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="text-[10px] truncate rounded px-1 py-0.5 mb-0.5 bg-slate-100 text-slate-700">{ev.title}</div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px] text-slate-500">+{dayEvents.length - 2} more</div>}
                </div>
              );
            }
            return <div className="grid grid-cols-7">{cells}</div>;
          })()}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <div className="space-y-2">
                {eventsByDate[date].map((ev) => (
                  <div key={ev.id} className={`rounded-lg border p-4 ${eventTypeColors[ev.eventType] || eventTypeColors.OTHER}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ev.color || '#3b82f6' }} />
                        <div>
                          <h4 className="text-sm font-semibold">{ev.title}</h4>
                          <p className="text-xs opacity-75 mt-0.5">{ev.teamName}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-medium">{ev.eventType}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs opacity-75">
                      <span>{new Date(ev.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.location && <span>{ev.location}</span>}
                    </div>
                    {ev.description && <p className="mt-2 text-xs opacity-75">{ev.description}</p>}
                    <div className="mt-2">
                      <button type="button" onClick={() => handleDelete(ev.id)} className="text-xs opacity-75 hover:opacity-100 underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <EmptyState title="No events" description="Create your first event." action={
              <button type="button" onClick={() => setShowModal(true)} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Create Event</button>
            } />
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Create Event</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team</label>
                  <select value={form.teamId} onChange={(e) => setForm(p => ({ ...p, teamId: Number(e.target.value) }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" required>
                    <option value="">Select team</option>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Type</label>
                  <select value={form.eventType} onChange={(e) => setForm(p => ({ ...p, eventType: e.target.value }))} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                    <option value="TRAINING">Training</option>
                    <option value="MATCH">Match</option>
                    <option value="MEETING">Meeting</option>
                    <option value="SOCIAL">Social</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
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
                  <label className="block text-sm font-medium text-slate-700">Start</label>
                  <input type="datetime-local" value={form.startDateTime} onChange={(e) => setForm(p => ({ ...p, startDateTime: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">End</label>
                  <input type="datetime-local" value={form.endDateTime} onChange={(e) => setForm(p => ({ ...p, endDateTime: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Location</label>
                <input value={form.location || ''} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.allDay || false} onChange={(e) => setForm(p => ({ ...p, allDay: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-slate-700">All day</span>
                </label>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
                  <input type="color" value={form.color || '#3b82f6'} onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))} className="h-8 w-16 rounded border cursor-pointer" />
                </div>
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
