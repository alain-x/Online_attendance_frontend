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

import type { EmployeeResponse } from '../api/types';
import type { Holiday } from '../api/holidays';
import type { WorkLocation } from '../api/types';

type HrSection = 'overview' | 'staff' | 'reports' | 'holidays' | 'settings';

export default function HRDashboard() {
  const { user } = useAuth();
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

  const sidebarItems = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'staff', label: 'Staff' },
      { key: 'reports', label: 'Reports' },
      { key: 'holidays', label: 'Holidays' },
      { key: 'settings', label: 'Settings' },
    ],
    []
  );

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
      activeSidebarKey={section}
      onSidebarChange={(k) => setSection(k as HrSection)}
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
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Today</div>
                <div className="mt-1 text-sm text-slate-600">Staff activity summary and pending tasks will appear here.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Pending approvals</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Late arrivals</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Absentees</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Quick actions</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('staff')}>
                    <div className="text-sm font-medium text-slate-900">Manage staff</div>
                    <div className="mt-1 text-xs text-slate-600">Create, update, import, and review staff.</div>
                  </button>
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('reports')}>
                    <div className="text-sm font-medium text-slate-900">View reports</div>
                    <div className="mt-1 text-xs text-slate-600">Export and analyze attendance data.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Policy & compliance</div>
                <div className="mt-1 text-sm text-slate-600">Holiday policy, working hours, and compliance checks.</div>
                <div className="mt-3">
                  <EmptyState title="Coming soon" description="This section will include compliance controls and policy configuration." />
                </div>
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
