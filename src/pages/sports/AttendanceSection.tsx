import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { todayAttendance } from '../../api/attendance';
import { getHomeAnalytics, getTimesheet } from '../../api/analytics';
import { listEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../api/employees';
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../api/holidays';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { getApiErrorMessage } from '../../utils/error';
import { utcDateString } from '../../utils/date';

import type { AttendanceResponse, DayEmployeeRow, EmployeeResponse, HomeAnalyticsResponse, TimesheetResponse, CreateEmployeeRequest, Role } from '../../api/types';
import type { Holiday } from '../../api/holidays';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'staff', label: 'Staff' },
  { key: 'timesheet', label: 'Timesheet' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const ROLE_OPTIONS: Role[] = ['ADMIN', 'HR', 'MANAGER', 'RECORDER', 'EMPLOYEE', 'PAYROLL', 'AUDITOR', 'CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'PLAYER', 'PARENT'];

export default function AttendanceSection() {
  const { toast, showToast, hideToast } = useToast();
  const [tab, setTab] = useState<TabKey>('dashboard');

  const [attendance, setAttendance] = useState<AttendanceResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState<HomeAnalyticsResponse | null>(null);
  const [timesheet, setTimesheet] = useState<TimesheetResponse | null>(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [tsYear, setTsYear] = useState(() => new Date().getUTCFullYear());
  const [tsMonth, setTsMonth] = useState(() => new Date().getUTCMonth() + 1);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidayForm, setHolidayForm] = useState<{ id?: number | null; date: string; name: string }>({ id: null, date: utcDateString(new Date()), name: '' });
  const [holidayBusy, setHolidayBusy] = useState(false);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeResponse | null>(null);
  const [employeeForm, setEmployeeForm] = useState<CreateEmployeeRequest>({
    employeeCode: '', firstName: '', lastName: '', department: '', mobile: '', designation: '', category: '',
    username: '', email: '', password: '', role: 'EMPLOYEE', hourlyRateOverride: null,
  });
  const [employeeBusy, setEmployeeBusy] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      const [a, e, h] = await Promise.all([todayAttendance(), listEmployees(), getHomeAnalytics()]);
      setAttendance(a);
      setEmployees(e);
      setAnalytics(h);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const uniqueAttendance = useMemo(() => {
    const seen = new Set<number>();
    return attendance.filter(r => { if (seen.has(r.employeeId)) return false; seen.add(r.employeeId); return true; });
  }, [attendance]);

  const stats = useMemo(() => ({
    totalStaff: analytics?.totalStaff ?? employees.length,
    present: uniqueAttendance.filter(r => !!r.checkInTime && !r.checkOutTime).length,
    checkedOut: uniqueAttendance.filter(r => !!r.checkInTime && !!r.checkOutTime).length,
    notIn: employees.length - uniqueAttendance.filter(r => !!r.checkInTime).length,
  }), [analytics, employees, uniqueAttendance]);

  async function loadTimesheet() {
    setTimesheetLoading(true);
    try {
      const data = await getTimesheet({ year: tsYear, month: tsMonth });
      setTimesheet(data);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load timesheet'), 'error');
    } finally {
      setTimesheetLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'timesheet') loadTimesheet();
  }, [tab, tsYear, tsMonth]);

  async function fetchHolidays() {
    setHolidaysLoading(true);
    try {
      const from = new Date(Date.UTC(tsYear, tsMonth - 1, 1)).toISOString().slice(0, 10);
      const to = new Date(Date.UTC(tsYear, tsMonth, 0)).toISOString().slice(0, 10);
      const data = await listHolidays({ from, to });
      setHolidays(data);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load holidays'), 'error');
    } finally {
      setHolidaysLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'settings') fetchHolidays();
  }, [tab, tsYear, tsMonth]);

  function openCreateEmployee() {
    setEditingEmployee(null);
    setEmployeeForm({
      employeeCode: '', firstName: '', lastName: '', department: '', mobile: '', designation: '', category: '',
      username: '', email: '', password: '', role: 'EMPLOYEE', hourlyRateOverride: null,
    });
    setEmployeeModalOpen(true);
  }

  function openEditEmployee(emp: EmployeeResponse) {
    setEditingEmployee(emp);
    setEmployeeForm({
      employeeCode: emp.employeeCode, firstName: emp.firstName, lastName: emp.lastName,
      department: emp.department || '', mobile: emp.mobile || '', designation: emp.designation || '',
      category: emp.category || '', username: emp.username, email: emp.email || '',
      password: '', role: emp.role, hourlyRateOverride: emp.hourlyRateOverride ?? null,
    });
    setEmployeeModalOpen(true);
  }

  async function handleSaveEmployee() {
    if (!employeeForm.employeeCode.trim() || !employeeForm.firstName.trim() || !employeeForm.username.trim()) {
      showToast('Employee code, first name, and username are required', 'warning');
      return;
    }
    setEmployeeBusy(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, {
          firstName: employeeForm.firstName, lastName: employeeForm.lastName,
          department: employeeForm.department, mobile: employeeForm.mobile,
          designation: employeeForm.designation, category: employeeForm.category,
          role: employeeForm.role,
          ...(employeeForm.password ? { password: employeeForm.password } : {}),
        } as any);
        showToast('Employee updated', 'success');
      } else {
        await createEmployee(employeeForm);
        showToast('Employee created', 'success');
      }
      setEmployeeModalOpen(false);
      await fetchAttendance();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to save employee'), 'error');
    } finally {
      setEmployeeBusy(false);
    }
  }

  async function handleDeleteEmployee(id: number, name: string) {
    if (!window.confirm(`Delete employee "${name}"?`)) return;
    try {
      await deleteEmployee(id);
      showToast('Employee deleted', 'success');
      await fetchAttendance();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to delete employee'), 'error');
    }
  }

  async function handleSaveHoliday() {
    if (!holidayForm.date || !holidayForm.name.trim()) { showToast('Date and name are required', 'warning'); return; }
    setHolidayBusy(true);
    try {
      if (holidayForm.id) {
        await updateHoliday(holidayForm.id, { date: holidayForm.date, name: holidayForm.name });
        showToast('Holiday updated', 'success');
      } else {
        await createHoliday({ date: holidayForm.date, name: holidayForm.name });
        showToast('Holiday created', 'success');
      }
      setHolidayForm({ id: null, date: utcDateString(new Date()), name: '' });
      await fetchHolidays();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to save holiday'), 'error');
    } finally {
      setHolidayBusy(false);
    }
  }

  async function handleDeleteHoliday(id: number) {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await deleteHoliday(id);
      showToast('Holiday deleted', 'success');
      await fetchHolidays();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to delete holiday'), 'error');
    }
  }

  function formatMinutes(mins: number | undefined | null): string {
    const n = Number(mins || 0);
    const h = Math.floor(n / 60);
    const m = n % 60;
    return `${h}h ${m}m`;
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="mb-6 flex gap-2">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        loading ? <LoadingSpinner /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Staff', value: stats.totalStaff, color: 'text-slate-900' },
                { label: 'Checked In', value: stats.present, color: 'text-green-600' },
                { label: 'Checked Out', value: stats.checkedOut, color: 'text-blue-600' },
                { label: 'Not In', value: stats.notIn, color: 'text-amber-600' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">Today's Attendance</h3>
              </div>
              {uniqueAttendance.length === 0 ? (
                <EmptyState title="No records" description="No attendance records for today." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-slate-500 uppercase">
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Check In</th>
                        <th className="px-4 py-3">Check Out</th>
                        <th className="px-4 py-3">Worked</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {uniqueAttendance.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{r.employeeFirstName} {r.employeeLastName}</td>
                          <td className="px-4 py-3 text-slate-600">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{r.workedMinutes > 0 ? formatMinutes(r.workedMinutes) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${r.checkInTime && !r.checkOutTime ? 'bg-green-100 text-green-700' : r.checkInTime && r.checkOutTime ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                              {r.checkInTime && !r.checkOutTime ? 'In' : r.checkInTime && r.checkOutTime ? 'Out' : 'Not In'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {tab === 'staff' && (
        <div>
          <div className="flex justify-end mb-4">
            <button type="button" onClick={openCreateEmployee}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + New Employee
            </button>
          </div>
          {employees.length === 0 ? (
            <EmptyState title="No employees" description="No employees found. Create your first employee." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.employeeCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{emp.firstName} {emp.lastName}</td>
                      <td className="px-4 py-3 text-slate-600">{emp.department || '—'}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{emp.role}</span></td>
                      <td className="px-4 py-3 text-slate-600">{emp.username}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openEditEmployee(emp)}
                          className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">Edit</button>
                        <button type="button" onClick={() => handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`)}
                          className="ml-2 rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {employeeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEmployeeModalOpen(false)}>
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  {editingEmployee ? `Edit: ${editingEmployee.firstName} ${editingEmployee.lastName}` : 'New Employee'}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Code *</label>
                    <input type="text" value={employeeForm.employeeCode} onChange={e => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })}
                      disabled={!!editingEmployee}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                    <input type="text" value={employeeForm.department || ''} onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                    <input type="text" value={employeeForm.firstName} onChange={e => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mobile</label>
                    <input type="text" value={employeeForm.mobile || ''} onChange={e => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                    <input type="text" value={employeeForm.lastName} onChange={e => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                    <input type="text" value={employeeForm.designation || ''} onChange={e => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
                    <input type="text" value={employeeForm.username} onChange={e => setEmployeeForm({ ...employeeForm, username: e.target.value })}
                      disabled={!!editingEmployee}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                    <input type="text" value={employeeForm.category || ''} onChange={e => setEmployeeForm({ ...employeeForm, category: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input type="email" value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{editingEmployee ? 'Password (leave blank to keep)' : 'Password *'}</label>
                    <input type="password" value={employeeForm.password} onChange={e => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                    <select value={employeeForm.role} onChange={e => setEmployeeForm({ ...employeeForm, role: e.target.value as Role })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Hourly Rate Override</label>
                    <input type="number" step="0.01" min="0"
                      value={employeeForm.hourlyRateOverride ?? ''}
                      onChange={e => setEmployeeForm({ ...employeeForm, hourlyRateOverride: e.target.value ? Number(e.target.value) : null })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setEmployeeModalOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={handleSaveEmployee} disabled={employeeBusy}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {employeeBusy ? 'Saving...' : editingEmployee ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'timesheet' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <select value={tsYear} onChange={e => setTsYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={tsMonth} onChange={e => setTsMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2020, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <button type="button" onClick={loadTimesheet}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Load</button>
          </div>
          {timesheetLoading ? <LoadingSpinner /> : !timesheet ? (
            <EmptyState title="Select a month" description="Choose year and month and click Load." />
          ) : timesheet.rows.length === 0 ? (
            <EmptyState title="No data" description="No timesheet data for this period." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Worked</th>
                    <th className="px-4 py-3">Overtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {timesheet.rows.map(r => (
                    <tr key={r.employeeId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.firstName} {r.lastName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.presentDays} / {timesheet.days.length}</td>
                      <td className="px-4 py-3 text-slate-600">{formatMinutes(r.workedMinutes)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.overtimeMinutes > 0 ? formatMinutes(r.overtimeMinutes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Holidays</h3>
            <div className="flex items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="e.g. Independence Day" />
              </div>
              <button type="button" onClick={handleSaveHoliday} disabled={holidayBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {holidayBusy ? 'Saving...' : holidayForm.id ? 'Update' : 'Add'}
              </button>
            </div>
            {holidaysLoading ? <LoadingSpinner /> : holidays.length === 0 ? (
              <EmptyState title="No holidays" description="No holidays defined for this month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-slate-500 uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {holidays.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900">{h.date}</td>
                        <td className="px-4 py-3 text-slate-600">{h.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setHolidayForm({ id: h.id, date: h.date, name: h.name })}
                            className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">Edit</button>
                          <button type="button" onClick={() => handleDeleteHoliday(h.id)}
                            className="ml-2 rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
