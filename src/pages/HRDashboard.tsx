import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { listEmployees } from '../api/employees';
import { createHoliday, deleteHoliday, listHolidays, updateHoliday } from '../api/holidays';
import { listLocations, createLocation, updateLocation, deleteLocation } from '../api/locations';
import { downloadDailyAttendanceCsv } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import ChartBox from '../components/ChartBox';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import type { EmployeeResponse } from '../api/types';
import type { Holiday } from '../api/holidays';
import type { WorkLocation } from '../api/types';

type HrSection = 'overview' | 'staff' | 'reports' | 'holidays' | 'settings';

export default function HRDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<HrSection>('overview');

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffDepartment, setStaffDepartment] = useState<string>('ALL');

  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState<{ id: number | null; date: string; name: string }>({ id: null, date: new Date().toISOString().slice(0, 10), name: '' });

  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [locationForm, setLocationForm] = useState<{ id: number | null; name: string; latitude: string; longitude: string; radiusMeters: string; active: boolean }>(
    { id: null, name: '', latitude: '', longitude: '', radiusMeters: '100', active: true }
  );

  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const sidebarItems = useMemo(() => {
    if (user?.role === 'ADMIN') {
      return [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'employee_nav', label: 'Employee Dashboard' },
        { key: 'recorder_nav', label: 'Recorder (Take Attendance)' },
        { key: 'hr_nav', label: 'HR Dashboard' },
        { key: 'manager_nav', label: 'Manager Dashboard' },
        { key: 'payroll_nav', label: 'Payroll Dashboard' },
        { key: 'auditor_nav', label: 'Auditor Dashboard' },
        { key: 'reports', label: 'Reports & Analytics' },
        { key: 'workforce', label: 'Workforce Plan' },
        { key: 'staff', label: 'Staff Directory' },
        { key: 'settings', label: 'Settings' },
      ];
    }
    return [
      { key: 'overview', label: 'Overview' },
      { key: 'staff', label: 'Staff' },
      { key: 'reports', label: 'Reports' },
      { key: 'holidays', label: 'Holidays' },
      { key: 'settings', label: 'Settings' },
    ];
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'HR') {
      showToast('Access limited: HR dashboard is for HR accounts only.', 'warning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  async function refreshEmployees() {
    setEmployeesError(null);
    setEmployeesLoading(true);
    try {
      const list = await listEmployees();
      setEmployees(list);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Failed to load staff';
      setEmployeesError(msg);
      showToast(msg, 'error');
    } finally {
      setEmployeesLoading(false);
    }
  }

  useEffect(() => {
    if (section !== 'staff') return;
    refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  async function refreshHolidays() {
    setHolidayError(null);
    setHolidayLoading(true);
    try {
      const list = await listHolidays();
      setHolidays(list);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Failed to load holidays';
      setHolidayError(msg);
      showToast(msg, 'error');
    } finally {
      setHolidayLoading(false);
    }
  }

  async function refreshLocations() {
    setLocationsError(null);
    setLocationsLoading(true);
    try {
      const list = await listLocations();
      setLocations(list);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Failed to load work locations';
      setLocationsError(msg);
      showToast(msg, 'error');
    } finally {
      setLocationsLoading(false);
    }
  }

  useEffect(() => {
    if (section === 'holidays') {
      refreshHolidays();
    }
    if (section === 'settings') {
      refreshLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const staffDepartmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      const d = (e.department || '').trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return employees
      .filter((e) => {
        if (staffDepartment !== 'ALL') {
          const d = (e.department || '').trim();
          if (d !== staffDepartment) return false;
        }
        if (!q) return true;
        const hay = [e.employeeCode, e.firstName, e.lastName, e.username, e.department || '', e.designation || '', e.mobile || '']
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aa = `${a.firstName} ${a.lastName} ${a.employeeCode}`.toLowerCase();
        const bb = `${b.firstName} ${b.lastName} ${b.employeeCode}`.toLowerCase();
        return aa.localeCompare(bb);
      });
  }, [employees, staffDepartment, staffSearch]);

  return (
    <AppLayout
      title="HR"
      sidebarItems={sidebarItems}
      activeSidebarKey={user?.role === 'ADMIN' ? 'hr_nav' : section}
      onSidebarChange={(k) => {
        if (user?.role === 'ADMIN') {
          if (k === 'employee_nav') {
            navigate('/employee');
            return;
          }
          if (k === 'recorder_nav') {
            navigate('/recorder');
            return;
          }
          if (k === 'hr_nav') return;
          if (k === 'manager_nav') {
            navigate('/manager');
            return;
          }
          if (k === 'payroll_nav') {
            navigate('/payroll');
            return;
          }
          if (k === 'auditor_nav') {
            navigate('/auditor');
            return;
          }
          navigate('/admin', { state: { section: k } });
          return;
        }
        setSection(k as HrSection);
      }}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
            <div className="mt-1 text-sm text-slate-600">HR tools for staff management, compliance, and reports.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Role: HR</div>
            {user?.companySlug ? <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Company: {user.companySlug}</div> : null}
          </div>
        </div>

        {section === 'overview' ? (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 p-6 sm:p-8">
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/5 blur-xl" />
              <div className="relative">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">HR Overview</h1>
                <p className="mt-1 text-sm text-slate-300">Staff management, compliance, and attendance insights.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{employees.length}</div>
                    <div className="mt-1 text-sm font-medium text-white/80">Total Staff</div>
                  </div>
                  <svg className="h-10 w-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{staffDepartmentOptions.length}</div>
                    <div className="mt-1 text-sm font-medium text-white/80">Departments</div>
                  </div>
                  <svg className="h-10 w-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold">{holidays.length}</div>
                    <div className="mt-1 text-sm font-medium text-white/80">Holidays</div>
                  </div>
                  <svg className="h-10 w-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-4 font-semibold text-slate-900">Staff by Department</h3>
                <ChartBox className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={staffDepartmentOptions.slice(0, 10).map((d) => ({
                      name: d.length > 12 ? d.slice(0, 12) + '\u2026' : d,
                      count: employees.filter((e) => (e.department || '').trim() === d).length,
                    }))} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-4 font-semibold text-slate-900">Department Distribution</h3>
                <ChartBox className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={staffDepartmentOptions.slice(0, 8).map((d, idx) => ({
                          name: d,
                          value: employees.filter((e) => (e.department || '').trim() === d).length,
                        }))}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      >
                        {staffDepartmentOptions.slice(0, 8).map((_, idx) => (
                          <Cell key={idx} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][idx % 8]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5">
              <h3 className="mb-4 font-semibold text-slate-900">Quick Actions</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" className="rounded-lg border bg-white px-4 py-4 text-left hover:bg-slate-50 transition-colors" onClick={() => setSection('staff')}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Manage staff</div>
                      <div className="mt-0.5 text-xs text-slate-500">Create, update, and review staff</div>
                    </div>
                  </div>
                </button>
                <button type="button" className="rounded-lg border bg-white px-4 py-4 text-left hover:bg-slate-50 transition-colors" onClick={() => setSection('reports')}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">View reports</div>
                      <div className="mt-0.5 text-xs text-slate-500">Export and analyze attendance data</div>
                    </div>
                  </div>
                </button>
                <button type="button" className="rounded-lg border bg-white px-4 py-4 text-left hover:bg-slate-50 transition-colors" onClick={() => setSection('holidays')}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Manage holidays</div>
                      <div className="mt-0.5 text-xs text-slate-500">Add and edit public holidays</div>
                    </div>
                  </div>
                </button>
                <button type="button" className="rounded-lg border bg-white px-4 py-4 text-left hover:bg-slate-50 transition-colors" onClick={() => setSection('settings')}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Work locations</div>
                      <div className="mt-0.5 text-xs text-slate-500">Configure geofence locations</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {section !== 'overview' ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {section === 'staff' ? (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-slate-900">Staff directory</div>
                    <div className="text-sm text-slate-600">Search and review employee profiles. Editing and bulk actions will be added next.</div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={staffDepartment}
                      onChange={(e) => setStaffDepartment(e.target.value)}
                    >
                      <option value="ALL">All departments</option>
                      {staffDepartmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full sm:w-72 rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="Search name, code, username…"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={employeesLoading}
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={refreshEmployees}
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {employeesError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{employeesError}</div>
                ) : null}

                {employeesLoading ? (
                  <div className="mt-6 flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <EmptyState
                    title="No staff found"
                    description={staffSearch.trim() || staffDepartment !== 'ALL' ? 'No employees match your filters.' : 'No employees found.'}
                  />
                ) : (
                  <>
                    <div className="mt-4 hidden md:block overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-3 text-left">Employee</th>
                            <th className="px-4 py-3 text-left">Code</th>
                            <th className="px-4 py-3 text-left">Department</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Username</th>
                            <th className="px-4 py-3 text-left">Mobile</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.map((e) => (
                            <tr key={e.id} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{e.firstName} {e.lastName}</td>
                              <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{e.employeeCode}</td>
                              <td className="px-4 py-3 text-slate-700">{e.department || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{e.role === 'SYSTEM_ADMIN' ? '—' : e.role}</td>
                              <td className="px-4 py-3 text-slate-700">{e.username}</td>
                              <td className="px-4 py-3 text-slate-700">{e.mobile || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 grid gap-3 md:hidden">
                      {filteredEmployees.map((e) => (
                        <div key={e.id} className="rounded-xl border bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{e.firstName} {e.lastName}</div>
                              <div className="mt-1 text-xs text-slate-600">Code: <span className="font-medium text-slate-800">{e.employeeCode}</span></div>
                            </div>
                            <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{e.role === 'SYSTEM_ADMIN' ? '—' : e.role}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-slate-500">Department</div>
                              <div className="text-slate-800">{e.department || '—'}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Username</div>
                              <div className="text-slate-800">{e.username}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Mobile</div>
                              <div className="text-slate-800">{e.mobile || '—'}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Designation</div>
                              <div className="text-slate-800">{e.designation || '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : section === 'reports' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Reports</div>
                    <div className="mt-1 text-sm text-slate-600">Generate exports for auditing and HR analysis.</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7 rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Daily attendance (CSV)</div>
                    <div className="mt-1 text-sm text-slate-600">Download the daily attendance report for a specific date.</div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end">
                      <label className="block">
                        <div className="text-xs font-medium text-slate-600">Date</div>
                        <input className="mt-1 rounded-md border bg-white px-3 py-2 text-sm" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                        onClick={() => downloadDailyAttendanceCsv(reportDate)}
                      >
                        Download CSV
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-xl border bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">More reports</div>
                    <div className="mt-1 text-sm text-slate-600">Monthly timesheet, overtime, and compliance packs will be added here.</div>
                    <div className="mt-3">
                      <EmptyState title="No additional reports yet" description="This area is ready for more reports when enabled." />
                    </div>
                  </div>
                </div>
              </div>
            ) : section === 'holidays' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Holidays</div>
                    <div className="mt-1 text-sm text-slate-600">Maintain public holidays used by timesheet and payroll.</div>
                  </div>
                  <button
                    type="button"
                    disabled={holidayLoading}
                    className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={refreshHolidays}
                  >
                    Refresh
                  </button>
                </div>

                {holidayError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{holidayError}</div>
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-5 rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{holidayForm.id ? 'Edit holiday' : 'Add holiday'}</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <div className="text-xs font-medium text-slate-600">Date</div>
                        <input
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                          type="date"
                          value={holidayForm.date}
                          onChange={(e) => setHolidayForm((p) => ({ ...p, date: e.target.value }))}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <div className="text-xs font-medium text-slate-600">Name</div>
                        <input
                          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                          value={holidayForm.name}
                          onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. New Year's Day"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {holidayForm.id ? (
                        <button
                          type="button"
                          disabled={holidayLoading}
                          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => setHolidayForm({ id: null, date: holidayForm.date, name: '' })}
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={holidayLoading || !holidayForm.date || !holidayForm.name.trim()}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        onClick={async () => {
                          setHolidayError(null);
                          setHolidayLoading(true);
                          try {
                            if (holidayForm.id) {
                              await updateHoliday(holidayForm.id, { date: holidayForm.date, name: holidayForm.name });
                              showToast('Holiday updated', 'success');
                            } else {
                              await createHoliday({ date: holidayForm.date, name: holidayForm.name });
                              showToast('Holiday added', 'success');
                            }
                            setHolidayForm({ id: null, date: holidayForm.date, name: '' });
                            await refreshHolidays();
                          } catch (e: unknown) {
                            const err = e as { response?: { data?: { message?: string } }; message?: string };
                            const msg = err?.response?.data?.message || err?.message || 'Failed to save holiday';
                            setHolidayError(msg);
                            showToast(msg, 'error');
                          } finally {
                            setHolidayLoading(false);
                          }
                        }}
                      >
                        {holidayLoading ? 'Saving…' : holidayForm.id ? 'Update holiday' : 'Add holiday'}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-7 rounded-xl border bg-white overflow-x-auto">
                    <div className="px-4 py-3 border-b font-medium text-slate-900">Holiday list</div>
                    {holidayLoading ? (
                      <div className="py-12 flex items-center justify-center">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : holidays.length === 0 ? (
                      <EmptyState title="No holidays" description="Add public holidays so the timesheet can mark those days." />
                    ) : (
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-2 text-left">Date</th>
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {holidays
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((h) => (
                              <tr key={h.id} className="border-t">
                                <td className="px-4 py-2 whitespace-nowrap">{h.date}</td>
                                <td className="px-4 py-2">{h.name}</td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={holidayLoading}
                                      className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
                                      onClick={() => setHolidayForm({ id: h.id, date: h.date, name: h.name })}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={holidayLoading}
                                      className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-60"
                                      onClick={async () => {
                                        const ok = window.confirm('Delete this holiday?');
                                        if (!ok) return;
                                        setHolidayError(null);
                                        setHolidayLoading(true);
                                        try {
                                          await deleteHoliday(h.id);
                                          showToast('Holiday deleted', 'success');
                                          await refreshHolidays();
                                        } catch (e: unknown) {
                                          const err = e as { response?: { data?: { message?: string } }; message?: string };
                                          const msg = err?.response?.data?.message || err?.message || 'Failed to delete holiday';
                                          setHolidayError(msg);
                                          showToast(msg, 'error');
                                        } finally {
                                          setHolidayLoading(false);
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ) : section === 'settings' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Settings</div>
                    <div className="mt-1 text-sm text-slate-600">Work locations and basic operational settings.</div>
                  </div>
                  <button
                    type="button"
                    disabled={locationsLoading}
                    className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={refreshLocations}
                  >
                    Refresh
                  </button>
                </div>

                {locationsError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{locationsError}</div>
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-5 rounded-xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{locationForm.id ? 'Edit location' : 'Add location'}</div>
                    <div className="mt-3 grid gap-2">
                      <label className="block">
                        <div className="text-xs font-medium text-slate-600">Name</div>
                        <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block">
                          <div className="text-xs font-medium text-slate-600">Latitude</div>
                          <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" value={locationForm.latitude} onChange={(e) => setLocationForm((p) => ({ ...p, latitude: e.target.value }))} placeholder="e.g. -1.2921" />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium text-slate-600">Longitude</div>
                          <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" value={locationForm.longitude} onChange={(e) => setLocationForm((p) => ({ ...p, longitude: e.target.value }))} placeholder="e.g. 36.8219" />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium text-slate-600">Radius (meters)</div>
                          <input className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" type="number" min={1} value={locationForm.radiusMeters} onChange={(e) => setLocationForm((p) => ({ ...p, radiusMeters: e.target.value }))} />
                        </label>
                        <label className="flex items-center gap-2 mt-6">
                          <input type="checkbox" checked={locationForm.active} onChange={(e) => setLocationForm((p) => ({ ...p, active: e.target.checked }))} />
                          <span className="text-sm text-slate-700">Active</span>
                        </label>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      {locationForm.id ? (
                        <button
                          type="button"
                          disabled={locationsLoading}
                          className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => setLocationForm({ id: null, name: '', latitude: '', longitude: '', radiusMeters: '100', active: true })}
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={locationsLoading || !locationForm.name.trim() || !locationForm.latitude.trim() || !locationForm.longitude.trim()}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                        onClick={async () => {
                          setLocationsError(null);
                          setLocationsLoading(true);
                          try {
                            const payload = {
                              name: locationForm.name,
                              latitude: Number(locationForm.latitude),
                              longitude: Number(locationForm.longitude),
                              radiusMeters: Number(locationForm.radiusMeters || '100'),
                              active: !!locationForm.active,
                            };
                            if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude) || !Number.isFinite(payload.radiusMeters)) {
                              throw new Error('Latitude/Longitude/Radius must be valid numbers');
                            }
                            if (locationForm.id) {
                              await updateLocation(locationForm.id, payload);
                              showToast('Location updated', 'success');
                            } else {
                              await createLocation(payload);
                              showToast('Location added', 'success');
                            }
                            setLocationForm({ id: null, name: '', latitude: '', longitude: '', radiusMeters: '100', active: true });
                            await refreshLocations();
                          } catch (e: unknown) {
                            const err = e as { response?: { data?: { message?: string } }; message?: string };
                            const msg = err?.response?.data?.message || err?.message || 'Failed to save location';
                            setLocationsError(msg);
                            showToast(msg, 'error');
                          } finally {
                            setLocationsLoading(false);
                          }
                        }}
                      >
                        {locationsLoading ? 'Saving…' : locationForm.id ? 'Update location' : 'Add location'}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-7 rounded-xl border bg-white overflow-x-auto">
                    <div className="px-4 py-3 border-b font-medium text-slate-900">Work locations</div>
                    {locationsLoading ? (
                      <div className="py-12 flex items-center justify-center">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : locations.length === 0 ? (
                      <EmptyState title="No locations" description="Add a work location for geofence-based verification." />
                    ) : (
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2 text-left">Coordinates</th>
                            <th className="px-4 py-2 text-right">Radius</th>
                            <th className="px-4 py-2 text-center">Active</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {locations.map((loc) => (
                            <tr key={loc.id} className="border-t">
                              <td className="px-4 py-2 font-medium text-slate-900">{loc.name}</td>
                              <td className="px-4 py-2 text-slate-700">{loc.latitude}, {loc.longitude}</td>
                              <td className="px-4 py-2 text-right text-slate-700">{loc.radiusMeters}m</td>
                              <td className="px-4 py-2 text-center text-slate-700">{loc.active ? 'Yes' : 'No'}</td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={locationsLoading}
                                    className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
                                    onClick={() =>
                                      setLocationForm({
                                        id: loc.id,
                                        name: loc.name,
                                        latitude: String(loc.latitude),
                                        longitude: String(loc.longitude),
                                        radiusMeters: String(loc.radiusMeters),
                                        active: !!loc.active,
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={locationsLoading}
                                    className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-60"
                                    onClick={async () => {
                                      const ok = window.confirm('Delete this location?');
                                      if (!ok) return;
                                      setLocationsError(null);
                                      setLocationsLoading(true);
                                      try {
                                        await deleteLocation(loc.id);
                                        showToast('Location deleted', 'success');
                                        await refreshLocations();
                                      } catch (e: unknown) {
                                        const err = e as { response?: { data?: { message?: string } }; message?: string };
                                        const msg = err?.response?.data?.message || err?.message || 'Failed to delete location';
                                        setLocationsError(msg);
                                        showToast(msg, 'error');
                                      } finally {
                                        setLocationsLoading(false);
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No data" description="This section is ready. Connect the backend or enable more features to populate it." />
            )}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
