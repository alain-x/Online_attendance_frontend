import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { listEmployees } from '../api/employees';
import { getTimesheet } from '../api/analytics';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';

import type { EmployeeResponse } from '../api/types';
import type { TimesheetResponse, TimesheetCell } from '../api/types';

type ManagerSection = 'overview' | 'team' | 'timesheet' | 'reports' | 'workforce' | 'approvals';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [section, setSection] = useState<ManagerSection>('overview');

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDepartment, setTeamDepartment] = useState<string>('ALL');

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getUTCMonth() + 1);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);
  const [timesheet, setTimesheet] = useState<TimesheetResponse | null>(null);

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
      { key: 'team', label: 'Team' },
      { key: 'timesheet', label: 'Timesheet' },
      { key: 'reports', label: 'Reports' },
      { key: 'workforce', label: 'Workforce Plan' },
      { key: 'approvals', label: 'Approvals' },
    ];
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'MANAGER') {
      showToast('Access limited: Manager dashboard is for Manager accounts only.', 'warning');
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
      const msg = err?.response?.data?.message || err?.message || 'Failed to load team';
      setEmployeesError(msg);
      showToast(msg, 'error');
    } finally {
      setEmployeesLoading(false);
    }
  }

  useEffect(() => {
    if (section !== 'team') return;
    refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const teamDepartmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      const d = (e.department || '').trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return employees
      .filter((e) => {
        if (teamDepartment !== 'ALL') {
          const d = (e.department || '').trim();
          if (d !== teamDepartment) return false;
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
  }, [employees, teamDepartment, teamSearch]);

  function minutesToDecimalHours(mins: number): number {
    const n = Number(mins || 0);
    return Math.round((n / 60) * 100) / 100;
  }

  function csvEscape(v: unknown): string {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function isHolidayCell(c: TimesheetCell | undefined | null): boolean {
    return !!c && c.state === 'HOLIDAY';
  }

  function isLeaveCell(c: TimesheetCell | undefined | null): boolean {
    return !!c && c.state === 'LEAVE';
  }

  function isWeeklyOffUtc(dateStr: string): boolean {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return d.getUTCDay() === 0;
  }

  async function loadTimesheet() {
    setTimesheetError(null);
    setTimesheetLoading(true);
    try {
      const data = await getTimesheet({ year: selectedYear, month: selectedMonth });
      setTimesheet(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Failed to load timesheet';
      setTimesheetError(msg);
      showToast(msg, 'error');
    } finally {
      setTimesheetLoading(false);
    }
  }

  function exportTimesheetCsv(ts?: TimesheetResponse | null) {
    const t = ts || timesheet;
    if (!t) {
      showToast('Timesheet not loaded', 'error');
      return;
    }

    const header = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Department',
      'Role',
      'Year',
      'Month',
      'Present Days',
      'Weekly Off Days',
      'Absent Days',
      'Worked Hours',
      'Overtime Hours',
      ...t.days.map((d) => d),
    ];

    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(','));

    for (const r of t.rows) {
      const weeklyOffDays = t.days.reduce((acc, d, idx) => {
        const cell = r.days[idx];
        if (cell?.state === 'PRESENT' || isHolidayCell(cell) || isLeaveCell(cell)) return acc;
        return acc + (isWeeklyOffUtc(d) ? 1 : 0);
      }, 0);
      const absentDays = t.days.reduce((acc, d, idx) => {
        const cell = r.days[idx];
        if (cell?.state === 'PRESENT' || isHolidayCell(cell) || isLeaveCell(cell)) return acc;
        return acc + (isWeeklyOffUtc(d) ? 0 : 1);
      }, 0);
      const workedHrs = minutesToDecimalHours(r.workedMinutes);
      const overtimeHrs = minutesToDecimalHours(r.overtimeMinutes);

      const dayStatuses = t.days.map((d, idx) => {
        const c = r.days[idx];
        if (c?.state === 'PRESENT') return 'PR';
        if (isHolidayCell(c)) return 'PH';
        if (isLeaveCell(c)) return 'LV';
        return isWeeklyOffUtc(d) ? 'WO' : 'AB';
      });

      const row = [
        r.employeeCode,
        r.firstName,
        r.lastName,
        r.department ?? '',
        r.role ?? '',
        t.year,
        t.month,
        r.presentDays,
        weeklyOffDays,
        absentDays,
        workedHrs,
        overtimeHrs,
        ...dayStatuses,
      ];
      lines.push(row.map(csvEscape).join(','));
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manager_timesheet_${t.year}_${String(t.month).padStart(2, '0')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout
      title="Manager"
      sidebarItems={sidebarItems}
      activeSidebarKey={user?.role === 'ADMIN' ? 'manager_nav' : section}
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
          if (k === 'hr_nav') {
            navigate('/hr');
            return;
          }
          if (k === 'manager_nav') return;
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
        setSection(k as ManagerSection);
      }}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{sidebarItems.find((x) => x.key === section)?.label}</div>
            <div className="mt-1 text-sm text-slate-600">Manager tools for supervising teams, attendance, and performance.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Role: Manager</div>
            {user?.companySlug ? <div className="rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700">Company: {user.companySlug}</div> : null}
          </div>
        </div>

        {section === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Team snapshot</div>
                <div className="mt-1 text-sm text-slate-600">Key indicators for your managed employees.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Present today</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">On leave</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-600">Pending approvals</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">—</div>
                    <div className="mt-1 text-xs text-slate-500">Coming soon</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Quick actions</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('team')}>
                    <div className="text-sm font-medium text-slate-900">View team</div>
                    <div className="mt-1 text-xs text-slate-600">Browse the team roster and statuses.</div>
                  </button>
                  <button type="button" className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50" onClick={() => setSection('timesheet')}>
                    <div className="text-sm font-medium text-slate-900">Open timesheet</div>
                    <div className="mt-1 text-xs text-slate-600">Review attendance days and totals.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 grid gap-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Approvals</div>
                <div className="mt-1 text-sm text-slate-600">Pending approvals for your team (company purpose, corrections).</div>
                <div className="mt-3">
                  <EmptyState title="Coming soon" description="This section will show manager approvals once enabled." />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {section !== 'overview' ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {section === 'team' ? (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-slate-900">Team directory</div>
                    <div className="text-sm text-slate-600">Search and review team members. Team scope rules will be applied later.</div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <select
                      className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                      value={teamDepartment}
                      onChange={(e) => setTeamDepartment(e.target.value)}
                    >
                      <option value="ALL">All departments</option>
                      {teamDepartmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full sm:w-72 rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="Search name, code, username…"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
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
                ) : filteredTeam.length === 0 ? (
                  <EmptyState
                    title="No team members found"
                    description={teamSearch.trim() || teamDepartment !== 'ALL' ? 'No employees match your filters.' : 'No employees found.'}
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
                          {filteredTeam.map((e) => (
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
                      {filteredTeam.map((e) => (
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
            ) : section === 'timesheet' ? (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Timesheet</div>
                    <div className="mt-1 text-sm text-slate-600">Review monthly timesheet and export CSV.</div>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end sm:justify-end">
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Year</div>
                      <select
                        className="mt-1 rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                      >
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = new Date().getUTCFullYear() - 2 + i;
                          return (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs font-medium text-slate-600">Month</div>
                      <select
                        className="mt-1 rounded-md border bg-white px-3 py-2 text-sm text-slate-700"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }).map((_, i) => {
                          const m = i + 1;
                          const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(Date.UTC(2000, i, 1)));
                          return (
                            <option key={m} value={m}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={timesheetLoading}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                      onClick={loadTimesheet}
                    >
                      {timesheetLoading ? 'Loading…' : 'Load'}
                    </button>
                    <button
                      type="button"
                      disabled={timesheetLoading || !timesheet}
                      className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={() => exportTimesheetCsv()}
                    >
                      Export CSV
                    </button>
                  </div>
                </div>

                {timesheetError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{timesheetError}</div>
                ) : null}

                {timesheetLoading ? (
                  <div className="mt-6 flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : !timesheet ? (
                  <EmptyState title="No timesheet loaded" description="Select a period then click Load." />
                ) : timesheet.rows.length === 0 ? (
                  <EmptyState title="No employees" description="No timesheet rows found." />
                ) : (
                  <>
                    <div className="mt-4 hidden md:block overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-2 text-left">Employee</th>
                            <th className="px-4 py-2 text-left">Code</th>
                            <th className="px-4 py-2 text-right">Present</th>
                            <th className="px-4 py-2 text-right">Off</th>
                            <th className="px-4 py-2 text-right">Worked (h)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timesheet.rows.map((r) => (
                            <tr key={r.employeeId} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 font-medium text-slate-900 whitespace-nowrap">{r.firstName} {r.lastName}</td>
                              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{r.employeeCode}</td>
                              <td className="px-4 py-2 text-right text-slate-700">{r.presentDays}</td>
                              <td className="px-4 py-2 text-right text-slate-700">{r.offDays}</td>
                              <td className="px-4 py-2 text-right text-slate-700">{minutesToDecimalHours(r.workedMinutes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 grid gap-3 md:hidden">
                      {timesheet.rows.map((r) => (
                        <div key={r.employeeId} className="rounded-xl border bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{r.firstName} {r.lastName}</div>
                              <div className="mt-1 text-xs text-slate-600">Code: <span className="font-medium text-slate-800">{r.employeeCode}</span></div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Worked</div>
                              <div className="text-sm font-semibold text-slate-900">{minutesToDecimalHours(r.workedMinutes)}h</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-slate-500">Present</div>
                              <div className="text-slate-800">{r.presentDays}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Off</div>
                              <div className="text-slate-800">{r.offDays}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Overtime (h)</div>
                              <div className="text-slate-800">{minutesToDecimalHours(r.overtimeMinutes)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Break (h)</div>
                              <div className="text-slate-800">{minutesToDecimalHours(r.breakMinutes)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <EmptyState title="No data" description="This section is ready. Enable backend features to populate it." />
            )}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
