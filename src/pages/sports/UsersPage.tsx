import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../utils/error';
import type { UserResponse, CreateUserRequest, Role } from '../../api/types';

const ADMIN_CREATABLE_ROLES: Role[] = [
  'CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT',
];

const SUPER_ADMIN_CREATABLE_ROLES: Role[] = [
  'CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT',
  'ADMIN', 'HR', 'MANAGER', 'RECORDER', 'EMPLOYEE', 'PAYROLL', 'AUDITOR',
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CLUB_ADMIN: 'Club Admin',
  COACH: 'Coach',
  TEAM_MANAGER: 'Team Manager',
  PLAYER: 'Player',
  PARENT: 'Parent',
  EMPLOYEE: 'Employee',
  RECORDER: 'Recorder',
  HR: 'HR',
  MANAGER: 'Manager',
  PAYROLL: 'Payroll',
  AUDITOR: 'Auditor',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 ring-purple-600/20',
  CLUB_ADMIN: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  COACH: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  TEAM_MANAGER: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  PLAYER: 'bg-indigo-100 text-indigo-800 ring-indigo-600/20',
  PARENT: 'bg-pink-100 text-pink-800 ring-pink-600/20',
  EMPLOYEE: 'bg-slate-100 text-slate-800 ring-slate-600/20',
  RECORDER: 'bg-cyan-100 text-cyan-800 ring-cyan-600/20',
  HR: 'bg-rose-100 text-rose-800 ring-rose-600/20',
  MANAGER: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  PAYROLL: 'bg-teal-100 text-teal-800 ring-teal-600/20',
  AUDITOR: 'bg-violet-100 text-violet-800 ring-violet-600/20',
};

export default function UsersPage() {
  const { toast, showToast, hideToast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserResponse | null>(null);
  const [editing, setEditing] = useState<UserResponse | null>(null);
  const [form, setForm] = useState<CreateUserRequest & { firstName: string; lastName: string }>({ username: '', firstName: '', lastName: '', email: '', password: '', role: 'PLAYER', enabled: true });
  const [search, setSearch] = useState('');

  const creatableRoles = useMemo(() => {
    return user?.role === 'SYSTEM_ADMIN' ? SUPER_ADMIN_CREATABLE_ROLES : ADMIN_CREATABLE_ROLES;
  }, [user?.role]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listUsers();
      setUsers(data.filter(u => u.role !== 'SYSTEM_ADMIN'));
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load users'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      String(u.id).includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  function openCreate() {
    setEditing(null);
    setForm({ username: '', firstName: '', lastName: '', email: '', password: '', role: creatableRoles[0], enabled: true });
    setShowModal(true);
  }

  function openEdit(user: UserResponse) {
    setEditing(user);
    setForm({ username: user.username, firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', password: '', role: user.role, enabled: user.enabled });
    setShowModal(true);
  }

  function openDelete(user: UserResponse) {
    setDeleteTarget(user);
    setShowDeleteModal(true);
  }

  async function handleSave() {
    if (!form.username.trim()) { showToast('Username is required', 'warning'); return; }
    if (!editing && !form.password.trim()) { showToast('Password is required', 'warning'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          email: form.email || undefined,
          password: form.password || undefined,
          role: form.role,
          enabled: form.enabled,
        });
        showToast('User updated', 'success');
      } else {
        await createUser({
          username: form.username,
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          email: form.email,
          password: form.password,
          role: form.role,
          enabled: form.enabled,
        });
        showToast('User created', 'success');
      }
      setShowModal(false);
      await fetchUsers();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to save user'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteUser(deleteTarget.id);
      showToast('User deleted', 'success');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to delete user'), 'error');
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
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl shadow-inner backdrop-blur-sm">
              👤
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Users</h1>
              <p className="mt-1 text-sm text-slate-300">Manage users and their roles in the system</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            New User
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{users.filter((u) => u.enabled).length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Disabled</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{users.filter((u) => !u.enabled).length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Roles</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{new Set(users.map((u) => u.role)).size}</p>
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
            placeholder="Search by ID, username, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching users' : 'No users found'}
          description={search ? 'Try a different search term.' : 'Create your first user to get started.'}
          action={
            !search ? (
              <button type="button" onClick={openCreate} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95">
                + Create User
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">#{u.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {(u.firstName || u.lastName)
                            ? (u.firstName?.charAt(0).toUpperCase() || u.lastName?.charAt(0).toUpperCase())
                            : u.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.firstName || u.lastName
                        ? <span className="text-slate-700">{u.firstName || ''}{u.firstName && u.lastName ? ' ' : ''}{u.lastName || ''}</span>
                        : <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-700 ring-slate-300'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${u.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {u.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                {editing ? '👤' : '✨'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {editing ? `Edit User` : 'New User'}
                  </h2>
                  {editing && (
                    <span className="font-mono text-xs text-slate-400 bg-slate-100 rounded-md px-2 py-0.5">ID: {editing.id}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {editing ? 'Update the user details below' : 'Fill in the details to create a new user'}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700">Username</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    disabled={!!editing}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="johndoe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">First Name</label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="John"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Last Name</label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password {editing && <span className="font-normal text-slate-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder={editing ? 'Leave blank to keep current' : 'Password'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-900 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 appearance-none"
                  >
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Account Status</p>
                  <p className="text-xs text-slate-500">{form.enabled ? 'User can log in' : 'User cannot log in'}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                  <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
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
                  editing ? 'Update User' : 'Create User'
                )}
              </button>
            </div>
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
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Delete User</h3>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">@{deleteTarget.username}</span>? This action cannot be undone.
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
